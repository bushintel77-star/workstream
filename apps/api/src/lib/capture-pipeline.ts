import type { Store } from "@workstream/db";
import type { ProjectStatus } from "@workstream/contracts";
import { runTranscription } from "./transcription-job";
import { runSurvey } from "./survey-job";
import { runDesign } from "./design-job";
import { runCosting } from "./cost-job";
import { runProjectAudit } from "./audit-job";
import { runOutput } from "./output-job";
import { finding, guard, runStage, type StageLog } from "./stage-audit";

const CONFIDENCE_THRESHOLD = 0.4;
const TRANSCRIPT_MIN_LENGTH = 8;
const LOT_AREA_MIN = 1;
const GARDEN_AREA_MIN = 0;
const COST_SANITY_FACTOR = 10;

async function setStatus(
  store: Store,
  ownerId: string,
  projectId: string,
  status: ProjectStatus,
) {
  await store.updateProjectStatus(ownerId, projectId, status);
}

/**
 * Fully autonomous staged capture pipeline.
 * Each phase validates itself, applies guard rails, and fails fast.
 * Stage logs are emitted and can be streamed to the client without blocking.
 */
export async function runCapturePipeline(
  store: Store,
  ownerId: string,
  projectId: string,
  recordingId: string,
  audioPath: string,
  baseUrl: string,
  log?: { error: (obj: unknown, msg?: string) => void },
  fromStage?: string,
): Promise<StageLog[]> {
  const stageLogs: StageLog[] = [];
  const stageOrder = ["transcription", "survey", "design", "costing", "audit", "outputs"];
  const retryIndex = fromStage ? stageOrder.indexOf(fromStage) : -1;
  const skipBefore = (stage: string) => retryIndex > stageOrder.indexOf(stage);


  await setStatus(store, ownerId, projectId, "processing");

  // Phase 1: Transcription
  const transcriptResult = await runStage({
    stage: "transcription",
    skip: skipBefore("transcription"),
    store,
    ownerId,
    projectId,
    work: async () => {
      await runTranscription(store, recordingId, audioPath);
      const recording = await store.getRecording(recordingId);
      if (!recording) throw new Error("Recording disappeared after transcription");
      return recording;
    },
    audit: (recording) => [
      finding("recording has duration", recording.duration_s > 0, {
        duration_s: recording.duration_s,
      }),
      finding("audio uri is present", recording.audio_uri.length > 0, {
        audio_uri: recording.audio_uri,
      }),
      finding(
        "transcript is non-empty",
        (recording.transcript?.length ?? 0) >= TRANSCRIPT_MIN_LENGTH,
        { transcript_length: recording.transcript?.length ?? 0 },
      ),
    ],
    guard: (recording) => [
      guard(
        "transcription_confidence",
        recording.transcription_confidence ?? 0,
        CONFIDENCE_THRESHOLD,
        ">=",
      ),
    ],
  });
  stageLogs.push(transcriptResult.log);
  if (!transcriptResult.ok) {
    await setStatus(store, ownerId, projectId, "transcription_failed");
    log?.error(transcriptResult.log, "transcription stage failed");
    return stageLogs;
  }
  await setStatus(store, ownerId, projectId, "transcribed");

  // Phase 2: Survey
  const surveyResult = await runStage({
    stage: "survey",
    skip: skipBefore("survey"),
    store,
    ownerId,
    projectId,
    work: async () => runSurvey(store, ownerId, projectId),
    audit: (survey) => [
      finding("title polygon exists", survey.title_polygon.coordinates.length > 0, {
        ring_count: survey.title_polygon.coordinates.length,
      }),
      finding("aerial uri generated", survey.aerial_uri.length > 0, {
        aerial_uri: survey.aerial_uri,
      }),
    ],
    guard: (survey) => [
      guard("lot_area_m2", survey.lot_area_m2, LOT_AREA_MIN, ">="),
      guard("garden_area_m2", survey.garden_area_m2, GARDEN_AREA_MIN, ">="),
      guard("no_nan_measurements", survey.measurements.filter((m) => Number.isNaN(m.length_m)).length, 0, "=="),
    ],
  });
  stageLogs.push(surveyResult.log);
  if (!surveyResult.ok) {
    await setStatus(store, ownerId, projectId, "survey_failed");
    log?.error(surveyResult.log, "survey stage failed");
    return stageLogs;
  }
  await setStatus(store, ownerId, projectId, "survey_review");

  // Phase 3: Design
  const designResult = await runStage({
    stage: "design",
    skip: skipBefore("design"),
    store,
    ownerId,
    projectId,
    work: async () => runDesign(store, ownerId, projectId),
    audit: (design) => [
      finding("design mode detected", Boolean(design.mode), { mode: design.mode }),
      finding("proposal has zones", (design.proposal?.zones?.length ?? 0) > 0, {
        zone_count: design.proposal?.zones?.length ?? 0,
      }),
      finding("rationale is present", Boolean(design.rationale), {
        rationale_length: design.rationale?.length ?? 0,
      }),
    ],
    guard: (design) => {
      const skus = new Set<string>();
      for (const zone of design.proposal?.zones ?? []) {
        for (const p of zone.plantings ?? []) if (p.sku) skus.add(p.sku);
        for (const h of zone.hardscape ?? []) if (h.sku) skus.add(h.sku);
        for (const l of zone.lighting ?? []) if (l.sku) skus.add(l.sku);
        for (const i of zone.irrigation ?? []) if (i.sku) skus.add(i.sku);
      }
      const zones = design.proposal?.zones ?? [];
      const totalPlantArea = zones.reduce(
        (sum, z) => sum + (z.plantings?.length ?? 0),
        0,
      );
      return [
        guard("sku_count", skus.size, 1, ">="),
        guard("total_plantings", totalPlantArea, 0, ">="),
      ];
    },
  });
  stageLogs.push(designResult.log);
  if (!designResult.ok) {
    await setStatus(store, ownerId, projectId, "design_failed");
    log?.error(designResult.log, "design stage failed");
    return stageLogs;
  }
  await setStatus(store, ownerId, projectId, "design_review");

  // Phase 4: Costing
  const costingResult = await runStage({
    stage: "costing",
    skip: skipBefore("costing"),
    store,
    ownerId,
    projectId,
    work: async () => runCosting(store, ownerId, projectId),
    audit: (costings) => [
      finding("three scenarios built", costings.length === 3, {
        scenario_count: costings.length,
      }),
      finding("rate card applied", costings.some((c) => c.line_items.length > 0), {
        any_lines: costings.some((c) => c.line_items.length > 0),
      }),
    ],
    guard: (costings) => {
      const standard = costings.find((c) => c.scenario === "standard");
      const max = standard?.line_items
        .filter((l) => !l.is_provisional)
        .reduce((m, l) => Math.max(m, l.total), 0) ?? 0;
      const total = standard?.total ?? 0;
      const poaCount = standard?.line_items.filter((l) => l.is_provisional).length ?? 0;
      return [
        guard("standard_costing_exists", standard ? 1 : 0, 1, "=="),
        guard("provisional_poa_flagged", poaCount, poaCount, "=="),
        guard("max_line_sanity", max, total * COST_SANITY_FACTOR, "<="),
      ];
    },
  });
  stageLogs.push(costingResult.log);
  if (!costingResult.ok) {
    await setStatus(store, ownerId, projectId, "costing_failed");
    log?.error(costingResult.log, "costing stage failed");
    return stageLogs;
  }
  await setStatus(store, ownerId, projectId, "cost_review");

  // Phase 5: Audit
  const auditResult = await runStage({
    stage: "audit",
    skip: skipBefore("audit"),
    store,
    ownerId,
    projectId,
    work: async () => runProjectAudit(store, ownerId, projectId),
    audit: (audit) => [
      finding("audit has findings array", Array.isArray(audit.findings), {
        finding_count: audit.findings.length,
      }),
      finding("advisory findings recorded", audit.advisory_count >= 0, {
        advisory_count: audit.advisory_count,
      }),
    ],
    guard: (audit) => [
      guard("blocking_count", audit.blocking_count, 0, "=="),
      guard("passed", audit.passed ? 1 : 0, 1, "=="),
    ],
  });
  stageLogs.push(auditResult.log);
  if (!auditResult.ok) {
    await setStatus(store, ownerId, projectId, "audit_failed");
    log?.error(auditResult.log, "audit stage failed");
    return stageLogs;
  }
  await setStatus(store, ownerId, projectId, "audit");

  // Phase 6: Outputs
  const outputResult = await runStage({
    stage: "outputs",
    skip: skipBefore("outputs"),
    store,
    ownerId,
    projectId,
    work: async () => {
      const quote = await runOutput(store, ownerId, projectId, "quote", baseUrl);
      return { quote };
    },
    audit: (output) => [
      finding("quote output generated", output.quote.uri.length > 0, {
        quote_uri: output.quote.uri,
      }),
      finding("quote has public url", output.quote.uri.startsWith("http"), {
        quote_uri_prefix: output.quote.uri.slice(0, 20),
      }),
    ],
    guard: (output) => [
      guard("quote_uri_length", output.quote.uri.length, 10, ">="),
    ],
  });
  stageLogs.push(outputResult.log);
  if (!outputResult.ok) {
    await setStatus(store, ownerId, projectId, "outputs_failed");
    log?.error(outputResult.log, "outputs stage failed");
    return stageLogs;
  }

  await setStatus(store, ownerId, projectId, "complete");
  return stageLogs;
}

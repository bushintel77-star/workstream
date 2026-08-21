// FieldLoop v0.1 — compliance-engine/webhooks.ts
// Outbound Slack webhook engine: cross-trade lead dispatch + OHS alerts.
// Block Kit payloads. Webhook URLs are env-scoped per division channel.

export interface SlackLeadBroadcast {
  webhookUrl: string;
  sourceJobId: string;
  targetDivision: string;
  clientName: string;
  suburb: string;
  scopeNotes: string;
  photoUrl: string;
}

export interface SlackOHSAlert {
  webhookUrl: string;
  sourceJobId: string;
  severity: 'near_miss' | 'hazard';
  description: string;
  photoUrl?: string;
}

/** Dedup key so an at-least-once sync queue never double-posts the same lead. */
export function leadDedupKey(data: SlackLeadBroadcast): string {
  return `lead:${data.sourceJobId}:${data.targetDivision}`;
}

export function buildLeadBlocks(data: SlackLeadBroadcast) {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `INTERNAL LEAD: ${data.targetDivision.toUpperCase()}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Source Job:* ${data.sourceJobId}` },
        { type: 'mrkdwn', text: `*Location:* ${data.suburb}` },
        { type: 'mrkdwn', text: `*Client:* ${data.clientName}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Scope Notes:* ${data.scopeNotes}` },
    },
    {
      type: 'image',
      image_url: data.photoUrl,
      alt_text: 'Site defect evidence',
    },
  ];
}

export function buildOHSBlocks(data: SlackOHSAlert) {
  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text:
          data.severity === 'hazard' ? 'OHS HAZARD REPORT' : 'OHS NEAR-MISS REPORT',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Source Job:* ${data.sourceJobId}` },
        { type: 'mrkdwn', text: `*Severity:* ${data.severity}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Details:* ${data.description}` },
    },
  ];
  if (data.photoUrl) {
    blocks.push({
      type: 'image',
      image_url: data.photoUrl,
      alt_text: 'OHS evidence',
    });
  }
  return blocks;
}

/** Post a cross-trade lead to the target division channel. */
export async function broadcastCrossTradeLeadToSlack(
  data: SlackLeadBroadcast,
): Promise<void> {
  await postToSlack(data.webhookUrl, buildLeadBlocks(data));
}

/** Post an OHS alert to the #ohs-safety-alerts channel. */
export async function broadcastOHSAlertToSlack(data: SlackOHSAlert): Promise<void> {
  await postToSlack(data.webhookUrl, buildOHSBlocks(data));
}

async function postToSlack(
  webhookUrl: string,
  blocks: Array<Record<string, unknown>>,
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }
}

import { z } from "zod";
import { isAuthRequired } from "./lib/auth-config";

/**
 * Boot-time validation of process.env. Fail fast in production if
 * something critical is missing or malformed; warn in dev.
 *
 * Optional vars (Anthropic, OpenAI, Mapbox, Stripe, MYOB, Xero, Twilio,
 * Clerk) stay optional intentionally — the API ships canned fallbacks for
 * each so the operator can demo without spinning up six accounts.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  /* Required-in-prod */
  PUBLIC_API_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().optional(),
  WORKSTREAM_PORTAL_SECRET: z.string().min(32).optional(),
  /** @deprecated Use WORKSTREAM_PORTAL_SECRET */
  CONSTRUCT_PORTAL_SECRET: z.string().min(32).optional(),
  PORTAL_BASE_URL: z.string().url().optional(),

  /* Auth */
  CLERK_SECRET_KEY: z.string().startsWith("sk_").optional(),
  CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
  DEV_USER_ID: z.string().optional(),

  /* AI */
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
  OPENAI_API_KEY: z.string().startsWith("sk-").optional(),

  /* Geo — Mapbox optional (geocode/aerial). Vicmap cadastral is keyless WFS. */
  MAPBOX_TOKEN: z.string().optional(),

  /* Payments */
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^sk_(live|test)_/)
    .optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  DEPOSIT_PCT: z.coerce.number().min(0).max(100).default(20),

  /* Accounting */
  MYOB_CLIENT_ID: z.string().optional(),
  MYOB_CLIENT_SECRET: z.string().optional(),
  XERO_ACCESS_TOKEN: z.string().optional(),

  /* Persistence */
  WORKSTREAM_PERSIST_PATH: z.string().optional(),
  /** @deprecated Use WORKSTREAM_PERSIST_PATH */
  CONSTRUCT_PERSIST_PATH: z.string().optional(),

  /* Operational */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_WINDOW: z.string().optional(),
  WEATHER_DISABLED: z.enum(["true", "false"]).optional(),
  SUPPLIERS_LIVE: z.enum(["true", "false"]).optional(),

  /* Observability */
  SENTRY_DSN: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

const PROD_REQUIRED: Array<keyof AppEnv> = [
  "PUBLIC_API_URL",
  "CORS_ORIGIN",
];

export function loadEnv(logger: {
  warn: (msg: string) => void;
  error: (msg: string) => void;
}): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    logger.error(`Invalid environment variables:\n${issues}`);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
    /* In dev, fall back to a permissive parse so we don't block local
     * iteration on a stray test value. */
    return EnvSchema.partial().parse(process.env) as AppEnv;
  }

  if (parsed.data.NODE_ENV === "production") {
    const missing = PROD_REQUIRED.filter((k) => parsed.data[k] == null);
    if (missing.length > 0) {
      logger.error(
        `Missing required production env vars: ${missing.join(", ")}`,
      );
      process.exit(1);
    }

    const portal =
      parsed.data.WORKSTREAM_PORTAL_SECRET ??
      parsed.data.CONSTRUCT_PORTAL_SECRET;
    if (!portal) {
      logger.error(
        "WORKSTREAM_PORTAL_SECRET is required in production (CONSTRUCT_PORTAL_SECRET accepted until rotated).",
      );
      process.exit(1);
    }

    if (isAuthRequired() && !parsed.data.CLERK_SECRET_KEY) {
      logger.error(
        "CLERK_SECRET_KEY is required in production (set AUTH_REQUIRED=false only for demos).",
      );
      process.exit(1);
    }

    if (!parsed.data.SENTRY_DSN) {
      logger.warn(
        "SENTRY_DSN unset — error reporting disabled until you add it to Fly secrets.",
      );
    }

    const aiKeys = [
      parsed.data.OPENAI_API_KEY,
      parsed.data.ANTHROPIC_API_KEY,
      parsed.data.MAPBOX_TOKEN,
    ].filter(Boolean).length;
    if (aiKeys < 3) {
      logger.warn(
        `Only ${aiKeys}/3 AI/geo keys set (OPENAI, ANTHROPIC, MAPBOX). Missing keys use dev fallbacks — not suitable for paying customers.`,
      );
    }
  }

  return parsed.data;
}

import { z } from "zod";

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
  CONSTRUCT_PORTAL_SECRET: z.string().min(32).optional(),
  PORTAL_BASE_URL: z.string().url().optional(),

  /* Auth */
  CLERK_SECRET_KEY: z.string().startsWith("sk_").optional(),
  CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
  DEV_USER_ID: z.string().optional(),

  /* AI */
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
  OPENAI_API_KEY: z.string().startsWith("sk-").optional(),

  /* Geo */
  MAPBOX_TOKEN: z.string().optional(),
  VICMAP_ENABLED: z.enum(["true", "false"]).optional(),

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
  "CONSTRUCT_PORTAL_SECRET",
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
  }

  return parsed.data;
}

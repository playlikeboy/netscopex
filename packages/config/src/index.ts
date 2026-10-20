import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export const AppEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@127.0.0.1:54332/netscopex?sslmode=disable"),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16).default("netscopex_super_secret_jwt_key_2026"),
  WORKER_ID: z.string().default("worker-local-01"),
  PROBE_REGION: z.string().default("us-east-local"),
  WORKER_CONCURRENCY: z.coerce.number().default(10),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(1000),
  WORKER_LEASE_DURATION_MS: z.coerce.number().default(30000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  FAULT_INJECTION_ENABLED: z.coerce.boolean().default(true),
  MOCK_EXTERNAL_CALLS: z.coerce.boolean().default(false),
});

export type AppConfig = z.infer<typeof AppEnvSchema>;

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    const parsed = AppEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("Invalid environment configuration:", parsed.error.format());
      throw new Error("Invalid environment configuration");
    }
    cachedConfig = parsed.data;
  }
  return cachedConfig;
}

import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file if available
dotenv.config();

export const ConfigSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_URL: z
    .string()
    .url()
    .default('http://localhost:54321'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1)
    .default('mock_dev_service_role_key_do_not_use_in_prod'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export class ConfigValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const formatted = issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    super(`Invalid environment configuration: ${formatted}`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

export function validateConfig(rawEnv: Record<string, unknown> = process.env): AppConfig {
  const result = ConfigSchema.safeParse(rawEnv);
  if (!result.success) {
    throw new ConfigValidationError(result.error.issues);
  }
  return result.data;
}

export function loadConfig(): AppConfig {
  return validateConfig(process.env);
}


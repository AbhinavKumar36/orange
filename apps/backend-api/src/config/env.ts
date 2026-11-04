import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env files if available
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'apps/backend-api/.env') });

const PLACEHOLDER_PATTERN = /(example|mock|placeholder|dummy|test_key|your_)/i;

export const ConfigSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().min(1).default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // Explicit toggle for local/test mock mode; prevents pretending fake credentials are real
    ALLOW_MOCK_SERVICES: z
      .union([z.boolean(), z.string()])
      .default(false)
      .transform((val) => val === true || val === 'true' || val === '1'),
    SUPABASE_URL: z
      .string({
        required_error: 'SUPABASE_URL is required. Explicit Supabase project configuration is required.',
      })
      .url('SUPABASE_URL must be a valid URL string'),
    // Privileged key for authoritative DB access. Optional in dev/test, required in production.
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    // Public anon key. Can be used in dev for public catalog reading if service role key is absent.
    SUPABASE_ANON_KEY: z.string().min(1).optional(),
    RAZORPAY_KEY_ID: z.string().min(1).optional(),
    RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
    ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      // 1. SUPABASE_URL must use https and not localhost in production
      if (!data.SUPABASE_URL.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SUPABASE_URL must use HTTPS in production',
          path: ['SUPABASE_URL'],
        });
      }
      if (data.SUPABASE_URL.includes('localhost') || data.SUPABASE_URL.includes('127.0.0.1')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SUPABASE_URL cannot point to localhost in production',
          path: ['SUPABASE_URL'],
        });
      }

      // 2. SUPABASE_SERVICE_ROLE_KEY is required and cannot be a placeholder
      if (!data.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SUPABASE_SERVICE_ROLE_KEY is required in production',
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
        });
      } else if (PLACEHOLDER_PATTERN.test(data.SUPABASE_SERVICE_ROLE_KEY)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SUPABASE_SERVICE_ROLE_KEY cannot use placeholder or mock credentials in production',
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
        });
      }

      // 3. Razorpay credentials must not use placeholders if provided
      if (data.RAZORPAY_KEY_ID && PLACEHOLDER_PATTERN.test(data.RAZORPAY_KEY_ID)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'RAZORPAY_KEY_ID cannot use placeholder credentials in production',
          path: ['RAZORPAY_KEY_ID'],
        });
      }
      if (data.RAZORPAY_KEY_SECRET && PLACEHOLDER_PATTERN.test(data.RAZORPAY_KEY_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'RAZORPAY_KEY_SECRET cannot use placeholder credentials in production',
          path: ['RAZORPAY_KEY_SECRET'],
        });
      }
    } else {
      // In development or test, if service role key is provided and contains placeholder,
      // it must be explicitly permitted via ALLOW_MOCK_SERVICES
      if (
        data.SUPABASE_SERVICE_ROLE_KEY &&
        PLACEHOLDER_PATTERN.test(data.SUPABASE_SERVICE_ROLE_KEY) &&
        !data.ALLOW_MOCK_SERVICES
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Placeholder Supabase service role key detected without ALLOW_MOCK_SERVICES=true. Set ALLOW_MOCK_SERVICES=true to enable mock service mode locally.',
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
        });
      }
    }
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
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.DEV_SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY;
  }
  return validateConfig(process.env);
}

/**
 * Returns a sanitized copy of configuration with sensitive credentials masked.
 * Prevents accidental logging of secrets.
 */
export function getSanitizedConfig(config: AppConfig): Record<string, unknown> {
  return {
    PORT: config.PORT,
    HOST: config.HOST,
    NODE_ENV: config.NODE_ENV,
    ALLOW_MOCK_SERVICES: config.ALLOW_MOCK_SERVICES,
    SUPABASE_URL: config.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY ? '[REDACTED]' : undefined,
    RAZORPAY_KEY_ID: config.RAZORPAY_KEY_ID ? '[REDACTED]' : undefined,
    RAZORPAY_KEY_SECRET: config.RAZORPAY_KEY_SECRET ? '[REDACTED]' : undefined,
    RAZORPAY_WEBHOOK_SECRET: config.RAZORPAY_WEBHOOK_SECRET ? '[REDACTED]' : undefined,
    ALLOWED_ORIGINS: config.ALLOWED_ORIGINS,
  };
}

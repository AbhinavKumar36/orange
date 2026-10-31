import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  ConfigValidationError,
  getSanitizedConfig,
} from '../src/config/env.js';

describe('Environment Configuration Validation', () => {
  it('should use default values in development and not generate fake credentials', () => {
    const config = validateConfig({});
    expect(config.PORT).toBe(4000);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.NODE_ENV).toBe('development');
    expect(config.SUPABASE_URL).toBe('http://localhost:54321');
    expect(config.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(config.ALLOW_MOCK_SERVICES).toBe(false);
  });

  it('should require ALLOW_MOCK_SERVICES=true when placeholder key is provided in development', () => {
    expect(() => {
      validateConfig({
        SUPABASE_SERVICE_ROLE_KEY: 'example_service_role_key',
        ALLOW_MOCK_SERVICES: 'false',
      });
    }).toThrowError(ConfigValidationError);

    const validMock = validateConfig({
      SUPABASE_SERVICE_ROLE_KEY: 'example_service_role_key',
      ALLOW_MOCK_SERVICES: 'true',
    });
    expect(validMock.ALLOW_MOCK_SERVICES).toBe(true);
    expect(validMock.SUPABASE_SERVICE_ROLE_KEY).toBe('example_service_role_key');
  });

  it('should parse valid production configuration with real credentials', () => {
    const config = validateConfig({
      NODE_ENV: 'production',
      PORT: '4000',
      HOST: '0.0.0.0',
      SUPABASE_URL: 'https://prod-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.realProdKeyString1234567890',
      ALLOWED_ORIGINS: 'https://moodyorange.com',
    });

    expect(config.NODE_ENV).toBe('production');
    expect(config.SUPABASE_URL).toBe('https://prod-project.supabase.co');
    expect(config.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
  });

  it('should reject production configuration if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    expect(() => {
      validateConfig({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://prod-project.supabase.co',
      });
    }).toThrowError(ConfigValidationError);
  });

  it('should reject production configuration if SUPABASE_SERVICE_ROLE_KEY contains mock/placeholder text', () => {
    expect(() => {
      validateConfig({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://prod-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'mock_service_role_key',
      });
    }).toThrowError(ConfigValidationError);

    expect(() => {
      validateConfig({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://prod-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'example_service_role_key',
      });
    }).toThrowError(ConfigValidationError);
  });

  it('should reject production configuration if SUPABASE_URL points to localhost', () => {
    expect(() => {
      validateConfig({
        NODE_ENV: 'production',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'real_non_placeholder_key_for_testing_prod_validation_only',
      });
    }).toThrowError(ConfigValidationError);
  });

  it('should reject invalid PORT and invalid NODE_ENV', () => {
    expect(() => {
      validateConfig({ PORT: 'invalid' });
    }).toThrowError(ConfigValidationError);

    expect(() => {
      validateConfig({ PORT: '99999' });
    }).toThrowError(ConfigValidationError);

    expect(() => {
      validateConfig({ NODE_ENV: 'staging' });
    }).toThrowError(ConfigValidationError);
  });

  it('should sanitize credentials when getSanitizedConfig is called', () => {
    const config = validateConfig({
      SUPABASE_SERVICE_ROLE_KEY: 'real_secret_token_12345',
      RAZORPAY_KEY_SECRET: 'secret_key_abcdef',
      RAZORPAY_WEBHOOK_SECRET: 'webhook_secret_xyz',
    });

    const sanitized = getSanitizedConfig(config);
    expect(sanitized.SUPABASE_SERVICE_ROLE_KEY).toBe('[REDACTED]');
    expect(sanitized.RAZORPAY_KEY_SECRET).toBe('[REDACTED]');
    expect(sanitized.RAZORPAY_WEBHOOK_SECRET).toBe('[REDACTED]');
    expect(sanitized.PORT).toBe(4000);
  });
});

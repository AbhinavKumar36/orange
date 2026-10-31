import { describe, it, expect } from 'vitest';
import { validateConfig, ConfigValidationError } from '../src/config/env.js';

describe('Environment Configuration Validation', () => {
  it('should use default values when raw env is empty', () => {
    const config = validateConfig({});
    expect(config.PORT).toBe(4000);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.NODE_ENV).toBe('development');
    expect(config.SUPABASE_URL).toBe('http://localhost:54321');
  });

  it('should parse valid custom configuration', () => {
    const config = validateConfig({
      PORT: '5000',
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://example.supabase.co',
      ALLOWED_ORIGINS: 'https://app.moodyorange.com',
    });

    expect(config.PORT).toBe(5000);
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.NODE_ENV).toBe('production');
    expect(config.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(config.ALLOWED_ORIGINS).toBe('https://app.moodyorange.com');
  });

  it('should throw ConfigValidationError on invalid PORT string', () => {
    expect(() => {
      validateConfig({ PORT: 'not-a-port' });
    }).toThrowError(ConfigValidationError);
  });

  it('should throw ConfigValidationError on out-of-range PORT', () => {
    expect(() => {
      validateConfig({ PORT: '70000' });
    }).toThrowError(ConfigValidationError);

    expect(() => {
      validateConfig({ PORT: '0' });
    }).toThrowError(ConfigValidationError);
  });

  it('should throw ConfigValidationError on invalid NODE_ENV', () => {
    expect(() => {
      validateConfig({ NODE_ENV: 'staging' });
    }).toThrowError(ConfigValidationError);
  });

  it('should throw ConfigValidationError on invalid SUPABASE_URL', () => {
    expect(() => {
      validateConfig({ SUPABASE_URL: 'invalid-url-without-protocol' });
    }).toThrowError(ConfigValidationError);
  });

  it('should include actionable issue details in ConfigValidationError', () => {
    try {
      validateConfig({ PORT: 'invalid', NODE_ENV: 'wrong' });
      expect.unreachable('Should have thrown ConfigValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const err = error as ConfigValidationError;
      expect(err.issues.length).toBeGreaterThanOrEqual(2);
      expect(err.message).toContain('PORT');
      expect(err.message).toContain('NODE_ENV');
    }
  });
});


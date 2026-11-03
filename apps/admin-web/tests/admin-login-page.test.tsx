import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdminDashboardPage from '../src/app/page';

// Polyfill window & sessionStorage for server render simulation
(globalThis as any).React = React;
const mockSessionStorage = new Map<string, string>();
const sessionStoragePolyfill = {
  getItem: (k: string) => mockSessionStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockSessionStorage.set(k, String(v)),
  removeItem: (k: string) => mockSessionStorage.delete(k),
  clear: () => mockSessionStorage.clear(),
};

(globalThis as any).window = {
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
(globalThis as any).sessionStorage = sessionStoragePolyfill;

describe('Admin Portal Login Page - Production Credential Hygiene', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockSessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('proves the production login page does not expose quick-login controls or demo credentials', () => {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN;

    const html = renderToString(<AdminDashboardPage />);

    // Must render the legitimate staff authentication form
    expect(html).toContain('Sign In to Staff Portal');
    expect(html).toContain('id="staff-email"');
    expect(html).toContain('id="staff-password"');

    // Must NOT contain any hardcoded demo passwords or credentials
    expect(html).not.toContain('password123');
    expect(html).not.toContain('Local Dev Seed Accounts');
    expect(html).not.toContain('staff@moodyorange.local');
    expect(html).not.toContain('manager@moodyorange.local');
    expect(html).not.toContain('admin@moodyorange.local');
    expect(html).not.toContain('customer@moodyorange.local');
  });

  it('keeps quick-login controls absent even if NEXT_PUBLIC_ENABLE_DEV_LOGIN is set in production', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN = 'true';

    const html = renderToString(<AdminDashboardPage />);

    expect(html).not.toContain('password123');
    expect(html).not.toContain('Local Dev Seed Accounts');
    expect(html).not.toContain('staff@moodyorange.local');
    expect(html).not.toContain('customer@moodyorange.local');
  });

  it('exposes quick-login controls only when explicitly enabled in development', () => {
    (process.env as any).NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN = 'true';

    const html = renderToString(<AdminDashboardPage />);

    expect(html).toContain('Local Dev Seed Accounts (Supabase Auth):');
    expect(html).toContain('staff@moodyorange.local');
    expect(html).toContain('manager@moodyorange.local');
    expect(html).toContain('admin@moodyorange.local');
  });

  it('verifies generated production JavaScript assets contain zero demo credentials or quick-login code', () => {
    const nextStaticDir = join(__dirname, '../.next/static');
    if (!existsSync(nextStaticDir)) {
      // Build directory not generated yet in current test runner session
      return;
    }

    function getAllJsFiles(dir: string): string[] {
      const results: string[] = [];
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...getAllJsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const jsFiles = getAllJsFiles(nextStaticDir);
    expect(jsFiles.length).toBeGreaterThan(0);

    const forbiddenStrings = [
      'password123',
      'staff@moodyorange.local',
      'manager@moodyorange.local',
      'admin@moodyorange.local',
      'customer@moodyorange.local',
      'Local Dev Seed Accounts',
    ];

    for (const file of jsFiles) {
      const content = readFileSync(file, 'utf-8');
      for (const forbidden of forbiddenStrings) {
        expect(content, `Generated asset ${file} must not contain forbidden demo credential '${forbidden}'`).not.toContain(forbidden);
      }
    }
  });
});

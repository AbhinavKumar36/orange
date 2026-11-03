import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loginStaffWithCredentials,
  saveAdminSession,
  getStoredAdminSession,
  clearAdminSession,
  refreshStaffSession,
  type AdminStaffSession,
} from '../src/lib/auth';

// Polyfill window, sessionStorage, and events for Node test environment
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

describe('Admin Staff Supabase Auth & Server-Side Authorization (/admin/me)', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    clearAdminSession();
    vi.restoreAllMocks();
  });

  it('rejects login when email or password is empty', async () => {
    const res1 = await loginStaffWithCredentials('', 'password123');
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('email and password');

    const res2 = await loginStaffWithCredentials('staff@moodyorange.local', '');
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('email and password');
  });

  it('handles Supabase authentication failure with appropriate error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/auth/v1/token')) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ msg: 'Invalid login credentials' }),
        } as any;
      }
      return { ok: false, status: 500 } as any;
    });

    const res = await loginStaffWithCredentials('staff@moodyorange.local', 'wrongpass');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Invalid login credentials');
    expect(getStoredAdminSession()).toBeNull();
  });

  it('denies access to authenticated customer who has no staff role (Customer Segregation)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'customer_jwt_token',
            refresh_token: 'customer_refresh_token',
            expires_in: 3600,
          }),
        } as any;
      }
      if (urlStr.includes('/admin/me')) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            error: {
              statusCode: 403,
              code: 'FORBIDDEN_NOT_STAFF',
              message: 'Staff authorization required.',
            },
          }),
        } as any;
      }
      return { ok: false, status: 500 } as any;
    });

    const res = await loginStaffWithCredentials('customer@moodyorange.local', 'password123');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Customers cannot access the staff portal');
    expect(getStoredAdminSession()).toBeNull();
  });

  it('successfully logs in authorized staff member and stores session with server-verified role', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'valid_staff_jwt',
            refresh_token: 'valid_staff_refresh_token',
            expires_in: 3600,
          }),
        } as any;
      }
      if (urlStr.includes('/admin/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            staff: {
              userId: '00000000-0000-0000-0000-000000000002',
              phone: '+919876543211',
              fullName: 'Counter Staff',
              role: 'counter_staff',
              isActive: true,
            },
          }),
        } as any;
      }
      return { ok: false, status: 500 } as any;
    });

    const res = await loginStaffWithCredentials('staff@moodyorange.local', 'password123');
    expect(res.success).toBe(true);
    expect(res.session).toBeDefined();
    expect(res.session?.staff.role).toBe('counter_staff');
    expect(res.session?.staff.fullName).toBe('Counter Staff');

    const stored = getStoredAdminSession();
    expect(stored?.accessToken).toBe('valid_staff_jwt');
    expect(stored?.staff.role).toBe('counter_staff');
  });

  it('handles expired sessions and clears invalid stored tokens', () => {
    const expiredSession: AdminStaffSession = {
      accessToken: 'expired_jwt',
      expiresAt: Date.now() - 10000, // in the past
      staff: {
        id: '00000000-0000-0000-0000-000000000002',
        phone: '+919876543211',
        fullName: 'Counter Staff',
        role: 'counter_staff',
        isActive: true,
      },
    };

    saveAdminSession(expiredSession);
    const retrieved = getStoredAdminSession();
    expect(retrieved).toBeNull();
  });

  it('refreshes staff session using refresh token and re-verifies staff authorization', async () => {
    const initialSession: AdminStaffSession = {
      accessToken: 'old_access_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Date.now() + 10000,
      staff: {
        id: '00000000-0000-0000-0000-000000000003',
        phone: '+919876543212',
        fullName: 'Store Manager',
        role: 'manager',
        isActive: true,
      },
    };
    saveAdminSession(initialSession);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new_refreshed_access_token',
            refresh_token: 'new_refresh_token',
            expires_in: 3600,
          }),
        } as any;
      }
      if (urlStr.includes('/admin/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            staff: {
              userId: '00000000-0000-0000-0000-000000000003',
              phone: '+919876543212',
              fullName: 'Store Manager',
              role: 'manager',
              isActive: true,
            },
          }),
        } as any;
      }
      return { ok: false, status: 500 } as any;
    });

    const refreshed = await refreshStaffSession();
    expect(refreshed).not.toBeNull();
    expect(refreshed?.accessToken).toBe('new_refreshed_access_token');
    expect(refreshed?.staff.role).toBe('manager');

    const stored = getStoredAdminSession();
    expect(stored?.accessToken).toBe('new_refreshed_access_token');
  });

  it('clears session and returns null when refresh token is invalid', async () => {
    const initialSession: AdminStaffSession = {
      accessToken: 'old_access_token',
      refreshToken: 'bad_refresh_token',
      expiresAt: Date.now() + 10000,
      staff: {
        id: '00000000-0000-0000-0000-000000000003',
        phone: '+919876543212',
        fullName: 'Store Manager',
        role: 'manager',
        isActive: true,
      },
    };
    saveAdminSession(initialSession);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/auth/v1/token')) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ msg: 'Invalid Refresh Token' }),
        } as any;
      }
      return { ok: false, status: 500 } as any;
    });

    const refreshed = await refreshStaffSession();
    expect(refreshed).toBeNull();
    expect(getStoredAdminSession()).toBeNull();
  });
});

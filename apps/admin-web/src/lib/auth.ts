'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AdminStaffProfile, StaffRole } from '@orange/api-contracts';
import { fetchAdminMe, AdminApiError } from './api';

const STORAGE_KEY = 'moody_orange_admin_session';

const PLACEHOLDER_KEY_PATTERN = /(example|mock|placeholder|dummy)/i;

function getValidatedAuthEnv(): { url: string; anonKey: string } {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (typeof window !== 'undefined') {
    if (!url) {
      console.error('[Config] NEXT_PUBLIC_SUPABASE_URL is missing. Please configure it in your environment.');
    } else if (isProd && (!url.startsWith('https://') || url.includes('localhost') || url.includes('127.0.0.1'))) {
      console.error('[Security] Production requires a valid HTTPS NEXT_PUBLIC_SUPABASE_URL without localhost');
    }
    if (!anonKey || PLACEHOLDER_KEY_PATTERN.test(anonKey)) {
      console.error('[Config] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or invalid.');
    }
  }

  return { url, anonKey };
}

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getValidatedAuthEnv();

export interface AdminStaffSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  staff: AdminStaffProfile;
}

let inMemorySession: AdminStaffSession | null = null;

export function getStoredAdminSession(): AdminStaffSession | null {
  if (inMemorySession) {
    if (inMemorySession.expiresAt && inMemorySession.expiresAt < Date.now()) {
      clearAdminSession();
      return null;
    }
    return inMemorySession;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminStaffSession;
    if (session.expiresAt && session.expiresAt < Date.now()) {
      clearAdminSession();
      return null;
    }
    inMemorySession = session;
    return session;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminStaffSession): void {
  inMemorySession = session;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // SessionStorage restricted
  }
}

export function clearAdminSession(): void {
  inMemorySession = null;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('moody_orange_admin_auth_change'));
  } catch {
    // Ignore
  }
}

/**
 * Performs email/password authentication against Supabase Auth,
 * then validates staff authorization through server-side /admin/me.
 * Discards credentials and denies access if the authenticated account is not staff.
 */
export async function loginStaffWithCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; session?: AdminStaffSession; error?: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !password) {
    return { success: false, error: 'Please enter both staff email and password.' };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: cleanEmail,
        password,
      }),
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as {
        msg?: string;
        message?: string;
        error_description?: string;
      } | null;
      const message =
        errJson?.msg ||
        errJson?.message ||
        errJson?.error_description ||
        `Authentication failed (HTTP ${res.status})`;
      return { success: false, error: message };
    }

    const tokenData = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenData.access_token) {
      return { success: false, error: 'No access token received from authentication provider.' };
    }

    // Step 2: Authoritative Server-Side Staff Verification (/admin/me)
    try {
      const meResponse = await fetchAdminMe(tokenData.access_token);
      if (!meResponse?.staff?.role) {
        return {
          success: false,
          error: 'Access denied: Account is authenticated but possesses no staff role.',
        };
      }

      const session: AdminStaffSession = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in
          ? Date.now() + tokenData.expires_in * 1000
          : Date.now() + 3600 * 1000,
        staff: meResponse.staff,
      };

      saveAdminSession(session);
      return { success: true, session };
    } catch (apiErr: unknown) {
      if (apiErr instanceof AdminApiError && apiErr.statusCode === 403) {
        return {
          success: false,
          error: 'Access denied: Your account is authenticated, but is not authorized as store staff. Customers cannot access the staff portal.',
        };
      }
      return {
        success: false,
        error: apiErr instanceof Error ? apiErr.message : 'Failed to verify staff permissions.',
      };
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error connecting to authentication service.',
    };
  }
}

/**
 * Attempts to refresh an existing staff session using the refresh token.
 */
export async function refreshStaffSession(): Promise<AdminStaffSession | null> {
  const current = getStoredAdminSession();
  if (!current?.refreshToken) {
    clearAdminSession();
    return null;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        refresh_token: current.refreshToken,
      }),
    });

    if (!res.ok) {
      clearAdminSession();
      return null;
    }

    const tokenData = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const meResponse = await fetchAdminMe(tokenData.access_token);
    const updated: AdminStaffSession = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || current.refreshToken,
      expiresAt: tokenData.expires_in
        ? Date.now() + tokenData.expires_in * 1000
        : Date.now() + 3600 * 1000,
      staff: meResponse.staff,
    };

    saveAdminSession(updated);
    return updated;
  } catch {
    clearAdminSession();
    return null;
  }
}

export function useAdminAuth() {
  const [session, setSession] = useState<AdminStaffSession | null>(() => {
    return typeof window !== 'undefined' ? getStoredAdminSession() : null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    return typeof window !== 'undefined' && getStoredAdminSession() !== null;
  });
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    const stored = getStoredAdminSession();
    if (!stored) {
      setSession(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Verify token validity against /admin/me
    try {
      const me = await fetchAdminMe(stored.accessToken);
      if (!getStoredAdminSession()) {
        setSession(null);
        return;
      }
      const activeSession: AdminStaffSession = {
        ...stored,
        staff: me.staff,
      };
      setSession(activeSession);
    } catch (err: unknown) {
      if (!getStoredAdminSession()) {
        setSession(null);
        return;
      }
      // If expired, attempt token refresh
      const refreshed = await refreshStaffSession();
      if (refreshed && getStoredAdminSession()) {
        setSession(refreshed);
      } else {
        clearAdminSession();
        setSession(null);
        setError(
          err instanceof AdminApiError && err.statusCode === 403
            ? 'Access denied: Staff authorization revoked or account is not staff.'
            : 'Session expired. Please sign in again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    function handleAuthChange() {
      checkAuth();
    }

    window.addEventListener('moody_orange_admin_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('moody_orange_admin_auth_change', handleAuthChange);
    };
  }, [checkAuth]);

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);
    const result = await loginStaffWithCredentials(email, pass);
    if (!result.success) {
      clearAdminSession();
      setSession(null);
      const err = result.error || 'Authentication failed';
      setError(err);
      setIsLoading(false);
      return { success: false, error: err };
    }
    setSession(result.session || null);
    setIsLoading(false);
    return { success: true };
  };

  const logout = () => {
    clearAdminSession();
    setSession(null);
    setError(null);
  };

  const hasRole = (allowedRoles: StaffRole[]): boolean => {
    if (!session?.staff) return false;
    return allowedRoles.includes(session.staff.role);
  };

  return {
    token: session?.accessToken || null,
    staff: session?.staff || null,
    isAuthenticated: !!session?.staff,
    isLoading,
    error,
    login,
    logout,
    hasRole,
    isStaff: !!session?.staff,
    isManager: session?.staff?.role === 'manager' || session?.staff?.role === 'admin',
    isAdmin: session?.staff?.role === 'admin',
  };
}

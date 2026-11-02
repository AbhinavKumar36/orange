'use client';

import { useState, useEffect } from 'react';
import type { AdminStaffProfile, StaffRole } from '@orange/api-contracts';
import { fetchAdminMe } from './api';

const ADMIN_STORAGE_KEY = 'moody_orange_admin_token';

export interface AdminSession {
  token: string;
  staff: AdminStaffProfile;
}

let inMemoryToken: string | null = null;

export function getStoredAdminToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === 'undefined') return null;
  try {
    const token = sessionStorage.getItem(ADMIN_STORAGE_KEY);
    inMemoryToken = token;
    return token;
  } catch {
    return null;
  }
}

export function saveAdminToken(token: string): void {
  inMemoryToken = token;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ADMIN_STORAGE_KEY, token);
    window.dispatchEvent(new Event('moody_orange_admin_auth_change'));
  } catch {
    // SessionStorage restricted
  }
}

export function clearAdminToken(): void {
  inMemoryToken = null;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    window.dispatchEvent(new Event('moody_orange_admin_auth_change'));
  } catch {
    // Ignore
  }
}

export function useAdminAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<AdminStaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = async () => {
    setIsLoading(true);
    setError(null);
    const stored = getStoredAdminToken();
    if (!stored) {
      setToken(null);
      setStaff(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetchAdminMe(stored);
      setToken(stored);
      setStaff(res.staff);
    } catch (err: unknown) {
      clearAdminToken();
      setToken(null);
      setStaff(null);
      setError(err instanceof Error ? err.message : 'Invalid or expired session');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    function handleAuthChange() {
      checkAuth();
    }

    window.addEventListener('moody_orange_admin_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('moody_orange_admin_auth_change', handleAuthChange);
    };
  }, []);

  const loginWithToken = async (newToken: string) => {
    saveAdminToken(newToken);
    await checkAuth();
  };

  const logout = () => {
    clearAdminToken();
    setToken(null);
    setStaff(null);
  };

  const hasRole = (allowedRoles: StaffRole[]): boolean => {
    if (!staff) return false;
    return allowedRoles.includes(staff.role);
  };

  return {
    token,
    staff,
    isAuthenticated: !!staff,
    isLoading,
    error,
    loginWithToken,
    logout,
    hasRole,
    isStaff: !!staff,
    isManager: staff?.role === 'manager' || staff?.role === 'admin',
    isAdmin: staff?.role === 'admin',
  };
}


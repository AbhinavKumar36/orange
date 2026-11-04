'use client';

import { useState, useEffect } from 'react';

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

/**
 * Returns true only when development OTP testing is explicitly enabled.
 * Strictly disabled in production builds.
 */
export function isDevOtpEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true'
  );
}

const STORAGE_KEY = 'moody_orange_customer_session';

// Documented canonical test numbers for local development reference
export const LOCAL_DEV_TEST_OTPS: Readonly<Record<string, string>> = Object.freeze({
  '+919876543210': '123456',
  '+919876500001': '111111',
  '+919876500002': '222222',
});

export interface CustomerSession {
  accessToken: string;
  user: {
    id: string;
    phone: string;
    fullName?: string | null;
  };
  expiresAt?: number;
}

interface SupabaseAuthError {
  msg?: string;
  message?: string;
  error_description?: string;
}

interface SupabaseVerifySuccess {
  access_token: string;
  expires_at?: number;
  user: {
    id: string;
    phone: string;
    user_metadata?: {
      full_name?: string;
    };
  };
}

/**
 * Normalizes Indian mobile phone numbers to E.164 (+91XXXXXXXXXX)
 * enforcing strict validation across digits, prefixes, and characters.
 */
export function normalizeIndianPhoneNumber(input: string | null | undefined): {
  isValid: boolean;
  e164?: string;
  nationalNumber?: string;
  error?: string;
} {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return { isValid: false, error: 'Phone number cannot be empty.' };
  }

  const trimmed = input.trim();

  if (/[^0-9+\s\-().]/.test(trimmed)) {
    return { isValid: false, error: 'Phone number contains invalid characters.' };
  }

  if ((trimmed.match(/\+/g) || []).length > 1) {
    return { isValid: false, error: 'Duplicate country prefix detected.' };
  }

  const hasPlus = trimmed.startsWith('+');

  if (hasPlus && !trimmed.startsWith('+91')) {
    return { isValid: false, error: 'Only Indian mobile numbers (+91) are currently supported.' };
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) {
    return { isValid: false, error: 'Phone number contains no digits.' };
  }

  if (digitsOnly.startsWith('9191') && digitsOnly.length === 14) {
    return { isValid: false, error: 'Duplicate country prefix detected.' };
  }

  let subscriberDigits = digitsOnly;
  if (hasPlus && subscriberDigits.startsWith('91')) {
    subscriberDigits = subscriberDigits.slice(2);
  } else if (!hasPlus && subscriberDigits.startsWith('91') && subscriberDigits.length === 12) {
    subscriberDigits = subscriberDigits.slice(2);
  }

  while (subscriberDigits.startsWith('0')) {
    subscriberDigits = subscriberDigits.slice(1);
  }

  if (subscriberDigits.length !== 10) {
    return {
      isValid: false,
      error: `Invalid phone number length (${subscriberDigits.length} digits). Indian mobile numbers must have exactly 10 digits.`,
    };
  }

  if (!/^[6-9]/.test(subscriberDigits)) {
    return {
      isValid: false,
      error: 'Invalid Indian mobile number. Mobile numbers must begin with 6, 7, 8, or 9.',
    };
  }

  return {
    isValid: true,
    e164: `+91${subscriberDigits}`,
    nationalNumber: subscriberDigits,
  };
}

export function isValidIndianPhoneNumber(input: string | null | undefined): boolean {
  return normalizeIndianPhoneNumber(input).isValid;
}

export function formatIndianPhoneNumber(raw: string): string {
  const norm = normalizeIndianPhoneNumber(raw);
  return norm.e164 || raw;
}

export function validatePhoneNumber(phone: string): boolean {
  return isValidIndianPhoneNumber(phone);
}

export async function requestPhoneOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  const norm = normalizeIndianPhoneNumber(phone);
  if (!norm.isValid || !norm.e164) {
    return { success: false, error: norm.error || 'Please enter a valid 10-digit mobile number.' };
  }
  const formatted = norm.e164;
  const devModeActive = isDevOtpEnabled();

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ phone: formatted }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as SupabaseAuthError | null;
      const rawMsg = data?.msg || data?.error_description || '';
      const isProviderDisabled =
        rawMsg.toLowerCase().includes('unsupported phone provider') ||
        rawMsg.toLowerCase().includes('phone provider') ||
        (data as unknown as { error_code?: string })?.error_code === 'phone_provider_disabled';

      // In development test mode ONLY: allow canonical test numbers to proceed to OTP entry if SMS provider is unconfigured
      if (devModeActive && isProviderDisabled && LOCAL_DEV_TEST_OTPS[formatted]) {
        return { success: true };
      }

      let msg = rawMsg || `Failed to send SMS verification code (status ${res.status}).`;
      if (isProviderDisabled) {
        msg = devModeActive
          ? 'SMS provider not configured on local development environment.'
          : 'SMS authentication service is currently unavailable. Please contact support.';
      }
      return {
        success: false,
        error: msg,
      };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Network error connecting to authentication service.' };
  }
}

export async function verifyPhoneOtp(
  phone: string,
  token: string
): Promise<{ success: boolean; session?: CustomerSession; error?: string }> {
  const norm = normalizeIndianPhoneNumber(phone);
  if (!norm.isValid || !norm.e164) {
    return { success: false, error: norm.error || 'Please enter a valid 10-digit mobile number.' };
  }
  const formatted = norm.e164;
  const cleanToken = token.trim();
  const devModeActive = isDevOtpEnabled();

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        type: 'sms',
        phone: formatted,
        token: cleanToken,
      }),
    });

    if (!res.ok) {
      // In development test mode ONLY: allow canonical dev test numbers to establish a dev session
      // Password grant fallback is strictly removed; test credentials cannot be used in production builds
      if (devModeActive && LOCAL_DEV_TEST_OTPS[formatted] && cleanToken === LOCAL_DEV_TEST_OTPS[formatted]) {
        // Seeded canonical demo customer UUID from Supabase auth.users & public.profiles
        const customerId = '00000000-0000-0000-0000-000000000001';
        const session: CustomerSession = {
          accessToken: `dev_customer_token:${customerId}:${formatted}:${Date.now()}`,
          user: {
            id: customerId,
            phone: formatted,
            fullName: 'Demo Customer',
          },
          expiresAt: Date.now() + 3600 * 1000,
        };
        saveCustomerSession(session);
        return { success: true, session };
      }

      const errData = (await res.json().catch(() => null)) as SupabaseAuthError | null;
      return {
        success: false,
        error: errData?.msg || errData?.error_description || 'Invalid or expired OTP code. Please try again.',
      };
    }

    const data = (await res.json()) as SupabaseVerifySuccess;
    if (!data.access_token || !data.user?.id) {
      return { success: false, error: 'Invalid authentication response from service.' };
    }

    const session: CustomerSession = {
      accessToken: data.access_token,
      user: {
        id: data.user.id,
        phone: data.user.phone,
        fullName: data.user.user_metadata?.full_name || null,
      },
      expiresAt: data.expires_at ? data.expires_at * 1000 : Date.now() + 3600 * 1000,
    };

    saveCustomerSession(session);
    return { success: true, session };
  } catch {
    return { success: false, error: 'Network error connecting to authentication service.' };
  }
}

let inMemorySession: CustomerSession | null = null;

export function saveCustomerSession(session: CustomerSession): void {
  inMemorySession = session;
  if (typeof window === 'undefined') return;
  try {
    const raw = JSON.stringify(session);
    sessionStorage.setItem(STORAGE_KEY, raw);
    window.dispatchEvent(new Event('moody_orange_auth_change'));
  } catch {
    // Session storage quota or private browsing mode
  }
}

export function getStoredCustomerSession(): CustomerSession | null {
  if (inMemorySession) {
    if (inMemorySession.expiresAt && inMemorySession.expiresAt < Date.now()) {
      clearCustomerSession();
      return null;
    }
    return inMemorySession;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as CustomerSession;
    if (session.expiresAt && session.expiresAt < Date.now()) {
      clearCustomerSession();
      return null;
    }
    inMemorySession = session;
    return session;
  } catch {
    return null;
  }
}

export function clearCustomerSession(): void {
  inMemorySession = null;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    // Expire any legacy JavaScript cookie
    document.cookie = 'moody_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    window.dispatchEvent(new Event('moody_orange_auth_change'));
  } catch {
    // Ignore
  }
}

export function useCustomerAuth() {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getStoredCustomerSession());
    setIsLoading(false);

    function handleAuthChange() {
      setSession(getStoredCustomerSession());
    }

    window.addEventListener('moody_orange_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('moody_orange_auth_change', handleAuthChange);
    };
  }, []);

  return {
    session,
    isAuthenticated: !!session,
    isLoading,
    logout: clearCustomerSession,
  };
}

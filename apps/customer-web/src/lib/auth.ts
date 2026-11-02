'use client';

import { useState, useEffect } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key';

const STORAGE_KEY = 'moody_orange_customer_session';

export const LOCAL_DEV_TEST_OTPS: Record<string, string> = {
  '+919876543210': '123456',
  '+919876500001': '111111',
  '+919876500002': '222222',
};

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
      // In local dev/mock mode, if Supabase Auth SMS provider isn't configured, allow mock verification
      if (res.status === 400 || res.status === 422 || res.status === 500) {
        if (process.env.NODE_ENV !== 'production') {
          return { success: true };
        }
      }
      return {
        success: false,
        error: data?.msg || data?.error_description || 'Unable to send SMS verification code. Please try again.',
      };
    }

    return { success: true };
  } catch {
    // If Supabase server is offline in local dev, allow mock testing
    if (process.env.NODE_ENV !== 'production') {
      return { success: true };
    }
    return { success: false, error: 'Network error connecting to authentication service.' };
  }
}

export async function verifyPhoneOtp(
  phone: string,
  token: string
): Promise<{ success: boolean; session?: CustomerSession; error?: string }> {
  const norm = normalizeIndianPhoneNumber(phone);
  const formatted = norm.e164 || phone;
  const cleanToken = token.trim();

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

    if (res.ok) {
      const data = (await res.json()) as SupabaseVerifySuccess;
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
    }

    // In local dev fallback for testing
    if (process.env.NODE_ENV !== 'production' && cleanToken.length === 6) {
      const expectedOtp = LOCAL_DEV_TEST_OTPS[formatted] || '123456';
      if (cleanToken === expectedOtp || cleanToken === '123456') {
        const mockId = `cust_${formatted.replace(/[^\d]/g, '').slice(-6)}`;
        const session: CustomerSession = {
          accessToken: `mock_customer_:${mockId}:${formatted}:Customer`,
          user: {
            id: mockId,
            phone: formatted,
            fullName: 'Boutique Guest',
          },
          expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
        };
        saveCustomerSession(session);
        return { success: true, session };
      }
    }

    const errData = (await res.json().catch(() => null)) as SupabaseAuthError | null;
    return {
      success: false,
      error: errData?.msg || errData?.error_description || 'Invalid or expired OTP code. Please try again.',
    };
  } catch {
    if (process.env.NODE_ENV !== 'production' && cleanToken.length === 6) {
      const expectedOtp = LOCAL_DEV_TEST_OTPS[formatted] || '123456';
      if (cleanToken === expectedOtp || cleanToken === '123456') {
        const mockId = `cust_${formatted.replace(/[^\d]/g, '').slice(-6)}`;
        const session: CustomerSession = {
          accessToken: `mock_customer_:${mockId}:${formatted}:Customer`,
          user: {
            id: mockId,
            phone: formatted,
            fullName: 'Boutique Guest',
          },
          expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
        };
        saveCustomerSession(session);
        return { success: true, session };
      }
    }
    return { success: false, error: 'Authentication request failed.' };
  }
}

export function saveCustomerSession(session: CustomerSession): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = JSON.stringify(session);
    sessionStorage.setItem(STORAGE_KEY, raw);
    localStorage.setItem(STORAGE_KEY, raw);
    document.cookie = `moody_session=${encodeURIComponent(session.accessToken)}; path=/; max-age=604800; SameSite=Lax`;
    window.dispatchEvent(new Event('moody_orange_auth_change'));
  } catch {
    // Quota or privacy mode
  }
}

export function getStoredCustomerSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as CustomerSession;
    if (session.expiresAt && session.expiresAt < Date.now()) {
      clearCustomerSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearCustomerSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
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

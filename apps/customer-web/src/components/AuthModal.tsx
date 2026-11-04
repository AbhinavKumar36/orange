'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { requestPhoneOtp, verifyPhoneOtp, formatIndianPhoneNumber } from '../lib/auth';
import { updateProfileApi } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthStep = 'PHONE' | 'OTP' | 'NAME';

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps): ReactElement | null {
  const [step, setStep] = useState<AuthStep>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formatted = formatIndianPhoneNumber(phone);
    const result = await requestPhoneOtp(formatted);
    setIsLoading(false);

    if (result.success) {
      setStep('OTP');
      setCooldown(60);
    } else {
      setError(result.error || 'Failed to send OTP. Please check your number.');
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formatted = formatIndianPhoneNumber(phone);
    const result = await verifyPhoneOtp(formatted, otp);
    setIsLoading(false);

    if (result.success && result.session) {
      setToken(result.session.accessToken);
      if (!result.session.user.fullName) {
        setStep('NAME');
      } else {
        if (onSuccess) {
          onSuccess();
        } else {
          onClose();
        }
      }
    } else {
      setError(result.error || 'Invalid verification code.');
    }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (token) {
        await updateProfileApi(name.trim(), token);
      }
      setIsLoading(false);
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch {
      setIsLoading(false);
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    }
  }

  async function handleResendCode() {
    if (cooldown > 0) return;
    setError(null);
    setIsLoading(true);
    const formatted = formatIndianPhoneNumber(phone);
    const result = await requestPhoneOtp(formatted);
    setIsLoading(false);
    if (result.success) {
      setCooldown(60);
    } else {
      setError(result.error || 'Failed to resend OTP.');
    }
  }

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Customer Authentication"
    >
      <div
        className="drawer-panel"
        style={{ maxWidth: '420px', margin: 'auto', borderRadius: '16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="brand-logo-mark" style={{ width: '1.5rem', height: '1.5rem' }}>
              🌿
            </span>
            <h2 className="drawer-title">
              {step === 'PHONE' && 'Sign In / Register'}
              {step === 'OTP' && 'Verify Mobile OTP'}
              {step === 'NAME' && 'Your Details'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ width: '2rem', height: '2rem' }}
          >
            ✕
          </button>
        </div>

        <div className="drawer-body" style={{ padding: '1.5rem' }}>
          {error && (
            <div
              style={{
                backgroundColor: '#FFF0F0',
                color: '#D32F2F',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                border: '1px solid #FFCDD2',
              }}
            >
              {error}
            </div>
          )}

          {step === 'PHONE' && (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#555', margin: 0 }}>
                Enter your mobile number to receive a one-time verification code.
              </p>

              <div>
                <label
                  htmlFor="auth-phone-input"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Mobile Number (India +91)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      padding: '0.65rem 0.75rem',
                      background: '#F5F5F5',
                      border: '1px solid #DDD',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                    }}
                  >
                    🇮🇳 +91
                  </span>
                  <input
                    id="auth-phone-input"
                    type="tel"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.85rem',
                      border: '1px solid #DDD',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || phone.replace(/[^\d]/g, '').length < 10}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
              >
                {isLoading ? 'Sending Code...' : 'Get One-Time Code'}
              </button>

              {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true' && (
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #EEE' }}>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Dev test numbers (Local Dev Only):
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setPhone('9876543210')}
                      style={{
                        background: '#F8F5F0',
                        border: '1px solid #E0D9D0',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        color: '#444',
                      }}
                    >
                      9876543210
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhone('9876500001')}
                      style={{
                        background: '#F8F5F0',
                        border: '1px solid #E0D9D0',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        color: '#444',
                      }}
                    >
                      9876500001
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#555', margin: 0 }}>
                We sent a 6-digit code to <strong>{formatIndianPhoneNumber(phone)}</strong>.
              </p>

              <div>
                <label
                  htmlFor="auth-otp-input"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  6-Digit Verification Code
                </label>
                <input
                  id="auth-otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ''))}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1.25rem',
                    letterSpacing: '0.35rem',
                    textAlign: 'center',
                    border: '1px solid #DDD',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length < 6}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem' }}
              >
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setStep('PHONE')}
                  style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  ← Edit Phone
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={cooldown > 0 || isLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: cooldown > 0 ? '#999' : '#D9531E',
                    fontSize: '0.8rem',
                    cursor: cooldown > 0 ? 'default' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {step === 'NAME' && (
            <form onSubmit={handleSaveName} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#555', margin: 0 }}>
                Please provide your name for counter pickup and order notifications.
              </p>

              <div>
                <label
                  htmlFor="auth-name-input"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}
                >
                  Full Name
                </label>
                <input
                  id="auth-name-input"
                  type="text"
                  placeholder="e.g. Abhinav Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #DDD',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
              >
                {isLoading ? 'Saving...' : 'Finish Setup'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


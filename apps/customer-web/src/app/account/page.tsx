'use client';

import React, { useState, useEffect, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCustomerAuth } from '../../lib/auth';
import { fetchProfileApi, updateProfileApi, ApiError } from '../../lib/api';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { AuthModal } from '../../components/AuthModal';
import type { CustomerProfile } from '@orange/api-contracts';

export default function AccountPage(): ReactElement {
  const router = useRouter();
  const { session, isAuthenticated, isLoading: isAuthLoading, logout } = useCustomerAuth();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [formErrors, setFormErrors] = useState<{ fullName?: string; email?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Unsaved changes confirmation
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Auth modal if not logged in
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !session?.accessToken) {
      setIsLoadingProfile(false);
      return;
    }

    let isMounted = true;
    setIsLoadingProfile(true);
    setProfileError(null);

    fetchProfileApi(session.accessToken)
      .then((data) => {
        if (isMounted) {
          setProfile(data);
          setFullName(data.fullName || '');
          setEmail(data.email || '');
        }
      })
      .catch((err) => {
        if (isMounted) {
          // If fetch fails, use session information
          setProfile({
            id: session.user.id,
            phone: session.user.phone,
            fullName: session.user.fullName || null,
            email: null,
          });
          setFullName(session.user.fullName || '');
          setEmail('');
          if (err instanceof ApiError && err.statusCode !== 404) {
            setProfileError(err.message);
          }
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, session]);

  const hasUnsavedChanges =
    isEditing &&
    (fullName.trim() !== (profile?.fullName || '').trim() ||
      email.trim() !== (profile?.email || '').trim());

  const handleStartEditing = () => {
    setFullName(profile?.fullName || '');
    setEmail(profile?.email || '');
    setFormErrors({});
    setSaveSuccessMessage(null);
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      setIsEditing(false);
      setFormErrors({});
    }
  };

  const handleConfirmDiscard = () => {
    setFullName(profile?.fullName || '');
    setEmail(profile?.email || '');
    setFormErrors({});
    setIsEditing(false);
    setShowDiscardConfirm(false);
  };

  const validateForm = (): boolean => {
    const errors: { fullName?: string; email?: string } = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full Name is required.';
    } else if (fullName.trim().length > 100) {
      errors.fullName = 'Name cannot exceed 100 characters.';
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !session?.accessToken) return;

    setIsSaving(true);
    setProfileError(null);
    setSaveSuccessMessage(null);

    try {
      const updated = await updateProfileApi(
        {
          fullName: fullName.trim(),
          email: email.trim() || null,
        },
        session.accessToken
      );

      setProfile(updated);
      setFullName(updated.fullName || '');
      setEmail(updated.email || '');
      setIsEditing(false);
      setSaveSuccessMessage('Your profile information has been successfully updated.');
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = () => {
    logout();
    router.push('/');
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Active Member';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Active Member';
    }
  };

  return (
    <>
      <Header />
      <main className="account-page-main">
        <div className="container account-page-container">
          {/* Breadcrumb Navigation */}
          <nav className="account-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Account Profile</span>
          </nav>

          <div className="account-header-section">
            <h1 className="account-title">Account Information</h1>
            <p className="account-subtitle">
              Manage your personal credentials, contact email, and verified pickup details for Mangala Enterprises.
            </p>
          </div>

          {isAuthLoading ? (
            <div className="account-loading-box">
              <div className="spinner" />
              <p>Verifying credentials...</p>
            </div>
          ) : !isAuthenticated ? (
            /* Unauthenticated State */
            <div className="account-unauth-card">
              <div className="unauth-icon-badge">🌿</div>
              <h2>Sign in to view your account</h2>
              <p>Access your saved customer profile, active counter orders, and pickup receipts.</p>
              <button
                type="button"
                className="btn-primary account-signin-btn"
                onClick={() => setIsAuthModalOpen(true)}
              >
                Sign In with Mobile OTP
              </button>
            </div>
          ) : isLoadingProfile ? (
            <div className="account-loading-box">
              <div className="spinner" />
              <p>Loading your profile details...</p>
            </div>
          ) : (
            /* Authenticated Account Dashboard */
            <div className="account-layout">
              {/* Left Column: Navigation & Quick Shortcuts */}
              <aside className="account-sidebar">
                <div className="account-user-card">
                  <div className="account-avatar">
                    {(profile?.fullName || 'M')[0].toUpperCase()}
                  </div>
                  <div className="account-user-details">
                    <h3 className="account-user-name">{profile?.fullName || 'Valued Patron'}</h3>
                    <span className="account-user-phone">{profile?.phone}</span>
                  </div>
                </div>

                <nav className="account-nav-menu">
                  <Link href="/account" className="account-nav-item active">
                    <span className="nav-item-icon">👤</span>
                    <span>Account Profile</span>
                  </Link>
                  <Link href="/orders" className="account-nav-item">
                    <span className="nav-item-icon">📦</span>
                    <span>Orders & Receipts</span>
                  </Link>
                  <Link href="/#menu" className="account-nav-item">
                    <span className="nav-item-icon">🛍️</span>
                    <span>Browse Delicacies</span>
                  </Link>
                </nav>

                {/* Subtle Redesigned Sign-Out Button */}
                <div className="account-signout-wrapper">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="btn-signout-refined"
                    aria-label="Sign out of account"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </aside>

              {/* Right Column: Detailed Profile Form & Information */}
              <section className="account-content-card">
                {saveSuccessMessage && (
                  <div className="alert alert-success" role="alert">
                    <span className="alert-icon">✓</span>
                    <span>{saveSuccessMessage}</span>
                  </div>
                )}

                {profileError && (
                  <div className="alert alert-error" role="alert">
                    <span className="alert-icon">⚠️</span>
                    <span>{profileError}</span>
                  </div>
                )}

                <div className="account-card-header">
                  <div>
                    <h2 className="card-heading">Personal Details</h2>
                    <p className="card-subtext">Review or modify your customer information.</p>
                  </div>
                  {!isEditing && (
                    <button
                      type="button"
                      className="btn-secondary edit-profile-trigger"
                      onClick={handleStartEditing}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  /* Read-Only Mode */
                  <div className="profile-details-grid">
                    <div className="profile-field-item">
                      <span className="field-label">Customer Name</span>
                      <span className="field-value">{profile?.fullName || 'Not specified'}</span>
                    </div>

                    <div className="profile-field-item">
                      <span className="field-label">Registered Mobile Number</span>
                      <div className="field-value-with-badge">
                        <span className="field-value font-mono">{profile?.phone}</span>
                        <span className="verified-badge" title="Phone verified via OTP">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Verified & Locked
                        </span>
                      </div>
                      <span className="field-hint">Primary identification key for counter pickup.</span>
                    </div>

                    <div className="profile-field-item">
                      <span className="field-label">Email Address</span>
                      <span className="field-value">{profile?.email || 'None provided'}</span>
                      <span className="field-hint">Used for electronic receipts and delivery notices.</span>
                    </div>

                    <div className="profile-field-item">
                      <span className="field-label">Member Since</span>
                      <span className="field-value">{formatDate(profile?.createdAt)}</span>
                    </div>
                  </div>
                ) : (
                  /* Edit Profile Form */
                  <form onSubmit={handleSaveProfile} className="profile-edit-form">
                    <div className="form-group">
                      <label htmlFor="account-full-name" className="form-label">
                        Full Name <span className="required-mark">*</span>
                      </label>
                      <input
                        id="account-full-name"
                        type="text"
                        className={`form-input ${formErrors.fullName ? 'has-error' : ''}`}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        disabled={isSaving}
                        autoFocus
                      />
                      {formErrors.fullName && (
                        <span className="form-error-text">{formErrors.fullName}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Registered Phone Number</label>
                      <div className="locked-phone-display">
                        <span className="font-mono">{profile?.phone}</span>
                        <span className="locked-badge">
                          🔒 Verified ID (Cannot be changed)
                        </span>
                      </div>
                      <span className="form-hint">
                        To protect your order history, verified phone numbers cannot be changed online.
                      </span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="account-email" className="form-label">
                        Email Address (Optional)
                      </label>
                      <input
                        id="account-email"
                        type="email"
                        className={`form-input ${formErrors.email ? 'has-error' : ''}`}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        disabled={isSaving}
                      />
                      {formErrors.email && (
                        <span className="form-error-text">{formErrors.email}</span>
                      )}
                      <span className="form-hint">
                        Receive electronic invoices and handover readiness alerts.
                      </span>
                    </div>

                    <div className="form-actions-row">
                      <button
                        type="button"
                        className="btn-secondary form-cancel-btn"
                        onClick={handleCancelClick}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-primary form-save-btn"
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving Changes...' : 'Save Profile'}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Unsaved Changes Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="discard-title">
          <div className="modal-card discard-modal-card">
            <div className="modal-header">
              <h3 id="discard-title">Discard Unsaved Changes?</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowDiscardConfirm(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>You have unsaved changes in your profile. Are you sure you want to discard them?</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDiscardConfirm(false)}
              >
                Continue Editing
              </button>
              <button
                type="button"
                className="btn-primary discard-confirm-btn"
                onClick={handleConfirmDiscard}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo, type ReactElement } from 'react';
import Link from 'next/link';
import { formatPaiseToRupees, type Order } from '@orange/api-contracts';
import { fetchCustomerOrdersApi } from '../../lib/api';
import { useCustomerAuth } from '../../lib/auth';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { AuthModal } from '../../components/AuthModal';

export default function CustomerOrdersPage(): ReactElement {
  const { session, isAuthenticated, isLoading: isAuthLoading } = useCustomerAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [searchRef, setSearchRef] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadOrders = useCallback(async (silent = false) => {
    if (!session?.accessToken) return;
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerOrdersApi(session.accessToken);
      setOrders(data);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load your boutique orders.';
      if (!silent) setError(msg);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.accessToken) {
      loadOrders();
    }
  }, [session, loadOrders]);

  // Real-time polling every 12 seconds if active orders are in flight
  useEffect(() => {
    if (!session?.accessToken || !autoRefresh) return;
    const interval = setInterval(() => {
      loadOrders(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [session, autoRefresh, loadOrders]);

  // Filtered orders by search query
  const filteredOrders = useMemo(() => {
    if (!searchRef.trim()) return orders;
    const q = searchRef.trim().toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.items || []).some((it) => it.productNameSnapshot.toLowerCase().includes(q))
    );
  }, [orders, searchRef]);

  // Helper for Stepper Progress
  function getStepIndex(status: string): number {
    const s = status.toLowerCase();
    if (s === 'draft') return 0;
    if (s === 'confirmed') return 1;
    if (s === 'preparing') return 2;
    if (s === 'ready_for_pickup') return 3;
    if (s === 'completed') return 4;
    return 0; // cancelled
  }

  function getStatusBadge(status: string) {
    const s = status.toLowerCase();
    let bg = 'rgba(100, 116, 139, 0.2)';
    let text = '#94A3B8';
    let border = '1px solid #475569';
    let label = status.replace(/_/g, ' ');

    if (s === 'confirmed') {
      bg = 'rgba(59, 130, 246, 0.15)';
      text = '#60A5FA';
      border = '1px solid rgba(59, 130, 246, 0.4)';
      label = 'Order Confirmed';
    } else if (s === 'preparing') {
      bg = 'rgba(217, 119, 6, 0.2)';
      text = '#FBBF24';
      border = '1px solid rgba(217, 119, 6, 0.5)';
      label = '📦 Order Packed';
    } else if (s === 'ready_for_pickup') {
      bg = 'rgba(16, 185, 129, 0.2)';
      text = '#34D399';
      border = '1px solid rgba(16, 185, 129, 0.6)';
      label = '🎉 Ready for Counter Pickup';
    } else if (s === 'completed') {
      bg = 'rgba(99, 102, 241, 0.15)';
      text = '#A5B4FC';
      border = '1px solid rgba(99, 102, 241, 0.4)';
      label = '🤝 Handed Over';
    } else if (s === 'cancelled') {
      bg = 'rgba(239, 68, 68, 0.15)';
      text = '#F87171';
      border = '1px solid rgba(239, 68, 68, 0.4)';
      label = 'Cancelled';
    } else if (s === 'draft') {
      bg = 'rgba(245, 158, 11, 0.15)';
      text = '#FCD34D';
      border = '1px solid rgba(245, 158, 11, 0.4)';
      label = 'Pending Payment';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.3rem 0.75rem',
          borderRadius: '9999px',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          backgroundColor: bg,
          color: text,
          border: border,
        }}
      >
        {label}
      </span>
    );
  }

  function getPaymentBadge(paymentStatus: string, paymentMethod: string) {
    const s = paymentStatus.toLowerCase();
    const isPaid = s === 'paid' || s === 'captured';
    const isUnpaid = s === 'unpaid' || s === 'pending';
    const isFailed = s === 'failed';

    let bg = 'rgba(100, 116, 139, 0.2)';
    let text = '#94A3B8';
    let border = '1px solid #475569';
    let label = paymentStatus.toUpperCase();

    if (isPaid) {
      bg = 'rgba(16, 185, 129, 0.15)';
      text = '#34D399';
      border = '1px solid rgba(16, 185, 129, 0.4)';
      label = 'PAID ONLINE (RAZORPAY) ✓';
    } else if (isUnpaid && paymentMethod === 'cash_at_pickup') {
      bg = 'rgba(215, 163, 74, 0.15)';
      text = 'var(--color-gold, #D7A34A)';
      border = '1px solid rgba(215, 163, 74, 0.4)';
      label = 'CASH / UPI AT COUNTER';
    } else if (isUnpaid) {
      bg = 'rgba(245, 158, 11, 0.15)';
      text = '#FCD34D';
      border = '1px solid rgba(245, 158, 11, 0.4)';
      label = 'PAYMENT PENDING';
    } else if (isFailed) {
      bg = 'rgba(239, 68, 68, 0.15)';
      text = '#F87171';
      border = '1px solid rgba(239, 68, 68, 0.4)';
      label = 'PAYMENT FAILED ⚠️';
    }

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '0.25rem 0.65rem',
          borderRadius: '6px',
          fontSize: '0.74rem',
          fontWeight: 700,
          backgroundColor: bg,
          color: text,
          border: border,
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <>
      <Header />
      <main
        style={{
          minHeight: '75vh',
          backgroundColor: 'var(--color-canvas, #040D12)',
          color: 'var(--color-text-main, #F6F1E7)',
          padding: '2.5rem 1rem 4rem 1rem',
        }}
      >
        <div style={{ maxWidth: '880px', margin: '0 auto' }}>
          {/* Back link & Top Action Controls */}
          <div
            style={{
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'var(--color-gold, #D7A34A)',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              ← Back to Boutique Storefront
            </Link>

            {isAuthenticated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => loadOrders(false)}
                  disabled={isLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'var(--color-surface-elevated, #0F2532)',
                    border: '1px solid var(--color-card-border, #1D3545)',
                    color: 'var(--color-text-main, #F6F1E7)',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Refresh order statuses"
                >
                  <span>🔄</span>
                  <span>{isLoading ? 'Updating...' : 'Refresh Status'}</span>
                </button>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted, #94A3B8)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    style={{ accentColor: 'var(--color-gold, #D7A34A)' }}
                  />
                  <span>Live Updates</span>
                </label>
              </div>
            )}
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '2rem' }}>
            <h1
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                color: 'var(--color-text-main, #F6F1E7)',
                letterSpacing: '-0.02em',
                marginBottom: '0.4rem',
              }}
            >
              Order Tracking & Boutique History
            </h1>
            <p style={{ color: 'var(--color-text-muted, #94A3B8)', fontSize: '0.95rem' }}>
              Real-time tracker for in-store display reservations, packaging updates, and counter collection.
            </p>
          </div>

          {/* Unauthenticated State */}
          {!isAuthLoading && !isAuthenticated && (
            <div
              style={{
                backgroundColor: 'var(--color-surface, #0A1922)',
                border: '1px solid var(--color-card-border, #1D3545)',
                borderRadius: '16px',
                padding: '3.5rem 2rem',
                textAlign: 'center',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text-main, #F6F1E7)' }}>
                Sign in to Track Your Orders
              </h2>
              <p
                style={{
                  color: 'var(--color-text-muted, #94A3B8)',
                  marginBottom: '1.75rem',
                  fontSize: '0.95rem',
                  maxWidth: '520px',
                  margin: '0 auto 1.75rem auto',
                }}
              >
                Enter your mobile number to view your active order timeline, receipt records, and receive instant handover at our boutique display counter.
              </p>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="btn-primary"
                style={{
                  padding: '0.85rem 2.2rem',
                  fontWeight: 700,
                  fontSize: '1rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>Sign In with Mobile OTP</span>
                <span>→</span>
              </button>
            </div>
          )}

          {/* Loading State */}
          {(isAuthLoading || (isLoading && orders.length === 0)) && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', animation: 'spin 2s infinite linear' }}>🌿</div>
              <p style={{ color: 'var(--color-text-muted, #94A3B8)', fontSize: '1rem' }}>
                Synchronizing boutique counter orders...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1.5px solid #EF4444',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <p style={{ color: '#FCA5A5', fontSize: '0.92rem', margin: 0 }}>{error}</p>
              </div>
              <button
                type="button"
                onClick={() => loadOrders(false)}
                style={{
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Authenticated Orders List */}
          {isAuthenticated && !isAuthLoading && orders.length > 0 && (
            <div>
              {/* Order Search Filter */}
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search by Order Reference # (e.g. #MO-1001)..."
                    value={searchRef}
                    onChange={(e) => setSearchRef(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem 0.75rem 2.5rem',
                      background: 'var(--color-surface, #0A1922)',
                      border: '1px solid var(--color-card-border, #1D3545)',
                      borderRadius: '10px',
                      color: 'var(--color-text-main, #F6F1E7)',
                      fontSize: '0.9rem',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted, #94A3B8)',
                      fontSize: '0.9rem',
                    }}
                  >
                    🔍
                  </span>
                </div>
                {searchRef && (
                  <button
                    type="button"
                    onClick={() => setSearchRef('')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-muted, #94A3B8)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {filteredOrders.length === 0 ? (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface, #0A1922)',
                    border: '1px solid var(--color-card-border, #1D3545)',
                    borderRadius: '12px',
                    padding: '2.5rem',
                    textAlign: 'center',
                    color: 'var(--color-text-muted, #94A3B8)',
                  }}
                >
                  No orders found matching &ldquo;{searchRef}&rdquo;.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {filteredOrders.map((order) => {
                    const stepIdx = getStepIndex(order.orderStatus);
                    const isCancelled = order.orderStatus.toLowerCase() === 'cancelled';
                    const isReady = order.orderStatus.toLowerCase() === 'ready_for_pickup';

                    // Calculate fill width for progress bar: 4 steps total (0%, 33%, 66%, 100%)
                    const fillPercent = isCancelled
                      ? 0
                      : stepIdx === 1
                      ? 15
                      : stepIdx === 2
                      ? 50
                      : stepIdx === 3
                      ? 82
                      : stepIdx >= 4
                      ? 100
                      : 0;

                    return (
                      <article key={order.id} className="order-tracking-card">
                        {/* Header Row */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            borderBottom: '1px solid var(--color-card-border, #1D3545)',
                            paddingBottom: '1.25rem',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: '1.2rem',
                                  color: 'var(--color-gold, #D7A34A)',
                                  letterSpacing: '-0.01em',
                                }}
                              >
                                #{order.orderNumber}
                              </span>
                              {getStatusBadge(order.orderStatus)}
                            </div>
                            <div
                              style={{
                                fontSize: '0.82rem',
                                color: 'var(--color-text-muted, #94A3B8)',
                                marginTop: '0.35rem',
                              }}
                            >
                              Ordered on{' '}
                              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: '1.25rem',
                                color: 'var(--color-gold, #D7A34A)',
                              }}
                            >
                              {formatPaiseToRupees(order.totalAmount)}
                            </div>
                            <div style={{ marginTop: '0.35rem' }}>
                              {getPaymentBadge(order.paymentStatus, order.paymentMethod)}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Visual Order Progress Stepper */}
                        {!isCancelled ? (
                          <div className="order-stepper-container">
                            <div className="stepper-progress-bar">
                              <div
                                className="stepper-progress-fill"
                                style={{ width: `calc(${fillPercent}% - 48px)` }}
                              />

                              {/* Step 1: Confirmed */}
                              <div
                                className={`stepper-step-node ${
                                  stepIdx > 1 ? 'completed' : stepIdx === 1 ? 'active' : ''
                                }`}
                              >
                                <div className="stepper-node-circle">{stepIdx > 1 ? '✓' : '1'}</div>
                                <div className="stepper-step-label">Order Confirmed</div>
                                <div className="stepper-step-desc">Stock Reserved in Vitrine</div>
                              </div>

                              {/* Step 2: Order Packed */}
                              <div
                                className={`stepper-step-node ${
                                  stepIdx > 2 ? 'completed' : stepIdx === 2 ? 'active' : ''
                                }`}
                              >
                                <div className="stepper-node-circle">{stepIdx > 2 ? '✓' : '2'}</div>
                                <div className="stepper-step-label">Order Packed</div>
                                <div className="stepper-step-desc">Counter Packaging</div>
                              </div>

                              {/* Step 3: Ready for Pickup */}
                              <div
                                className={`stepper-step-node ${
                                  stepIdx > 3 ? 'completed' : stepIdx === 3 ? 'active' : ''
                                }`}
                              >
                                <div className="stepper-node-circle">{stepIdx > 3 ? '✓' : '3'}</div>
                                <div className="stepper-step-label">Ready for Pickup</div>
                                <div className="stepper-step-desc">Display Counter Pickup</div>
                              </div>

                              {/* Step 4: Handed Over */}
                              <div className={`stepper-step-node ${stepIdx >= 4 ? 'completed' : ''}`}>
                                <div className="stepper-node-circle">{stepIdx >= 4 ? '✓' : '4'}</div>
                                <div className="stepper-step-label">Handed Over</div>
                                <div className="stepper-step-desc">Order Completed</div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              margin: '1.25rem 0',
                              padding: '1rem',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid #EF4444',
                              color: '#F87171',
                              fontSize: '0.88rem',
                            }}
                          >
                            <strong>Order Cancelled:</strong> This order has been cancelled and reservations released.
                          </div>
                        )}

                        {/* Special Ready-for-Pickup Highlight Callout */}
                        {isReady && (
                          <div className="counter-handover-callout">
                            <span className="handover-callout-icon">🎉</span>
                            <div>
                              <div className="handover-callout-title">
                                PACKED & WAITING AT BOUTIQUE COUNTER
                              </div>
                              <div className="handover-callout-copy">
                                Your order is pre-packed and ready in our display vitrine. Please present Order Reference{' '}
                                <strong style={{ color: 'var(--color-gold, #D7A34A)' }}>#{order.orderNumber}</strong> to our counter host for instant zero-wait handover.
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Items Snapshot */}
                        {order.items && order.items.length > 0 && (
                          <div style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--color-text-muted, #94A3B8)',
                                marginBottom: '0.6rem',
                              }}
                            >
                              Reserved Confections ({order.items.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {order.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.9rem',
                                    color: 'var(--color-text-body, #E2E8F0)',
                                    padding: '0.4rem 0',
                                    borderBottom: '1px dashed rgba(29, 53, 69, 0.5)',
                                  }}
                                >
                                  <span>
                                    <strong style={{ fontWeight: 700, color: 'var(--color-gold, #D7A34A)' }}>
                                      {it.quantity}×
                                    </strong>{' '}
                                    {it.productNameSnapshot}
                                  </span>
                                  <span style={{ fontWeight: 600 }}>{formatPaiseToRupees(it.lineTotal)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fulfillment Info Footer */}
                        <div
                          style={{
                            backgroundColor: 'var(--color-surface-elevated, #0F2532)',
                            borderRadius: '8px',
                            padding: '0.75rem 1rem',
                            fontSize: '0.84rem',
                            color: 'var(--color-text-muted, #94A3B8)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            marginTop: '0.75rem',
                          }}
                        >
                          <div>
                            <strong style={{ color: 'var(--color-text-main, #F6F1E7)' }}>Collection Mode:</strong>{' '}
                            {order.fulfillmentType === 'immediate'
                              ? 'Immediate In-Store Counter Handover'
                              : `Scheduled Slot (${new Date(
                                  order.scheduledPickupAt || order.estimatedPickupAt
                                ).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})`}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--color-text-main, #F6F1E7)' }}>Customer:</strong>{' '}
                            {order.customerName} ({order.customerPhone})
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empty Orders State */}
          {isAuthenticated && !isAuthLoading && orders.length === 0 && (
            <div
              style={{
                backgroundColor: 'var(--color-surface, #0A1922)',
                border: '1px solid var(--color-card-border, #1D3545)',
                borderRadius: '16px',
                padding: '3.5rem 2rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text-main, #F6F1E7)' }}>
                No Orders Yet
              </h3>
              <p
                style={{
                  color: 'var(--color-text-muted, #94A3B8)',
                  marginBottom: '1.75rem',
                  fontSize: '0.92rem',
                  maxWidth: '440px',
                  margin: '0 auto 1.75rem auto',
                }}
              >
                You haven&apos;t placed any orders yet. Explore our handcrafted display vitrine cakes, juices, and chocolates.
              </p>
              <Link
                href="/"
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontSize: '0.92rem',
                }}
              >
                <span>Browse Display Vitrine</span>
                <span>→</span>
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}

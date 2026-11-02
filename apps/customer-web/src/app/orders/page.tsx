'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';
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

  const loadOrders = useCallback(async () => {
    if (!session?.accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerOrdersApi(session.accessToken);
      setOrders(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load your orders.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.accessToken) {
      loadOrders();
    }
  }, [session, loadOrders]);

  function getStatusBadge(status: string) {
    const s = status.toLowerCase();
    let bg = '#F3F4F6';
    let text = '#374151';
    let label = status;

    if (s === 'confirmed') {
      bg = '#DCFCE7';
      text = '#15803D';
      label = 'Confirmed';
    } else if (s === 'ready_for_pickup') {
      bg = '#DBEAFE';
      text = '#1D4ED8';
      label = 'Ready for Pickup';
    } else if (s === 'completed') {
      bg = '#E0E7FF';
      text = '#4338CA';
      label = 'Completed';
    } else if (s === 'cancelled') {
      bg = '#FEE2E2';
      text = '#B91C1C';
      label = 'Cancelled';
    } else if (s === 'draft') {
      bg = '#FEF3C7';
      text = '#92400E';
      label = 'Draft / Pending Payment';
    }

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '0.25rem 0.6rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          backgroundColor: bg,
          color: text,
        }}
      >
        {label}
      </span>
    );
  }

  function getPaymentBadge(paymentStatus: string, paymentMethod: string) {
    const isPaid = paymentStatus === 'paid';
    const isUnpaid = paymentStatus === 'unpaid';
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: 600,
          backgroundColor: isPaid ? '#DCFCE7' : isUnpaid ? '#FEF3C7' : '#F3F4F6',
          color: isPaid ? '#166534' : isUnpaid ? '#9A3412' : '#4B5563',
        }}
      >
        {paymentMethod === 'cash_at_pickup' ? 'Cash at Pickup' : 'Online Payment'} •{' '}
        {paymentStatus.toUpperCase()}
      </span>
    );
  }

  return (
    <>
      <Header />
      <main
        style={{
          minHeight: '70vh',
          backgroundColor: 'var(--color-canvas, #FAF6F0)',
          padding: '2.5rem 1rem',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'var(--color-text-muted, #78716C)',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              ← Back to Boutique Menu
            </Link>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: 'var(--color-text-main, #1C1917)',
                letterSpacing: '-0.02em',
              }}
            >
              My Orders
            </h1>
            <p style={{ color: 'var(--color-text-muted, #78716C)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
              Track the status of your artisanal treats and boutique pickups.
            </p>
          </div>

          {/* Unauthenticated State */}
          {!isAuthLoading && !isAuthenticated && (
            <div
              style={{
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-card-border, #EFE7DC)',
                borderRadius: '12px',
                padding: '3rem 2rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔐</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Sign in to view your orders
              </h2>
              <p style={{ color: 'var(--color-text-muted, #78716C)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                Verify your Indian mobile number via OTP to see your order history and live pickup statuses.
              </p>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                style={{
                  backgroundColor: 'var(--color-primary, #FF5500)',
                  color: '#FFFFFF',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Sign In with Mobile OTP
              </button>
            </div>
          )}

          {/* Loading State */}
          {(isAuthLoading || isLoading) && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍊</div>
              <p style={{ color: 'var(--color-text-muted, #78716C)' }}>Loading your boutique orders...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <p style={{ color: '#B91C1C', fontSize: '0.9rem', margin: 0 }}>{error}</p>
              <button
                type="button"
                onClick={loadOrders}
                style={{
                  backgroundColor: '#B91C1C',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Authenticated Orders List */}
          {isAuthenticated && !isLoading && (
            <div>
              {orders.length === 0 ? (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    border: '1px solid var(--color-card-border, #EFE7DC)',
                    borderRadius: '12px',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🛍️</div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>No orders yet</h3>
                  <p style={{ color: 'var(--color-text-muted, #78716C)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    You have not placed any orders yet. Explore our handcrafted cakes, juices, and chocolates.
                  </p>
                  <Link
                    href="/"
                    style={{
                      display: 'inline-block',
                      backgroundColor: 'var(--color-primary, #FF5500)',
                      color: '#FFFFFF',
                      padding: '0.7rem 1.5rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                    }}
                  >
                    Browse Boutique Menu
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      style={{
                        backgroundColor: 'var(--color-surface, #FFFFFF)',
                        border: '1px solid var(--color-card-border, #EFE7DC)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          borderBottom: '1px solid var(--color-card-border, #EFE7DC)',
                          paddingBottom: '1rem',
                          marginBottom: '1rem',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1C1917' }}>
                              #{order.orderNumber}
                            </span>
                            {getStatusBadge(order.orderStatus)}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #78716C)', marginTop: '0.25rem' }}>
                            Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--color-primary, #FF5500)' }}>
                            {formatPaiseToRupees(order.totalAmount)}
                          </div>
                          <div style={{ marginTop: '0.25rem' }}>
                            {getPaymentBadge(order.paymentStatus, order.paymentMethod)}
                          </div>
                        </div>
                      </div>

                      {/* Items */}
                      {order.items && order.items.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--color-text-muted, #78716C)',
                              marginBottom: '0.5rem',
                            }}
                          >
                            Items ({order.items.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {order.items.map((it, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.9rem',
                                  color: 'var(--color-text-body, #44403C)',
                                }}
                              >
                                <span>
                                  <strong style={{ fontWeight: 600 }}>{it.quantity}x</strong> {it.productNameSnapshot}
                                </span>
                                <span style={{ fontWeight: 600 }}>{formatPaiseToRupees(it.lineTotal)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fulfillment info */}
                      <div
                        style={{
                          backgroundColor: 'var(--color-canvas, #FAF6F0)',
                          borderRadius: '8px',
                          padding: '0.75rem 1rem',
                          fontSize: '0.85rem',
                          color: 'var(--color-text-body, #44403C)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <strong>Fulfillment:</strong>{' '}
                          {order.fulfillmentType === 'immediate'
                            ? 'Immediate Counter Pickup (15-20 min)'
                            : `Scheduled Pickup (${new Date(order.scheduledPickupAt || order.estimatedPickupAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})`}
                        </div>
                        {order.specialNotes && (
                          <div style={{ width: '100%', fontSize: '0.8rem', color: '#666' }}>
                            <em>Note: &quot;{order.specialNotes}&quot;</em>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}

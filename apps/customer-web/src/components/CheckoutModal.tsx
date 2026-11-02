'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import { formatPaiseToRupees, type ValidateCartResponse, type CheckoutResponse } from '@orange/api-contracts';
import { useCart } from '../lib/cart';
import { useCustomerAuth } from '../lib/auth';
import { validateCartApi, checkoutOrderApi } from '../lib/api';
import { AuthModal } from './AuthModal';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps): ReactElement | null {
  const { items, clearCart } = useCart();
  const { session, isAuthenticated } = useCustomerAuth();

  const [fulfillment, setFulfillment] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledTime, setScheduledTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash_at_pickup' | 'online_razorpay'>('cash_at_pickup');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  const [validation, setValidation] = useState<ValidateCartResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmedOrder, setConfirmedOrder] = useState<CheckoutResponse | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Reset idempotency key when cart contents change
  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [items]);

  // Sync customer details from authenticated session
  useEffect(() => {
    if (session) {
      if (session.user.fullName && !customerName) setCustomerName(session.user.fullName);
      if (session.user.phone && !customerPhone) setCustomerPhone(session.user.phone);
    }
  }, [session, customerName, customerPhone]);

  // Validate cart on opening
  useEffect(() => {
    if (isOpen && items.length > 0 && !confirmedOrder) {
      setIsValidating(true);
      setError(null);
      validateCartApi(items.map((i) => ({ productId: i.product.id, quantity: i.quantity })))
        .then((res) => {
          setValidation(res);
          setIsValidating(false);
        })
        .catch((err) => {
          setError(err.message || 'Unable to revalidate prices and availability.');
          setIsValidating(false);
        });
    }
  }, [isOpen, items, confirmedOrder]);

  if (!isOpen) return null;

  // If not logged in, prompt AuthModal
  if (!isAuthenticated && !confirmedOrder) {
    return (
      <AuthModal
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={() => {
          // Re-renders with authenticated session
        }}
      />
    );
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }

    if (items.length === 0) {
      setError('Your shopping bag is empty.');
      return;
    }

    if (!customerName.trim()) {
      setError('Please provide a name for pickup.');
      return;
    }

    if (fulfillment === 'scheduled' && !scheduledTime) {
      setError('Please select a scheduled pickup time.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      const idempotencyKey = idempotencyKeyRef.current;
      const scheduledIso =
        fulfillment === 'scheduled' && scheduledTime
          ? new Date(scheduledTime).toISOString()
          : null;

      const orderResult = await checkoutOrderApi(
        {
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          fulfillment,
          scheduledPickupAt: scheduledIso,
          paymentMethod,
          customerName: customerName.trim(),
          customerPhone: customerPhone || session.user.phone,
          specialNotes: specialNotes.trim() || undefined,
        },
        session.accessToken,
        idempotencyKey
      );

      setConfirmedOrder(orderResult);
      idempotencyKeyRef.current = null;
      clearCart();
      setIsSubmitting(false);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const message = err instanceof Error ? err.message : 'Failed to complete checkout. Please try again.';
      setError(message);
    }
  }

  function handleCloseAll() {
    setConfirmedOrder(null);
    onClose();
  }

  return (
    <>
      <div
        className="drawer-backdrop"
        onClick={handleCloseAll}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
      >
        <div
          className="drawer-panel"
          style={{ maxWidth: '540px', margin: 'auto', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="brand-logo-mark" style={{ width: '1.5rem', height: '1.5rem' }}>
                🍊
              </span>
              <h2 className="drawer-title">
                {confirmedOrder ? 'Order Confirmed!' : 'Boutique Pickup Checkout'}
              </h2>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={handleCloseAll}
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

            {/* ORDER CONFIRMATION SCREEN */}
            {confirmedOrder ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#E8F5E9',
                    color: '#2E7D32',
                    fontSize: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}
                >
                  ✓
                </div>

                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1B1817' }}>
                  Thank You, {customerName}!
                </h3>

                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                  Your boutique order has been received and stock has been reserved.
                </p>

                <div
                  style={{
                    background: '#FAFAF7',
                    border: '1px solid #E5E0DB',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: '#777' }}>Order Reference</span>
                    <strong style={{ fontSize: '0.95rem', color: '#D9531E' }}>{confirmedOrder.orderNumber}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: '#777' }}>Order Status</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        background: confirmedOrder.orderStatus === 'confirmed' ? '#E8F5E9' : '#FFF3E0',
                        color: confirmedOrder.orderStatus === 'confirmed' ? '#2E7D32' : '#E65100',
                      }}
                    >
                      {confirmedOrder.orderStatus}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: '#777' }}>Payment</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {paymentMethod === 'cash_at_pickup' ? 'Cash at Boutique Counter' : 'Online Payment (Draft)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: '#777' }}>Total to Pay</span>
                    <strong style={{ fontSize: '1.1rem', color: '#1B1817' }}>
                      {formatPaiseToRupees(confirmedOrder.totalAmount)}
                    </strong>
                  </div>

                  <div
                    style={{
                      borderTop: '1px dashed #DDD',
                      paddingTop: '0.75rem',
                      fontSize: '0.8rem',
                      color: '#555',
                      lineHeight: '1.4',
                    }}
                  >
                    📍 <strong>Boutique Counter Collection:</strong> Please show order reference{' '}
                    <strong>{confirmedOrder.orderNumber}</strong> at the shop counter.
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCloseAll}
                  style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
                >
                  Continue Browsing
                </button>
              </div>
            ) : (
              /* CHECKOUT FORM */
              <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. Fulfillment Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    1. Counter Pickup Option
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setFulfillment('immediate')}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: fulfillment === 'immediate' ? '2px solid #D9531E' : '1px solid #DDD',
                        background: fulfillment === 'immediate' ? '#FFF5F0' : '#FFF',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>⚡ Immediate Pickup</strong>
                      <span style={{ fontSize: '0.75rem', color: '#666' }}>Ready in ~15-20 mins</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFulfillment('scheduled')}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: fulfillment === 'scheduled' ? '2px solid #D9531E' : '1px solid #DDD',
                        background: fulfillment === 'scheduled' ? '#FFF5F0' : '#FFF',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>📅 Scheduled Slot</strong>
                      <span style={{ fontSize: '0.75rem', color: '#666' }}>Select pickup time</span>
                    </button>
                  </div>

                  {fulfillment === 'scheduled' && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <input
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          border: '1px solid #DDD',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* 2. Customer Contact */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    2. Pickup Contact Information
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <input
                      type="text"
                      placeholder="Your Full Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      style={{
                        padding: '0.65rem',
                        border: '1px solid #DDD',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                      }}
                    />
                    <input
                      type="tel"
                      placeholder="Mobile Phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                      style={{
                        padding: '0.65rem',
                        border: '1px solid #DDD',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>
                </div>

                {/* 3. Payment Method */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    3. Payment Method
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash_at_pickup')}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: paymentMethod === 'cash_at_pickup' ? '2px solid #D9531E' : '1px solid #DDD',
                        background: paymentMethod === 'cash_at_pickup' ? '#FFF5F0' : '#FFF',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>💵 Cash at Pickup</strong>
                      <span style={{ fontSize: '0.75rem', color: '#666' }}>Pay at boutique counter</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('online_razorpay')}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: paymentMethod === 'online_razorpay' ? '2px solid #D9531E' : '1px solid #DDD',
                        background: paymentMethod === 'online_razorpay' ? '#FFF5F0' : '#FFF',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>💳 Online Draft</strong>
                      <span style={{ fontSize: '0.75rem', color: '#666' }}>Reserve with 10m hold</span>
                    </button>
                  </div>
                </div>

                {/* 4. Special Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>
                    Special Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Please pack extra serviettes"
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      border: '1px solid #DDD',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* 5. Authoritative Server Total Breakdown */}
                <div
                  style={{
                    backgroundColor: '#FAFAF7',
                    border: '1px solid #E5E0DB',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                    <span>Items Subtotal</span>
                    <span>{validation ? formatPaiseToRupees(validation.subtotalAmount) : 'Calculating...'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                    <span>GST (5%)</span>
                    <span>{validation ? formatPaiseToRupees(validation.taxAmount) : 'Calculating...'}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                      fontSize: '1rem',
                      borderTop: '1px solid #E0DCD7',
                      paddingTop: '0.5rem',
                      color: '#1B1817',
                    }}
                  >
                    <span>Total Amount</span>
                    <span style={{ color: '#D9531E' }}>
                      {validation ? formatPaiseToRupees(validation.totalAmount) : '...'}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={Boolean(isSubmitting || isValidating || (validation && !validation.isValid))}
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 700 }}
                >
                  {isSubmitting ? 'Placing Order...' : 'Place Order & Reserve Items'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}

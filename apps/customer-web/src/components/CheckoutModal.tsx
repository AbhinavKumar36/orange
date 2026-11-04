'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import { formatPaiseToRupees, type ValidateCartResponse, type CheckoutResponse } from '@orange/api-contracts';
import { useCart } from '../lib/cart';
import { useCustomerAuth } from '../lib/auth';
import { validateCartApi, checkoutOrderApi, initiatePaymentApi, verifyPaymentApi } from '../lib/api';
import { loadRazorpayScript } from '../lib/razorpay';
import { AuthModal } from './AuthModal';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (resp: { error?: { description?: string; code?: string; step?: string } }) => void) => void;
    };
  }
}

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
  const [pendingOnlineOrder, setPendingOnlineOrder] = useState<CheckoutResponse | null>(null);
  const [paymentStep, setPaymentStep] = useState<
    'idle' | 'initiating' | 'gateway_open' | 'verifying' | 'failed'
  >('idle');
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

  async function launchRazorpayCheckout(targetOrder: CheckoutResponse) {
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setPaymentStep('initiating');

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        throw new Error('Unable to load payment gateway SDK. Please verify internet connection.');
      }

      const initData = await initiatePaymentApi(targetOrder.orderId, session.accessToken);
      setPaymentStep('gateway_open');

      const rzp = new window.Razorpay({
        key: initData.keyId,
        amount: initData.amount,
        currency: initData.currency,
        name: 'Moody Orange',
        description: `Boutique Order #${targetOrder.orderNumber}`,
        order_id: initData.razorpayOrderId,
        prefill: {
          name: initData.customerName,
          contact: initData.customerPhone,
        },
        theme: {
          color: '#f97316',
        },
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          setPaymentStep('verifying');
          try {
            const verifyRes = await verifyPaymentApi(
              {
                orderId: targetOrder.orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
              session.accessToken
            );

            setConfirmedOrder({
              ...targetOrder,
              orderStatus: verifyRes.orderStatus,
              paymentStatus: verifyRes.paymentStatus,
            });
            setPendingOnlineOrder(null);
            setPaymentStep('idle');
            clearCart();
            setIsSubmitting(false);
          } catch (vErr: unknown) {
            const msg = vErr instanceof Error ? vErr.message : 'Server signature verification failed.';
            setError('Payment verification failed on server: ' + msg);
            setPaymentStep('failed');
            setIsSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            setError(
              'Payment window was closed. Your boutique reservation is held. You can retry payment below.'
            );
            setPaymentStep('failed');
            setIsSubmitting(false);
          },
        },
      });

      rzp.on('payment.failed', function (resp: { error?: { description?: string } }) {
        const failReason = resp?.error?.description || 'Payment was declined by payment gateway.';
        setError('Payment Failed: ' + failReason);
        setPaymentStep('failed');
        setIsSubmitting(false);
      });

      rzp.open();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setPaymentStep('failed');
      const msg = err instanceof Error ? err.message : 'Failed to launch payment checkout.';
      setError(msg);
    }
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

      if (paymentMethod === 'online_razorpay') {
        setPendingOnlineOrder(orderResult);
        await launchRazorpayCheckout(orderResult);
      } else {
        setConfirmedOrder(orderResult);
        idempotencyKeyRef.current = null;
        clearCart();
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      const message = err instanceof Error ? err.message : 'Failed to complete checkout. Please try again.';
      setError(message);
    }
  }

  function handleCloseAll() {
    setConfirmedOrder(null);
    setPendingOnlineOrder(null);
    setPaymentStep('idle');
    onClose();
  }

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={handleCloseAll}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
      >
        <div
          className="modal-card checkout-modal-card"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header">
            <div className="modal-title-group">
              <span className="brand-logo-mark" aria-hidden="true">🌿</span>
              <div>
                <h2 className="modal-title">
                  {confirmedOrder ? 'Order Confirmed!' : 'Mangala Enterprises — Counter Checkout'}
                </h2>
                <div className="modal-subtitle">
                  {confirmedOrder ? 'Kitchen stock reserved' : 'Prepared fresh for in-store collection'}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              onClick={handleCloseAll}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="checkout-alert-error" role="alert">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* CONFIRMED ORDER RECEIPT */}
            {confirmedOrder ? (
              <div className="confirmed-order-view">
                <div className="confirmed-icon-circle">
                  ✓
                </div>

                <h3 className="confirmed-title">
                  Thank You, {customerName}!
                </h3>

                <p className="confirmed-subtitle">
                  Your boutique order has been confirmed and kitchen inventory is locked.
                </p>

                <div className="receipt-card">
                  <div className="receipt-row">
                    <span className="receipt-label">Order Reference</span>
                    <strong className="receipt-order-num">{confirmedOrder.orderNumber}</strong>
                  </div>

                  <div className="receipt-row">
                    <span className="receipt-label">Order Status</span>
                    <span className="badge-stock badge-in-stock">
                      {confirmedOrder.orderStatus}
                    </span>
                  </div>

                  <div className="receipt-row">
                    <span className="receipt-label">Payment Mode</span>
                    <span className="receipt-value">
                      {paymentMethod === 'cash_at_pickup' ? 'Cash/UPI at Counter' : 'Online Payment (Draft)'}
                    </span>
                  </div>

                  <div className="receipt-row">
                    <span className="receipt-label">Total to Pay</span>
                    <strong className="receipt-total">
                      {formatPaiseToRupees(confirmedOrder.totalAmount)}
                    </strong>
                  </div>

                  <div className="receipt-pickup-note">
                    📍 <strong>Boutique Counter Collection:</strong> Please show order reference{' '}
                    <strong>{confirmedOrder.orderNumber}</strong> to the counter team upon arrival.
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCloseAll}
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  Return to Storefront
                </button>
              </div>
            ) : pendingOnlineOrder ? (
              <div className="pending-payment-view">
                <div
                  style={{
                    fontSize: '2.5rem',
                    textAlign: 'center',
                    marginBottom: '0.75rem',
                  }}
                >
                  ⏳
                </div>
                <h3 className="confirmed-title" style={{ textAlign: 'center' }}>
                  Online Payment Pending
                </h3>
                <p className="confirmed-subtitle" style={{ textAlign: 'center' }}>
                  Your items are reserved under order #{pendingOnlineOrder.orderNumber}.
                  Please complete payment before the reservation TTL expires.
                </p>

                <div className="receipt-card">
                  <div className="receipt-row">
                    <span className="receipt-label">Order Reference</span>
                    <strong className="receipt-order-num">{pendingOnlineOrder.orderNumber}</strong>
                  </div>
                  <div className="receipt-row">
                    <span className="receipt-label">Amount Payable</span>
                    <strong className="receipt-total">
                      {formatPaiseToRupees(pendingOnlineOrder.totalAmount)}
                    </strong>
                  </div>
                  <div className="receipt-row">
                    <span className="receipt-label">Status</span>
                    <span className="badge-stock badge-low-stock">
                      {paymentStep === 'verifying' ? 'Verifying payment...' : 'Awaiting Payment'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    marginTop: '1.25rem',
                  }}
                >
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isSubmitting || paymentStep === 'verifying'}
                    onClick={() => launchRazorpayCheckout(pendingOnlineOrder)}
                  >
                    {paymentStep === 'verifying'
                      ? 'Verifying Payment with Server...'
                      : paymentStep === 'initiating'
                      ? 'Opening Gateway...'
                      : `Retry Online Payment (${formatPaiseToRupees(pendingOnlineOrder.totalAmount)}) →`}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isSubmitting}
                    onClick={() => {
                      setPendingOnlineOrder(null);
                      setPaymentStep('idle');
                    }}
                  >
                    Modify Cart or Details
                  </button>
                </div>
              </div>
            ) : (
              /* PROGRESSIVE CHECKOUT FORM */
              <form onSubmit={handleSubmitOrder} className="checkout-form">
                {/* 1. Fulfillment Selection */}
                <div className="checkout-field-section">
                  <div className="step-label">
                    <span className="step-num">1</span>
                    <span className="step-title">Counter Pickup Window</span>
                  </div>

                  <div className="fulfillment-grid">
                    <button
                      type="button"
                      onClick={() => setFulfillment('immediate')}
                      className={`fulfillment-option-card ${fulfillment === 'immediate' ? 'active' : ''}`}
                    >
                      <div className="option-title-row">
                        <span className="option-icon">⚡</span>
                        <strong>Immediate Pickup</strong>
                      </div>
                      <span className="option-caption">Ready in ~15-20 mins</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFulfillment('scheduled')}
                      className={`fulfillment-option-card ${fulfillment === 'scheduled' ? 'active' : ''}`}
                    >
                      <div className="option-title-row">
                        <span className="option-icon">📅</span>
                        <strong>Scheduled Slot</strong>
                      </div>
                      <span className="option-caption">Select pickup date & time</span>
                    </button>
                  </div>

                  {fulfillment === 'scheduled' && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <label className="input-field-label">Preferred Pickup Date & Time</label>
                      <input
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        required
                        className="modal-text-input"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Customer Contact */}
                <div className="checkout-field-section">
                  <div className="step-label">
                    <span className="step-num">2</span>
                    <span className="step-title">Customer Information</span>
                  </div>

                  <div className="form-double-col">
                    <div>
                      <label className="input-field-label">Full Name for Counter</label>
                      <input
                        type="text"
                        placeholder="e.g. Maya Sharma"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                        className="modal-text-input"
                      />
                    </div>
                    <div>
                      <label className="input-field-label">Mobile Number</label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        required
                        className="modal-text-input"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Payment Method */}
                <div className="checkout-field-section">
                  <div className="step-label">
                    <span className="step-num">3</span>
                    <span className="step-title">Payment Settlement</span>
                  </div>

                  <div className="fulfillment-grid">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash_at_pickup')}
                      className={`fulfillment-option-card ${paymentMethod === 'cash_at_pickup' ? 'active' : ''}`}
                    >
                      <div className="option-title-row">
                        <span className="option-icon">💵</span>
                        <strong>Pay at Counter</strong>
                      </div>
                      <span className="option-caption">Cash, UPI, or Card upon collection</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('online_razorpay')}
                      className={`fulfillment-option-card ${paymentMethod === 'online_razorpay' ? 'active' : ''}`}
                    >
                      <div className="option-title-row">
                        <span className="option-icon">💳</span>
                        <strong>Online Draft</strong>
                      </div>
                      <span className="option-caption">Reserve with 10-min payment hold</span>
                    </button>
                  </div>
                </div>

                {/* 4. Special Notes */}
                <div className="checkout-field-section">
                  <label className="input-field-label">
                    Special Kitchen Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pack cold juice with ice pack; extra napkins"
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    className="modal-text-input"
                  />
                </div>

                {/* 5. Authoritative Server Total Breakdown */}
                <div className="checkout-breakdown-card">
                  <div className="breakdown-line">
                    <span>Items Subtotal</span>
                    <span>{validation ? formatPaiseToRupees(validation.subtotalAmount) : 'Validating...'}</span>
                  </div>
                  <div className="breakdown-line">
                    <span>GST (5%)</span>
                    <span>{validation ? formatPaiseToRupees(validation.taxAmount) : 'Validating...'}</span>
                  </div>
                  <div className="breakdown-line">
                    <span>Boutique In-Store Packaging</span>
                    <span className="green-text">Free</span>
                  </div>
                  <div className="breakdown-divider" />
                  <div className="breakdown-line total-line">
                    <span>Total Amount</span>
                    <span className="total-price">
                      {validation ? formatPaiseToRupees(validation.totalAmount) : '...'}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={Boolean(isSubmitting || isValidating || (validation && !validation.isValid))}
                  className="btn-primary checkout-submit-btn"
                >
                  {isSubmitting ? 'Reserving Kitchen Stock...' : 'Confirm Order & Reserve Delicacies →'}
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

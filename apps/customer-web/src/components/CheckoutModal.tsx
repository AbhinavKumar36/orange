'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import Link from 'next/link';
import { formatPaiseToRupees, type ValidateCartResponse, type CheckoutResponse } from '@orange/api-contracts';
import { useCart } from '../lib/cart';
import { useCustomerAuth } from '../lib/auth';
import { validateCartApi, checkoutOrderApi, initiatePaymentApi, verifyPaymentApi } from '../lib/api';
import { loadYoupiScript, buildUpiDeepLinks } from '../lib/youpi';
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
  const [paymentMethod, setPaymentMethod] = useState<'cash_at_pickup' | 'online_youpi' | 'online_razorpay'>('cash_at_pickup');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  const [validation, setValidation] = useState<ValidateCartResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmedOrder, setConfirmedOrder] = useState<CheckoutResponse | null>(null);
  const [pendingOnlineOrder, setPendingOnlineOrder] = useState<CheckoutResponse | null>(null);
  const [activeYoupiData, setActiveYoupiData] = useState<{
    youpiPaymentId: string;
    vpa: string;
    qrPayload: string;
    amount: number;
    checkoutUrl: string;
    merchantId: string;
  } | null>(null);
  const [enteredUtr, setEnteredUtr] = useState('');
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [customVpa, setCustomVpa] = useState('');
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

  async function handleVerifyYoupiPayment(targetOrder: CheckoutResponse, youpiId: string, utrInput?: string) {
    if (!session) return;
    setIsSubmitting(true);
    setPaymentStep('verifying');
    setError(null);
    try {
      const verifyRes = await verifyPaymentApi(
        {
          orderId: targetOrder.orderId,
          youpiPaymentId: youpiId,
          utr: utrInput || `utr_${Date.now()}`,
          razorpayOrderId: youpiId,
          razorpayPaymentId: utrInput || `pay_${youpiId}`,
          razorpaySignature: `mock_sig_${youpiId}`,
        },
        session.accessToken
      );

      setConfirmedOrder({
        ...targetOrder,
        orderStatus: verifyRes.orderStatus,
        paymentStatus: verifyRes.paymentStatus,
      });
      setPendingOnlineOrder(null);
      setActiveYoupiData(null);
      setPaymentStep('idle');
      clearCart();
      setIsSubmitting(false);
    } catch (vErr: unknown) {
      const msg = vErr instanceof Error ? vErr.message : 'Payment verification failed.';
      setError('Payment verification failed on server: ' + msg);
      setPaymentStep('failed');
      setIsSubmitting(false);
    }
  }

  async function launchYoupiCheckout(targetOrder: CheckoutResponse) {
    if (!session) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setPaymentStep('initiating');

    try {
      const initData = await initiatePaymentApi(targetOrder.orderId, session.accessToken);
      setPaymentStep('gateway_open');

      const rawVpa = initData.vpa || process.env.NEXT_PUBLIC_YOUPI_VPA || 'itsabhinav36@ibl';
      const resolvedVpa = rawVpa.includes('@') ? rawVpa : `${rawVpa}@upi`;
      setActiveYoupiData({
        youpiPaymentId: initData.youpiPaymentId || initData.razorpayOrderId || '',
        vpa: resolvedVpa,
        qrPayload: initData.qrPayload || `upi://pay?pa=${resolvedVpa}&pn=Moody+Orange&am=${(initData.amount / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(targetOrder.orderNumber)}`,
        amount: initData.amount,
        checkoutUrl: initData.checkoutUrl || '',
        merchantId: initData.merchantId || '',
      });

      const isLoaded = await loadYoupiScript(
        process.env.NEXT_PUBLIC_YOUPI_BASE_URL,
        initData.merchantId
      );

      if (isLoaded && window.Youpi?.pay) {
        window.Youpi.pay({
          orderId: targetOrder.orderNumber,
          amount: (initData.amount / 100).toFixed(2),
          currency: initData.currency,
          checkoutUrl: initData.checkoutUrl,
          onSuccess: async (response: { youpiPaymentId?: string; utr?: string }) => {
            await handleVerifyYoupiPayment(
              targetOrder,
              response?.youpiPaymentId || initData.youpiPaymentId || '',
              response?.utr
            );
          },
          onClose: () => {
            setError(
              'YouPI payment window closed. You can complete payment using the UPI QR below or retry.'
            );
            setPaymentStep('idle');
            setIsSubmitting(false);
          },
        });
      } else {
        // Direct embedded YouPI-PG UPI QR view
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      setPaymentStep('failed');
      const msg = err instanceof Error ? err.message : 'Failed to launch YouPI-PG payment.';
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

    const cleanPhone = (customerPhone.trim() || session.user.phone || '').trim();
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
      setError('Please provide a valid 10-digit mobile number for order notifications.');
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
          customerPhone: cleanPhone,
          specialNotes: specialNotes.trim() || undefined,
        },
        session.accessToken,
        idempotencyKey
      );

      if (paymentMethod === 'online_youpi' || paymentMethod === 'online_razorpay') {
        setPendingOnlineOrder(orderResult);
        await launchYoupiCheckout(orderResult);
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
                  {confirmedOrder ? 'In-Store Display Stock Reserved' : 'Ready in vitrine for immediate counter collection'}
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
                  Your boutique order has been confirmed and reserved from our in-store display counter.
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
                    <span className="receipt-value" style={{ fontWeight: 600, color: confirmedOrder.paymentStatus === 'captured' || (confirmedOrder.paymentStatus as string) === 'paid' ? '#10B981' : 'inherit' }}>
                      {paymentMethod === 'cash_at_pickup'
                        ? 'Cash/UPI at Counter'
                        : confirmedOrder.paymentStatus === 'captured' || (confirmedOrder.paymentStatus as string) === 'paid'
                        ? 'Online Payment (Paid ✓)'
                        : 'Online Payment (Awaiting Capture)'}
                    </span>
                  </div>

                  <div className="receipt-row">
                    <span className="receipt-label">Total Amount</span>
                    <strong className="receipt-total">
                      {formatPaiseToRupees(confirmedOrder.totalAmount)}
                    </strong>
                  </div>

                  <div className="receipt-pickup-note">
                    📍 <strong>Boutique Counter Collection:</strong> Please show order reference{' '}
                    <strong>#{confirmedOrder.orderNumber}</strong> to the counter team upon arrival.
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <Link
                    href="/orders"
                    className="btn-primary"
                    onClick={handleCloseAll}
                    style={{ textAlign: 'center', textDecoration: 'none', padding: '0.8rem 1.25rem' }}
                  >
                    Track Order Live →
                  </Link>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCloseAll}
                    style={{ width: '100%' }}
                  >
                    Continue Browsing Storefront
                  </button>
                </div>
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

                {activeYoupiData && (
                  <div
                    style={{
                      marginTop: '1.25rem',
                      padding: '1rem',
                      background: '#FFF7ED',
                      borderRadius: '8px',
                      border: '1px solid #FFEDD5',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#C2410C', marginBottom: '0.5rem' }}>
                      ⚡ Scan Dynamic UPI QR Code (YouPI-PG)
                    </div>

                    {/* Vector QR Code */}
                    <div style={{ display: 'inline-block', padding: '0.5rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #FED7AA' }}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(activeYoupiData.qrPayload)}`}
                        alt="YouPI UPI QR Code"
                        width={180}
                        height={180}
                        style={{ display: 'block', margin: '0 auto' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.6rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#7C2D12' }}>
                        UPI ID: <strong style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{activeYoupiData.vpa}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(activeYoupiData.vpa);
                          }
                          setCopiedVpa(true);
                          setTimeout(() => setCopiedVpa(false), 2000);
                        }}
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.5rem',
                          background: '#FFFFFF',
                          border: '1px solid #FED7AA',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: '#C2410C',
                        }}
                      >
                        {copiedVpa ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>

                    {/* Quick Bank Handle Switcher */}
                    <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: '#9A3412', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                      <span style={{ fontWeight: 600 }}>Suffix:</span>
                      {['@ibl', '@ybl', '@okaxis', '@okhdfcbank', '@paytm', '@oksbi', '@upi'].map((suffix) => {
                        const baseUser = activeYoupiData.vpa.split('@')[0] || 'itsabhinav36';
                        const newVpa = `${baseUser}${suffix}`;
                        const isCurrent = activeYoupiData.vpa.endsWith(suffix);
                        return (
                          <button
                            key={suffix}
                            type="button"
                            onClick={() => {
                              const amountRupees = (activeYoupiData.amount / 100).toFixed(2);
                              setActiveYoupiData({
                                ...activeYoupiData,
                                vpa: newVpa,
                                qrPayload: `upi://pay?pa=${newVpa}&pn=Moody+Orange&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(pendingOnlineOrder.orderNumber)}`,
                              });
                            }}
                            style={{
                              padding: '0.15rem 0.35rem',
                              fontSize: '0.7rem',
                              borderRadius: '4px',
                              border: isCurrent ? '1.5.dp solid #EA580C' : '1px solid #FED7AA',
                              background: isCurrent ? '#FFEDD5' : '#FFFFFF',
                              color: isCurrent ? '#9A3412' : '#4B5563',
                              cursor: 'pointer',
                              fontWeight: isCurrent ? 700 : 500,
                            }}
                          >
                            {suffix}
                          </button>
                        );
                      })}
                    </div>

                    {/* UPI App Deep Links for Mobile */}
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      {(() => {
                        const links = buildUpiDeepLinks({
                          vpa: activeYoupiData.vpa,
                          payeeName: 'Moody Orange',
                          amountRupees: (activeYoupiData.amount / 100).toFixed(2),
                          orderNumber: pendingOnlineOrder.orderNumber,
                        });
                        return (
                          <>
                            <a href={links.gpay} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>
                              Google Pay
                            </a>
                            <a href={links.phonepe} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>
                              PhonePe
                            </a>
                            <a href={links.paytm} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>
                              Paytm
                            </a>
                            <a href={links.cred} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>
                              CRED
                            </a>
                          </>
                        );
                      })()}
                    </div>

                    {/* Manual UTR Verification Input */}
                    <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4B5563', display: 'block', marginBottom: '0.25rem' }}>
                        12-Digit Bank UTR / Reference No. (Optional for auto-observer):
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="e.g. 431200192831"
                          value={enteredUtr}
                          onChange={(e) => setEnteredUtr(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '0.4rem 0.6rem',
                            border: '1px solid #D1D5DB',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                          }}
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={isSubmitting || paymentStep === 'verifying'}
                          onClick={() => handleVerifyYoupiPayment(pendingOnlineOrder, activeYoupiData.youpiPaymentId, enteredUtr)}
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
                    onClick={() => {
                      if (activeYoupiData) {
                        handleVerifyYoupiPayment(pendingOnlineOrder, activeYoupiData.youpiPaymentId, enteredUtr);
                      } else {
                        launchYoupiCheckout(pendingOnlineOrder);
                      }
                    }}
                  >
                    {paymentStep === 'verifying'
                      ? 'Verifying Payment with Server...'
                      : paymentStep === 'initiating'
                      ? 'Opening Gateway...'
                      : activeYoupiData
                      ? 'I Have Paid / Verify UPI Payment →'
                      : `Launch YouPI-PG Checkout (${formatPaiseToRupees(pendingOnlineOrder.totalAmount)}) →`}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isSubmitting}
                    onClick={() => {
                      setPendingOnlineOrder(null);
                      setActiveYoupiData(null);
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
                {validation && (!validation.isValid || validation.hasOutOfStockItems) && (
                  <div className="out-of-stock-alert-banner" role="alert">
                    <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>Item(s) Out of Stock</div>
                      <div style={{ fontSize: '0.82rem', marginTop: '0.2rem', opacity: 0.95 }}>
                        {validation.items.some((i) => !i.isInStock)
                          ? `The following items are out of stock: ${validation.items
                              .filter((i) => !i.isInStock)
                              .map((i) => i.productName)
                              .join(', ')}. Please adjust your bag.`
                          : 'One or more items in your shopping bag are no longer available in our display counter. Please return to your bag and remove them to continue.'}
                      </div>
                    </div>
                  </div>
                )}

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
                      onClick={() => setPaymentMethod('online_youpi')}
                      className={`fulfillment-option-card ${paymentMethod === 'online_youpi' || paymentMethod === 'online_razorpay' ? 'active' : ''}`}
                    >
                      <div className="option-title-row">
                        <span className="option-icon">⚡</span>
                        <strong>UPI Online (YouPI-PG)</strong>
                      </div>
                      <span className="option-caption">0% fee instant bank settlement via UPI QR / Apps</span>
                    </button>
                  </div>
                </div>

                {/* Special instructions field removed per ready-to-sell counter requirements */}

                {/* 4. Authoritative Server Total Breakdown */}
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
                  {isSubmitting ? 'Reserving In-Store Stock...' : 'Confirm Order & Collect at Counter →'}
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

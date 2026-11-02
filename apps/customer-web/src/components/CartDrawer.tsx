'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { formatPaiseToRupees } from '@orange/api-contracts';
import { useCart } from '../lib/cart';
import { ProductIllustration } from './ProductIllustration';
import { CheckoutModal } from './CheckoutModal';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps): ReactElement | null {
  const { items, subtotal, updateQuantity, removeFromCart } = useCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

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

  if (!isOpen) return null;

  return (
    <>
      <div
        className="drawer-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Bag"
      >
        <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="brand-logo-mark" style={{ width: '1.5rem', height: '1.5rem' }}>
                🍊
              </span>
              <h2 className="drawer-title">Shopping Bag ({items.length})</h2>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Close Shopping Bag"
              style={{ width: '2rem', height: '2rem' }}
            >
              ✕
            </button>
          </div>

          <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 65px)', padding: '1rem' }}>
            {items.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '2rem',
                }}
              >
                <div className="state-icon-circle" style={{ width: '4rem', height: '4rem', marginBottom: '1rem' }}>
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </div>
                <h3 className="state-title" style={{ marginBottom: '0.5rem' }}>
                  Your Bag is Empty
                </h3>
                <p className="state-copy" style={{ fontSize: '0.875rem', marginBottom: '1.5rem', color: '#666' }}>
                  Explore our artisanal cakes, cold-pressed juices, and confections to add treats.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onClose}
                  style={{ width: '100%' }}
                >
                  Explore Boutique Menu
                </button>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {items.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: '1px solid #EFEAE5',
                        background: '#FAFAF8',
                        alignItems: 'center',
                      }}
                    >
                      {/* Thumbnail or Illustration */}
                      <div
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: '#FFF5F0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <ProductIllustration categorySlug={product.categorySlug} name={product.name} />
                        )}
                      </div>

                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4
                          style={{
                            margin: '0 0 0.25rem 0',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: '#1B1817',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {product.name}
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: '#777', marginBottom: '0.35rem' }}>
                          {formatPaiseToRupees(product.basePrice)} each
                        </div>

                        {/* Quantity Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, quantity - 1)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              border: '1px solid #CCC',
                              background: '#FFF',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                            }}
                            aria-label={`Decrease quantity of ${product.name}`}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '18px', textAlign: 'center' }}>
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              border: '1px solid #CCC',
                              background: '#FFF',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                            }}
                            aria-label={`Increase quantity of ${product.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Item Total & Remove */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#D9531E' }}>
                          {formatPaiseToRupees(product.basePrice * quantity)}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(product.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#999',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            marginTop: '0.35rem',
                          }}
                          aria-label={`Remove ${product.name} from bag`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal & Checkout Actions */}
                <div
                  style={{
                    borderTop: '1px solid #EFEAE5',
                    paddingTop: '1rem',
                    marginTop: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', color: '#555' }}>Bag Subtotal</span>
                    <strong style={{ fontSize: '1.1rem', color: '#1B1817' }}>{formatPaiseToRupees(subtotal)}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                    Taxes calculated at counter pickup checkout.
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setIsCheckoutOpen(true)}
                    style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
                  >
                    Proceed to Boutique Checkout →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          onClose();
        }}
      />
    </>
  );
}

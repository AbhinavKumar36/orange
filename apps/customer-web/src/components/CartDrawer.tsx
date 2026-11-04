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

  // Approximate 5% GST on subtotal
  const estimatedTax = Math.round(subtotal * 0.05);
  const estimatedTotal = subtotal + estimatedTax;

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
          {/* Header */}
          <div className="drawer-header">
            <div className="drawer-brand-badge">
              <span className="brand-logo-mark" aria-hidden="true">🌿</span>
              <div>
                <h2 className="drawer-title">Shopping Bag</h2>
                <span className="drawer-count-subtitle">
                  {items.length} {items.length === 1 ? 'creation' : 'creations'} selected
                </span>
              </div>
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={onClose}
              aria-label="Close Shopping Bag"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div className="drawer-body">
            {items.length === 0 ? (
              <div className="empty-cart-state">
                <div className="empty-cart-icon-circle">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </div>
                <h3 className="empty-cart-title">Your Bag is Empty</h3>
                <p className="empty-cart-copy">
                  Explore our artisanal cakes, cold-pressed citrus, and single-origin chocolates to curate your selection.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onClose}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  Browse Menu Catalog
                </button>
              </div>
            ) : (
              <>
                {/* List of Cart Items */}
                <div className="cart-items-scroll">
                  {items.map(({ product, quantity }) => (
                    <div key={product.id} className="cart-item-card">
                      {/* Thumbnail */}
                      <div className="cart-item-thumbnail">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="cart-thumb-img"
                          />
                        ) : (
                          <ProductIllustration
                            categorySlug={product.categorySlug}
                            name={product.name}
                            className="cart-thumb-illustration"
                          />
                        )}
                      </div>

                      {/* Info & Stepper */}
                      <div className="cart-item-details">
                        <div className="cart-item-header">
                          <h4 className="cart-item-name">{product.name}</h4>
                          <span className="cart-item-unit-price">
                            {formatPaiseToRupees(product.basePrice)} each
                          </span>
                        </div>

                        <div className="cart-item-footer">
                          {/* Stepper */}
                          <div className="cart-stepper">
                            <button
                              type="button"
                              className="cart-stepper-btn"
                              onClick={() => updateQuantity(product.id, quantity - 1)}
                              aria-label={`Decrease quantity of ${product.name}`}
                            >
                              –
                            </button>
                            <span className="cart-stepper-val">{quantity}</span>
                            <button
                              type="button"
                              className="cart-stepper-btn"
                              onClick={() => updateQuantity(product.id, quantity + 1)}
                              aria-label={`Increase quantity of ${product.name}`}
                            >
                              +
                            </button>
                          </div>

                          {/* Line total & remove */}
                          <div className="cart-item-price-col">
                            <div className="cart-item-line-total">
                              {formatPaiseToRupees(product.basePrice * quantity)}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(product.id)}
                              className="cart-item-remove-btn"
                              aria-label={`Remove ${product.name} from bag`}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pickup Info Banner */}
                <div className="cart-pickup-banner">
                  <span className="banner-icon">🛍️</span>
                  <div className="banner-text">
                    <strong>In-Store Counter Pickup:</strong> Pre-packed and ready in display vitrine for instant collection.
                  </div>
                </div>

                {/* Summary & Checkout Footer */}
                <div className="cart-summary-footer">
                  <div className="summary-breakdown">
                    <div className="summary-row">
                      <span className="summary-lbl">Subtotal</span>
                      <span className="summary-val">{formatPaiseToRupees(subtotal)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-lbl">Est. GST (5%)</span>
                      <span className="summary-val">{formatPaiseToRupees(estimatedTax)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-lbl">Boutique Packaging</span>
                      <span className="summary-val green-text">Free</span>
                    </div>
                    <div className="summary-divider" />
                    <div className="summary-row total-row">
                      <span className="summary-total-lbl">Estimated Total</span>
                      <span className="summary-total-val">{formatPaiseToRupees(estimatedTotal)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary cart-checkout-btn"
                    onClick={() => setIsCheckoutOpen(true)}
                  >
                    <span>Proceed to Counter Checkout</span>
                    <span className="btn-arrow" aria-hidden="true">→</span>
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

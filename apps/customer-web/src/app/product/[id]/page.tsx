'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type Product, formatPaiseToRupees } from '@orange/api-contracts';
import { fetchProductByIdOrSlug } from '../../../lib/api';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';
import { CartDrawer } from '../../../components/CartDrawer';
import { ProductIllustration } from '../../../components/ProductIllustration';
import { addToCart } from '../../../lib/cart';

export default function ProductDetailPage(): ReactElement {
  const params = useParams();
  const idOrSlug = params && typeof params.id === 'string'
    ? params.id
    : Array.isArray(params?.id)
    ? params.id[0]
    : '';

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  const loadProduct = useCallback(async () => {
    if (!idOrSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProductByIdOrSlug(idOrSlug);
      setProduct(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load product'));
    } finally {
      setIsLoading(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  return (
    <>
      <Header />

      <main id="main-content" className="detail-page-wrapper">
        <div className="container">
          {/* Breadcrumbs Navigation */}
          <nav aria-label="Breadcrumb" className="breadcrumbs">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/#menu">Menu</Link>
            {product && (
              <>
                <span aria-hidden="true">/</span>
                <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>
                  {product.name}
                </span>
              </>
            )}
          </nav>

          {/* Loading State */}
          {isLoading && (
            <div className="detail-grid" style={{ minHeight: '400px', alignItems: 'center' }}>
              <div
                className="skeleton-media"
                style={{ width: '100%', height: '350px', borderRadius: '12px' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="skeleton-line" style={{ width: '30%' }} />
                <div className="skeleton-line" style={{ width: '85%', height: '2rem' }} />
                <div className="skeleton-line" style={{ width: '40%', height: '2.5rem' }} />
                <div className="skeleton-line" style={{ width: '95%' }} />
                <div className="skeleton-line" style={{ width: '90%' }} />
                <div className="skeleton-line" style={{ width: '50%', height: '3rem', marginTop: '1rem' }} />
              </div>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="state-box">
              <div className="state-icon-circle">
                <span>⚠️</span>
              </div>
              <h2 className="state-title">Unable to Load Product</h2>
              <p className="state-copy">
                We could not connect to the store catalog to retrieve this product. Please check
                your connection or try again.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button type="button" className="btn-primary" onClick={loadProduct}>
                  Try Again
                </button>
                <Link href="/#menu" className="btn-secondary">
                  Return to Menu
                </Link>
              </div>
            </div>
          )}

          {/* Not Found State */}
          {!isLoading && !error && !product && (
            <div className="state-box">
              <div className="state-icon-circle">
                <span>🍰</span>
              </div>
              <h2 className="state-title">Product Not Found</h2>
              <p className="state-copy">
                The delicacy you are looking for is unavailable or may have been removed from our
                current seasonal menu.
              </p>
              <Link href="/#menu" className="btn-primary">
                Explore Full Menu
              </Link>
            </div>
          )}

          {/* Active Product Details */}
          {!isLoading && !error && product && (
            <div className="detail-grid">
              <div className="detail-media-box">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <ProductIllustration
                    categorySlug={product.categorySlug}
                    name={product.name}
                  />
                )}
              </div>

              <div className="detail-info">
                <div className="detail-header-row">
                  <span className="category-tag">{product.categoryName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    {product.isVeg && (
                      <div
                        className="badge-veg"
                        title="Vegetarian / Eggless"
                        aria-label="Vegetarian"
                      >
                        <span className="badge-veg-dot" />
                      </div>
                    )}
                    <span
                      className={`badge-stock ${
                        product.isInStock ? 'badge-in-stock' : 'badge-sold-out'
                      }`}
                    >
                      {product.isInStock ? 'In Stock' : 'Sold Out'}
                    </span>
                  </div>
                </div>

                <h1 className="detail-title">{product.name}</h1>

                <div className="detail-price-box">
                  <span className="detail-price">{formatPaiseToRupees(product.basePrice)}</span>
                  <span className="detail-price-tax">
                    (Inclusive of {product.taxRatePct}% GST)
                  </span>
                </div>

                <p className="detail-description">
                  {product.description ||
                    'Artisanal confectionery crafted with quality ingredients.'}
                </p>

                <div className="detail-specs-table">
                  <div className="spec-row">
                    <span className="spec-label">Category</span>
                    <span className="spec-value">{product.categoryName}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Dietary Attributes</span>
                    <span className="spec-value">{product.isVeg ? 'Vegetarian / Eggless' : 'Contains Egg'}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Prep Lead Time</span>
                    <span className="spec-value">~{product.prepTimeMinutes} minutes</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Allergens</span>
                    <span className="spec-value">
                      {product.allergens && product.allergens.length > 0 ? (
                        <span className="allergen-pills">
                          {product.allergens.map((allergen: string) => (
                            <span key={allergen} className="allergen-pill">
                              {allergen}
                            </span>
                          ))}
                        </span>
                      ) : (
                        'No major allergens declared'
                      )}
                    </span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Fulfillment</span>
                    <span className="spec-value">In-store Counter Pickup</span>
                  </div>
                </div>

                <div className="detail-cta-bar">
                  {product.isInStock ? (
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(product, 1);
                        setIsCartOpen(true);
                      }}
                      className="btn-primary"
                      style={{
                        flexGrow: 1,
                        cursor: 'pointer',
                      }}
                    >
                      🛍️ Add to Shopping Bag
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="btn-primary btn-sold-out-disabled"
                      style={{ flexGrow: 1 }}
                    >
                      Currently Sold Out
                    </button>
                  )}

                  <Link href="/#menu" className="btn-secondary">
                    ← Back to Menu
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}

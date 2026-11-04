'use client';

import { useState, useEffect, useCallback, useMemo, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type Product, formatPaiseToRupees } from '@orange/api-contracts';
import { fetchProductByIdOrSlug, fetchProducts } from '../../../lib/api';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';
import { CartDrawer } from '../../../components/CartDrawer';
import { ProductIllustration } from '../../../components/ProductIllustration';
import { Product3DViewer, type ProductModelType } from '../../../components/3d/Product3DViewer';
import { ProductCard } from '../../../components/ProductCard';
import { FoodIndicator } from '../../../components/FoodIndicator';
import { addToCart } from '../../../lib/cart';

export default function ProductDetailPage(): ReactElement {
  const params = useParams();
  const idOrSlug = params && typeof params.id === 'string'
    ? params.id
    : Array.isArray(params?.id)
    ? params.id[0]
    : '';

  const [product, setProduct] = useState<Product | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Gallery view mode: 'studio' | '3d'
  const [galleryMode, setGalleryMode] = useState<'studio' | '3d'>('studio');
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [addedSuccessToast, setAddedSuccessToast] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!idOrSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const [prod, allProds] = await Promise.all([
        fetchProductByIdOrSlug(idOrSlug),
        fetchProducts().catch(() => [] as Product[]),
      ]);
      setProduct(prod);
      setCatalogProducts(allProds);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load product'));
    } finally {
      setIsLoading(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    loadProduct();
    setQuantity(1);
    setGalleryMode('studio');
  }, [loadProduct]);

  // Determine suitable 3D model type based on category / slug
  const modelType: ProductModelType = useMemo(() => {
    if (!product) return 'cake';
    const s = (product.categorySlug + ' ' + product.slug).toLowerCase();
    if (s.includes('juice') || s.includes('orange')) return 'juice';
    if (s.includes('chocolate') || s.includes('praline')) return 'chocolate';
    return 'cake';
  }, [product]);

  // Related products from same category or catalog
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return catalogProducts
      .filter((p) => p.id !== product.id)
      .slice(0, 3);
  }, [product, catalogProducts]);

  const handleAddToCart = () => {
    if (!product || !product.isInStock) return;
    addToCart(product, quantity);
    setAddedSuccessToast(`Added ${quantity} × ${product.name} to your shopping bag!`);
    setTimeout(() => setAddedSuccessToast(null), 3000);
    setIsCartOpen(true);
  };

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
                <Link href={`/collection/${product.categorySlug}`}>{product.categoryName}</Link>
                <span aria-hidden="true">/</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  {product.name}
                </span>
              </>
            )}
          </nav>

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="detail-grid" style={{ minHeight: '480px' }}>
              <div
                className="skeleton-media"
                style={{ width: '100%', height: '420px', borderRadius: '16px' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="skeleton-line" style={{ width: '25%' }} />
                <div className="skeleton-line" style={{ width: '85%', height: '2.5rem' }} />
                <div className="skeleton-line" style={{ width: '35%', height: '2rem' }} />
                <div className="skeleton-line" style={{ width: '95%' }} />
                <div className="skeleton-line" style={{ width: '90%' }} />
                <div className="skeleton-line" style={{ width: '60%', height: '3.5rem', marginTop: '1rem' }} />
              </div>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="state-box" role="alert">
              <div className="state-icon-circle">
                <span>⚠️</span>
              </div>
              <h2 className="state-title">Unable to Load Delicacy</h2>
              <p className="state-copy">
                {error.message || 'We could not connect to the store catalog to retrieve this product.'}
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
                The delicacy you are looking for is currently unavailable or may have been retired from our seasonal menu.
              </p>
              <Link href="/#menu" className="btn-primary">
                Explore Full Menu
              </Link>
            </div>
          )}

          {/* Active Product Details */}
          {!isLoading && !error && product && (
            <div className="detail-grid">
              {/* Left Column: Interactive Product Gallery */}
              <div className="detail-gallery-col">
                {/* Gallery Mode Toggle Bar */}
                <div className="gallery-mode-tabs" role="tablist" aria-label="Product display mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={galleryMode === 'studio'}
                    className={`gallery-mode-tab ${galleryMode === 'studio' ? 'active' : ''}`}
                    onClick={() => setGalleryMode('studio')}
                  >
                    <span>🖼️ Studio View</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={galleryMode === '3d'}
                    className={`gallery-mode-tab ${galleryMode === '3d' ? 'active' : ''}`}
                    onClick={() => setGalleryMode('3d')}
                  >
                    <span>✨ Interactive 3D</span>
                  </button>
                </div>

                {/* Main Media Stage */}
                <div className="detail-media-box">
                  {galleryMode === 'studio' ? (
                    <div
                      className="studio-view-container"
                      onClick={() => setIsLightboxOpen(true)}
                      title="Click to view fullscreen"
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="detail-main-img"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <ProductIllustration
                          categorySlug={product.categorySlug}
                          name={product.name}
                          className="detail-main-illustration"
                        />
                      )}
                      <div className="zoom-hint-pill">
                        <span>🔍 Click to expand</span>
                      </div>
                    </div>
                  ) : (
                    <div className="viewer-3d-container">
                      <Product3DViewer
                        productType={modelType}
                        interactive={true}
                        autoRotate={true}
                      />
                    </div>
                  )}
                </div>

                {/* Gallery Thumbnail Bar */}
                <div className="gallery-thumbnails">
                  <button
                    type="button"
                    className={`thumb-btn ${galleryMode === 'studio' ? 'active' : ''}`}
                    onClick={() => setGalleryMode('studio')}
                    aria-label="View Studio Illustration"
                  >
                    <ProductIllustration
                      categorySlug={product.categorySlug}
                      name={product.name}
                      className="thumb-artwork"
                    />
                  </button>
                  <button
                    type="button"
                    className={`thumb-btn thumb-3d-btn ${galleryMode === '3d' ? 'active' : ''}`}
                    onClick={() => setGalleryMode('3d')}
                    aria-label="View Interactive 3D Model"
                  >
                    <span className="thumb-3d-badge">3D</span>
                    <span className="thumb-3d-label">Rotate 360°</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Information, Pricing & Order Controls */}
              <div className="detail-info">
                {/* Meta Header */}
                <div className="detail-header-row">
                  <span className="category-tag">{product.categoryName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FoodIndicator
                      classification={
                        product.foodClassification !== undefined
                          ? product.foodClassification
                          : product.isVeg
                          ? 'vegetarian'
                          : 'non_vegetarian'
                      }
                      size={20}
                      showLabel={true}
                    />
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
                    (Inclusive of {product.taxRatePct}% GST • Counter Pickup)
                  </span>
                </div>

                <p className="detail-description">
                  {product.description ||
                    'Handcrafted artisanal confectionery prepared with quality ingredients and single-origin cacao.'}
                </p>

                {/* Counter Pickup Lead Time Advisory */}
                <div className="pickup-lead-banner">
                  <div className="pickup-banner-icon">⏱️</div>
                  <div className="pickup-banner-text">
                    <strong>Fresh Preparation:</strong> Estimated kitchen lead time is ~{product.prepTimeMinutes} minutes upon counter order.
                  </div>
                </div>

                {/* Detailed Specifications Table */}
                <div className="detail-specs-table">
                  <div className="spec-row">
                    <span className="spec-label">Category</span>
                    <span className="spec-value">{product.categoryName}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Dietary Classification</span>
                    <span className="spec-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FoodIndicator
                        classification={
                          product.foodClassification !== undefined
                            ? product.foodClassification
                            : product.isVeg
                            ? 'vegetarian'
                            : 'non_vegetarian'
                        }
                        size={16}
                      />
                      <span>
                        {product.foodClassification === 'vegetarian' || (!product.foodClassification && product.isVeg)
                          ? 'Vegetarian (Green Symbol)'
                          : product.foodClassification === 'non_vegetarian' || (!product.foodClassification && !product.isVeg)
                          ? 'Non-Vegetarian (Red Symbol)'
                          : 'Not Applicable / Non-Food'}
                      </span>
                    </span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Prep Lead Time</span>
                    <span className="spec-value">~{product.prepTimeMinutes} minutes</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-label">Allergens Declared</span>
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
                    <span className="spec-label">Fulfillment Channel</span>
                    <span className="spec-value">In-Store Counter Pickup</span>
                  </div>
                </div>

                {/* Quantity Controls & Add to Bag CTA */}
                <div className="detail-purchase-panel">
                  {product.isInStock ? (
                    <>
                      <div className="quantity-selector-box">
                        <span className="quantity-label">Quantity:</span>
                        <div className="stepper-controls">
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            disabled={quantity <= 1}
                            aria-label="Decrease quantity"
                          >
                            –
                          </button>
                          <span className="stepper-val">{quantity}</span>
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => setQuantity(Math.min(10, quantity + 1))}
                            disabled={quantity >= 10}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="detail-cta-bar">
                        <button
                          type="button"
                          onClick={handleAddToCart}
                          className="btn-primary detail-add-btn"
                          aria-label={`Add ${quantity} ${product.name} to shopping bag`}
                        >
                          <span>Add to Shopping Bag • {formatPaiseToRupees(product.basePrice * quantity)}</span>
                          <span aria-hidden="true">🛍️</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="detail-cta-bar">
                      <button
                        type="button"
                        disabled
                        className="btn-primary btn-sold-out-disabled"
                        style={{ flexGrow: 1 }}
                      >
                        Currently Sold Out in Kitchen
                      </button>
                    </div>
                  )}

                  {addedSuccessToast && (
                    <div className="toast-notification" role="status">
                      ✓ {addedSuccessToast}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Lightbox Modal */}
          {isLightboxOpen && product && (
            <div
              className="lightbox-backdrop"
              onClick={() => setIsLightboxOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Fullscreen Product Viewer"
            >
              <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="lightbox-close-btn"
                  onClick={() => setIsLightboxOpen(false)}
                  aria-label="Close fullscreen viewer"
                >
                  ✕
                </button>
                <div className="lightbox-image-wrapper">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="lightbox-img" />
                  ) : (
                    <ProductIllustration
                      categorySlug={product.categorySlug}
                      name={product.name}
                      className="lightbox-illustration"
                    />
                  )}
                </div>
                <div className="lightbox-caption">
                  <h3>{product.name}</h3>
                  <p>{product.categoryName} • {formatPaiseToRupees(product.basePrice)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Related Delicacies Section */}
          {relatedProducts.length > 0 && (
            <section className="related-delicacies-section" aria-label="You May Also Crave">
              <div className="section-header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                <div className="section-subtitle">Pairing Recommendations</div>
                <h2 className="section-title">You May Also Crave</h2>
              </div>

              <div className="product-grid">
                {relatedProducts.map((rel) => (
                  <ProductCard
                    key={rel.id}
                    product={rel}
                    onOpenCart={() => setIsCartOpen(true)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}

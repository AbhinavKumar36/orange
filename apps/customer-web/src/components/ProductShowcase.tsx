'use client';

import { useState, useMemo, type ReactElement } from 'react';
import Link from 'next/link';
import { type Product, formatPaiseToRupees } from '@orange/api-contracts';
import { FoodIndicator } from './FoodIndicator';
import { addToCart } from '../lib/cart';

interface ProductShowcaseProps {
  products: Product[];
  onOpenCart?: () => void;
}

export function ProductShowcase({ products, onOpenCart }: ProductShowcaseProps): ReactElement {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Map real catalog products to our showcase items with high-res gallery carousels
  const showcaseItems = useMemo(() => {
    const cakeProd = products.find(
      (p) => p.categorySlug.includes('cake') || p.slug.includes('cake')
    );
    const juiceProd = products.find(
      (p) => p.categorySlug.includes('juice') || p.slug.includes('juice') || p.slug.includes('orange')
    );
    const chocProd = products.find(
      (p) => p.categorySlug.includes('chocolate') || p.slug.includes('praline')
    );

    return [
      {
        id: 'cake',
        tag: 'Signature Patisserie',
        gallery: [
          'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=1000&q=80',
        ],
        product: cakeProd || {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          name: 'Dark Chocolate Truffle Cake (500g)',
          slug: 'dark-chocolate-truffle-cake-500g',
          categoryName: 'Artisanal Cakes',
          categorySlug: 'artisanal-cakes',
          categoryId: '11111111-1111-1111-1111-111111111111',
          basePrice: 65000,
          taxRatePct: 5.0,
          isVeg: true,
          prepTimeMinutes: 0,
          isInStock: true,
          allergens: ['dairy', 'gluten'],
          description: '70% Belgian dark chocolate sponge layered with silky ganache and candied orange crescent. In-store ready to sell.',
        },
        tastingNotes: 'Deep cocoa intensity with bright citrus aroma and velvety ganache mouthfeel. Ready in vitrine.',
      },
      {
        id: 'juice',
        tag: 'Cold-Pressed Nectar',
        gallery: [
          'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=80',
        ],
        product: juiceProd || {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          name: 'Valencia Orange Cold-Pressed (300ml)',
          slug: 'valencia-orange-cold-pressed-300ml',
          categoryName: 'Cold-Pressed Juices',
          categorySlug: 'cold-pressed-juices',
          categoryId: '22222222-2222-2222-2222-222222222222',
          basePrice: 18000,
          taxRatePct: 5.0,
          isVeg: true,
          prepTimeMinutes: 0,
          isInStock: true,
          allergens: [],
          description: 'Pure sun-ripened Valencia oranges, cold-pressed and bottled, chilled in display counter ready for immediate pickup.',
        },
        tastingNotes: 'Crisp sun-drenched citrus brightness with natural balanced sweetness. Chilled to optimal temperature.',
      },
      {
        id: 'chocolate',
        tag: 'Master Chocolatier',
        gallery: [
          'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=1000&q=80',
        ],
        product: chocProd || {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: 'Artisanal Praline Box (6 pcs)',
          slug: 'artisanal-praline-box-6-pcs',
          categoryName: 'Gourmet Chocolates',
          categorySlug: 'gourmet-chocolates',
          categoryId: '33333333-3333-3333-3333-333333333333',
          basePrice: 35000,
          taxRatePct: 5.0,
          isVeg: true,
          prepTimeMinutes: 0,
          isInStock: true,
          allergens: ['nuts', 'dairy'],
          description: 'Handcrafted single-origin roasted hazelnut and almond pralines in a presentation box. Pre-packaged and ready to collect.',
        },
        tastingNotes: 'Roasted Piedmont hazelnut crunch enveloped in 64% Madagascar single-origin chocolate.',
      },
    ];
  }, [products]);

  const current = showcaseItems[activeTab] || showcaseItems[0];
  const gallery = current.gallery || [];

  function handleTabChange(idx: number) {
    setActiveTab(idx);
    setActiveSlide(0);
  }

  function handlePrevSlide() {
    setActiveSlide((prev) => (prev > 0 ? prev - 1 : gallery.length - 1));
  }

  function handleNextSlide() {
    setActiveSlide((prev) => (prev < gallery.length - 1 ? prev + 1 : 0));
  }

  function handleAddToCart() {
    addToCart(current.product, 1);
    setAddedToast(`Added ${current.product.name} to your bag!`);
    setTimeout(() => setAddedToast(null), 3000);
    if (onOpenCart) {
      onOpenCart();
    }
  }

  return (
    <section className="showcase-section" aria-label="Curated In-Stock Delicacies Showcase">
      <div className="container">
        {/* Section Header */}
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="section-subtitle">In-Store Ready Delicacies</div>
          <h2 className="section-title">Curated Display Showcase</h2>
          <p className="section-lead" style={{ maxWidth: '620px', margin: '0.75rem auto 0' }}>
            Browse our signature creations currently packed and ready in our store display vitrine for instant counter pickup.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="showcase-tabs" role="tablist" aria-label="Select product to inspect">
          {showcaseItems.map((item, idx) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={activeTab === idx}
              aria-controls={`showcase-panel-${item.id}`}
              className={`showcase-tab-btn ${activeTab === idx ? 'active' : ''}`}
              onClick={() => handleTabChange(idx)}
            >
              <span className="tab-number">0{idx + 1}</span>
              <span className="tab-title">{item.product.name.split(' (')[0]}</span>
            </button>
          ))}
        </div>

        {/* Main Showcase Stage */}
        <div
          id={`showcase-panel-${current.id}`}
          role="tabpanel"
          className="showcase-stage"
        >
          {/* Left: Interactive Product Image Carousel */}
          <div className="showcase-viewer-col">
            <div className="showcase-carousel-card">
              <div className="carousel-main-viewport">
                <img
                  src={gallery[activeSlide] || current.product.imageUrl || gallery[0]}
                  alt={current.product.name}
                  className="carousel-main-image"
                />
                <div className="carousel-vignette" />

                {/* Counter & Stock Tag */}
                <div className="carousel-meta-badge">
                  <span className="carousel-slide-counter">
                    0{activeSlide + 1} / 0{gallery.length}
                  </span>
                  <span className="carousel-stock-pill">
                    READY IN VITRINE
                  </span>
                </div>

                {/* Arrow Controls */}
                <button
                  type="button"
                  className="carousel-nav-btn prev-btn"
                  onClick={handlePrevSlide}
                  aria-label="Previous product photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="carousel-nav-btn next-btn"
                  onClick={handleNextSlide}
                  aria-label="Next product photo"
                >
                  ›
                </button>
              </div>

              {/* Thumbnails Row */}
              <div className="carousel-thumbnails-row">
                {gallery.map((imgUrl, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    className={`carousel-thumb-btn ${activeSlide === sIdx ? 'active' : ''}`}
                    onClick={() => setActiveSlide(sIdx)}
                    aria-label={`View photo ${sIdx + 1} of ${current.product.name}`}
                  >
                    <img src={imgUrl} alt="" className="carousel-thumb-img" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Editorial Product Details Card (Preserved & Enhanced) */}
          <div className="showcase-info-col">
            <div className="showcase-details-card">
              <div className="showcase-badge-row">
                <span className="category-tag">{current.tag}</span>
                <span className="stock-pill in-stock-ready">
                  {current.product.isInStock ? '🟢 Ready to Sell In-Store' : '⚪ Sold Out'}
                </span>
              </div>

              <h3 className="showcase-product-name">{current.product.name}</h3>

              <div className="showcase-price-row">
                <span className="showcase-price">
                  {formatPaiseToRupees(current.product.basePrice)}
                </span>
                <span className="showcase-tax-note">
                  (Incl. {current.product.taxRatePct}% GST • Immediate Pickup)
                </span>
              </div>

              <p className="showcase-description">
                {current.product.description}
              </p>

              {/* Tasting Notes Callout */}
              <div className="tasting-notes-box">
                <div className="tasting-notes-label">✨ Chef&apos;s Tasting Notes</div>
                <div className="tasting-notes-body">{current.tastingNotes}</div>
              </div>

              {/* Specification Grid */}
              <div className="showcase-specs-grid">
                <div className="showcase-spec-item">
                  <span className="spec-item-label">Availability</span>
                  <span className="spec-item-value highlight-ready">Instant Counter Handover</span>
                </div>
                <div className="showcase-spec-item">
                  <span className="spec-item-label">Dietary</span>
                  <span className="spec-item-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FoodIndicator
                      classification={
                        current.product.foodClassification !== undefined
                          ? current.product.foodClassification
                          : current.product.isVeg
                          ? 'vegetarian'
                          : 'non_vegetarian'
                      }
                      size={15}
                    />
                    <span>
                      {current.product.foodClassification === 'vegetarian' || (!current.product.foodClassification && current.product.isVeg)
                        ? 'Vegetarian'
                        : current.product.foodClassification === 'non_vegetarian' || (!current.product.foodClassification && !current.product.isVeg)
                        ? 'Non-Vegetarian'
                        : 'Non-Food'}
                    </span>
                  </span>
                </div>
                <div className="showcase-spec-item">
                  <span className="spec-item-label">Stock Status</span>
                  <span className="spec-item-value">Pre-Packed & Ready</span>
                </div>
                <div className="showcase-spec-item">
                  <span className="spec-item-label">Allergens</span>
                  <span className="spec-item-value">
                    {current.product.allergens && current.product.allergens.length > 0
                      ? current.product.allergens.join(', ')
                      : 'None declared'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="showcase-actions-row">
                {current.product.isInStock ? (
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="btn-primary showcase-add-btn"
                  >
                    <span>Add to Shopping Bag</span>
                    <span aria-hidden="true">🛍️</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="btn-primary btn-sold-out-disabled showcase-add-btn"
                  >
                    Currently Out of Stock at Counter
                  </button>
                )}

                <Link
                  href={`/product/${encodeURIComponent(current.product.slug)}`}
                  className="btn-secondary showcase-view-btn"
                >
                  Full Specification
                </Link>
              </div>

              {addedToast && (
                <div className="toast-notification" role="status">
                  ✓ {addedToast}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

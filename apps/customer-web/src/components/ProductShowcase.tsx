'use client';

import { useState, useMemo, type ReactElement } from 'react';
import Link from 'next/link';
import { type Product, formatPaiseToRupees } from '@orange/api-contracts';
import { Product3DViewer, type ProductModelType } from './3d/Product3DViewer';
import { FoodIndicator } from './FoodIndicator';
import { addToCart } from '../lib/cart';

interface ProductShowcaseProps {
  products: Product[];
  onOpenCart?: () => void;
}

export function ProductShowcase({ products, onOpenCart }: ProductShowcaseProps): ReactElement {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Map real catalog products to our 3D showcase items
  const showcaseItems = useMemo(() => {
    // Look for real products matching the 3 categories
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
        modelType: 'cake' as ProductModelType,
        tag: 'Signature Patisserie',
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
          prepTimeMinutes: 20,
          isInStock: true,
          allergens: ['dairy', 'gluten'],
          description: '70% Belgian dark chocolate sponge layered with silky ganache and candied orange crescent.',
        },
        tastingNotes: 'Deep cocoa intensity with bright citrus aroma and velvety ganache mouthfeel.',
      },
      {
        id: 'juice',
        modelType: 'juice' as ProductModelType,
        tag: 'Cold-Pressed Nectar',
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
          prepTimeMinutes: 5,
          isInStock: true,
          allergens: [],
          description: 'Pure sun-ripened Valencia oranges, cold-pressed daily without added water or sugars.',
        },
        tastingNotes: 'Crisp sun-drenched citrus brightness with natural balanced sweetness.',
      },
      {
        id: 'chocolate',
        modelType: 'chocolate' as ProductModelType,
        tag: 'Master Chocolatier',
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
          prepTimeMinutes: 10,
          isInStock: true,
          allergens: ['nuts', 'dairy'],
          description: 'Handcrafted single-origin roasted hazelnut and almond pralines in a presentation box.',
        },
        tastingNotes: 'Roasted Piedmont hazelnut crunch enveloped in 64% Madagascar single-origin chocolate.',
      },
    ];
  }, [products]);

  const current = showcaseItems[activeTab] || showcaseItems[0];

  function handleAddToCart() {
    addToCart(current.product, 1);
    setAddedToast(`Added ${current.product.name} to your bag!`);
    setTimeout(() => setAddedToast(null), 3000);
    if (onOpenCart) {
      onOpenCart();
    }
  }

  return (
    <section className="showcase-section" aria-label="Interactive 3D Product Showcase">
      <div className="container">
        {/* Section Header */}
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="section-subtitle">Tactile Digital Studio</div>
          <h2 className="section-title">Interactive 3D Experience</h2>
          <p className="section-lead" style={{ maxWidth: '620px', margin: '0.75rem auto 0' }}>
            Rotate, inspect textures, and experience our handcrafted delicacies in high-fidelity 3D before collection.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="showcase-tabs" role="tablist" aria-label="Select 3D product to inspect">
          {showcaseItems.map((item, idx) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={activeTab === idx}
              aria-controls={`showcase-panel-${item.id}`}
              className={`showcase-tab-btn ${activeTab === idx ? 'active' : ''}`}
              onClick={() => setActiveTab(idx)}
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
          {/* Left: 3D Interactive Canvas */}
          <div className="showcase-viewer-col">
            <div className="showcase-canvas-card">
              <Product3DViewer
                key={current.modelType}
                productType={current.modelType}
                interactive={true}
                autoRotate={true}
              />
            </div>
          </div>

          {/* Right: Editorial Product Details Card */}
          <div className="showcase-info-col">
            <div className="showcase-details-card">
              <div className="showcase-badge-row">
                <span className="category-tag">{current.tag}</span>
                <span className="stock-pill">
                  {current.product.isInStock ? '🟢 Kitchen Available' : '⚪ Sold Out'}
                </span>
              </div>

              <h3 className="showcase-product-name">{current.product.name}</h3>

              <div className="showcase-price-row">
                <span className="showcase-price">
                  {formatPaiseToRupees(current.product.basePrice)}
                </span>
                <span className="showcase-tax-note">
                  (Incl. {current.product.taxRatePct}% GST • Counter Pickup)
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
                  <span className="spec-item-label">Prep Lead Time</span>
                  <span className="spec-item-value">~{current.product.prepTimeMinutes} mins</span>
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
                  <span className="spec-item-label">Collection</span>
                  <span className="spec-item-value">In-Store Counter</span>
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
                    Currently Sold Out
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

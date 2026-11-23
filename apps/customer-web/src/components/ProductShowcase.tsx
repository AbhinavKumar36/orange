'use client';

import { useState, useMemo, type ReactElement } from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight, Check } from 'lucide-react';
import { type Product, formatPaiseToRupees } from '@orange/api-contracts';
import { FoodIndicator } from './FoodIndicator';
import { addToCart } from '../lib/cart';

interface ProductShowcaseProps {
  products: Product[];
  onOpenCart?: () => void;
}

export function ProductShowcase({ products, onOpenCart }: ProductShowcaseProps): ReactElement {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Curate a diverse selection of real products across distinct categories
  const featuredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    // Group by category to pick diverse items first
    const seenCategories = new Set<string>();
    const diverse: Product[] = [];

    for (const p of products) {
      if (!seenCategories.has(p.categorySlug) && p.isInStock) {
        seenCategories.add(p.categorySlug);
        diverse.push(p);
      }
      if (diverse.length >= 4) break;
    }

    // If fewer than 4 categories exist, fill with remaining in-stock products
    if (diverse.length < 4) {
      for (const p of products) {
        if (!diverse.some((item) => item.id === p.id) && p.isInStock) {
          diverse.push(p);
        }
        if (diverse.length >= 4) break;
      }
    }

    // Fallback if no in-stock: take first up to 4 items
    if (diverse.length === 0) {
      return products.slice(0, 4);
    }

    return diverse;
  }, [products]);

  // If no products available at all, return empty element
  if (featuredProducts.length === 0) {
    return <></>;
  }

  const current = featuredProducts[activeTab] || featuredProducts[0];
  const formattedPrice = formatPaiseToRupees(current.basePrice);

  function handleAddToCart() {
    if (!current.isInStock) return;
    addToCart(current, 1);
    setAddedToast(`Added ${current.name} to shopping bag`);
    setTimeout(() => setAddedToast(null), 3000);
    if (onOpenCart) {
      onOpenCart();
    }
  }

  return (
    <section className="showcase-section" aria-label="Featured Products Showcase">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <div className="section-subtitle">Retail Highlights</div>
          <h2 className="section-title">Featured Selections</h2>
          <p className="section-lead">
            Curated daily from across our categories. Pre-packaged and in-stock for instant counter collection.
          </p>
        </div>

        {/* Tab Switcher (Real Backend Products) */}
        <div className="showcase-tabs" role="tablist" aria-label="Select featured product">
          {featuredProducts.map((p, idx) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={activeTab === idx}
              aria-controls={`showcase-panel-${p.id}`}
              className={`showcase-tab-btn ${activeTab === idx ? 'active' : ''}`}
              onClick={() => setActiveTab(idx)}
            >
              <span className="tab-number">0{idx + 1}</span>
              <span className="tab-category">{p.categoryName}</span>
              <span className="tab-title">{p.name.split(' (')[0]}</span>
            </button>
          ))}
        </div>

        {/* Main Showcase Stage */}
        <div
          id={`showcase-panel-${current.id}`}
          role="tabpanel"
          className="showcase-stage"
        >
          {/* Left Column: Real Product Photography */}
          <div className="showcase-viewer-col">
            <div className="showcase-visual-frame">
              {current.imageUrl ? (
                <img
                  src={current.imageUrl}
                  alt={current.name}
                  className="showcase-product-photo"
                  loading="eager"
                />
              ) : (
                <div className="showcase-photo-fallback">
                  <span className="fallback-text">{current.name}</span>
                </div>
              )}

              <div className="showcase-badges-floating">
                <FoodIndicator
                  classification={
                    current.foodClassification !== undefined
                      ? current.foodClassification
                      : current.isVeg
                      ? 'vegetarian'
                      : 'non_vegetarian'
                  }
                  size={20}
                />
                <span className={`showcase-stock-pill ${current.isInStock ? 'in-stock' : 'out-of-stock'}`}>
                  {current.isInStock ? 'In-Store Ready' : 'Out of Stock'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Product Detail & Immediate Commerce Action */}
          <div className="showcase-info-col">
            <div className="showcase-meta-bar">
              <span className="showcase-category-pill">{current.categoryName}</span>
              {current.prepTimeMinutes && current.prepTimeMinutes > 0 && current.categorySlug.includes('cake') ? (
                <span className="showcase-prep-pill">Prep: {current.prepTimeMinutes}m</span>
              ) : (
                <span className="showcase-prep-pill">Counter Handover: Immediate</span>
              )}
            </div>

            <h3 className="showcase-title">{current.name}</h3>

            <div className="showcase-price-row">
              <span className="showcase-price">{formattedPrice}</span>
              <span className="showcase-tax-note">Inclusive of GST</span>
            </div>

            {current.description && (
              <p className="showcase-description">{current.description}</p>
            )}

            {current.allergens && current.allergens.length > 0 && (
              <div className="showcase-allergens">
                <span className="allergens-label">Allergens:</span>
                <div className="allergens-tags">
                  {current.allergens.map((item) => (
                    <span key={item} className="allergen-chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="showcase-actions-group">
              <button
                type="button"
                className="btn-accent showcase-add-btn"
                onClick={handleAddToCart}
                disabled={!current.isInStock}
              >
                <ShoppingBag size={18} aria-hidden="true" />
                <span>{current.isInStock ? 'Add to Bag' : 'Currently Unavailable'}</span>
              </button>

              <Link
                href={`/product/${encodeURIComponent(current.slug)}`}
                className="btn-secondary showcase-view-btn"
              >
                <span>View Full Details</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            {/* Toast Feedback */}
            {addedToast && (
              <div className="showcase-toast-feedback" role="status">
                <Check size={16} />
                <span>{addedToast}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

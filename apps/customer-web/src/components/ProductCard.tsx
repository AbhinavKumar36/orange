'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { type Product, formatPaiseToRupees } from '@orange/api-contracts';
import { ProductIllustration } from './ProductIllustration';
import { FoodIndicator } from './FoodIndicator';
import { addToCart } from '../lib/cart';

interface ProductCardProps {
  product: Product;
  onOpenCart?: () => void;
}

export function ProductCard({
  product,
  onOpenCart,
}: ProductCardProps): ReactElement {
  const [justAdded, setJustAdded] = useState(false);
  const formattedPrice = formatPaiseToRupees(product.basePrice);

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!product.isInStock) return;

    addToCart(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);

    if (onOpenCart) {
      onOpenCart();
    }
  }

  return (
    <article
      className={`product-card ${!product.isInStock ? 'sold-out' : ''}`}
      aria-labelledby={`product-title-${product.id}`}
    >
      {/* Media Wrapper */}
      <div className="card-media-wrapper">
        <div className="card-badge-top-left">
          <FoodIndicator
            classification={
              product.foodClassification !== undefined
                ? product.foodClassification
                : product.isVeg
                ? 'vegetarian'
                : 'non_vegetarian'
            }
            size={18}
          />
        </div>

        <div className="card-badge-top-right">
          <span
            className={`badge-stock ${
              product.isInStock ? 'badge-in-stock' : 'badge-sold-out'
            }`}
          >
            {product.isInStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>

        <Link
          href={`/product/${encodeURIComponent(product.slug)}`}
          className="card-media-link"
          tabIndex={-1}
          aria-hidden="true"
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="card-image"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <ProductIllustration
              categorySlug={product.categorySlug}
              name={product.name}
              className="card-illustration"
            />
          )}
        </Link>
      </div>

      {/* Card Body */}
      <div className="card-body">
        <div className="card-meta-top">
          <span className="category-tag">{product.categoryName}</span>
          <span className="card-prep-time">⏱️ {product.prepTimeMinutes}m</span>
        </div>

        <h3 id={`product-title-${product.id}`} className="product-title">
          <Link href={`/product/${encodeURIComponent(product.slug)}`}>
            {product.name}
          </Link>
        </h3>

        <p className="product-description">{product.description || 'Artisanal delicacy.'}</p>

        {product.allergens && product.allergens.length > 0 && (
          <div className="card-allergen-row">
            <span className="allergen-label">Contains:</span>
            <span className="allergen-text">{product.allergens.slice(0, 2).join(', ')}</span>
          </div>
        )}

        <div className="card-footer">
          <div className="product-price-box">
            <span className="product-price">{formattedPrice}</span>
            <span className="product-tax-sub">Incl. {product.taxRatePct}% GST</span>
          </div>

          <div className="card-actions-group">
            {product.isInStock ? (
              <>
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  className={`btn-card-quick-add ${justAdded ? 'added' : ''}`}
                  aria-label={`Add ${product.name} to shopping bag`}
                  title="Quick Add to Bag"
                >
                  {justAdded ? '✓ Added' : '+ Add'}
                </button>
                <Link
                  href={`/product/${encodeURIComponent(product.slug)}`}
                  className="btn-card-details"
                  aria-label={`View details for ${product.name}`}
                >
                  Details
                </Link>
              </>
            ) : (
              <button
                type="button"
                disabled
                className="btn-card-action btn-sold-out-disabled"
                aria-disabled="true"
              >
                Out of Stock
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

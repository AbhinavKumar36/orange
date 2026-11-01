'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { type Product, formatPaiseToRupees } from '@orange/api-contracts';
import { ProductIllustration } from './ProductIllustration';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({
  product,
}: ProductCardProps): ReactElement {
  const formattedPrice = formatPaiseToRupees(product.basePrice);

  return (
    <article
      className={`product-card ${!product.isInStock ? 'sold-out' : ''}`}
      aria-labelledby={`product-title-${product.id}`}
    >
      <div className="card-media-wrapper">
        <div className="card-badge-top-left">
          {product.isVeg && (
            <div className="badge-veg" title="Vegetarian / Eggless" aria-label="Vegetarian">
              <span className="badge-veg-dot" />
            </div>
          )}
        </div>

        <div className="card-badge-top-right">
          <span
            className={`badge-stock ${
              product.isInStock ? 'badge-in-stock' : 'badge-sold-out'
            }`}
          >
            {product.isInStock ? 'In Stock' : 'Sold Out'}
          </span>
        </div>

        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="card-image"
            loading="lazy"
            onError={(e) => {
              // Hide broken image to fallback to illustration
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

      <div className="card-body">
        <div className="category-tag">{product.categoryName}</div>

        <h3 id={`product-title-${product.id}`} className="product-title">
          <Link href={`/product/${encodeURIComponent(product.slug)}`}>
            {product.name}
          </Link>
        </h3>

        <p className="product-description">{product.description || 'Artisanal delicacy.'}</p>

        <div className="card-meta-row">
          <span>⏱️ Est. prep: {product.prepTimeMinutes}m</span>
          {product.allergens && product.allergens.length > 0 && (
            <span>• Contains {product.allergens.slice(0, 2).join(', ')}</span>
          )}
        </div>

        <div className="card-footer">
          <div className="product-price">{formattedPrice}</div>

          {product.isInStock ? (
            <Link
              href={`/product/${encodeURIComponent(product.slug)}`}
              className="btn-card-action btn-view-details"
              aria-label={`View details for ${product.name}`}
            >
              View Details
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="btn-card-action btn-sold-out-disabled"
              aria-disabled="true"
            >
              Sold Out
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

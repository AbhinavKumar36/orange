'use client';

import type { ReactElement } from 'react';
import { AlertCircle, SearchX, PackageOpen, RotateCw } from 'lucide-react';
import type { Product } from '@orange/api-contracts';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  onOpenCart?: () => void;
}

export function ProductGrid({
  products,
  isLoading,
  error,
  onRetry,
  onResetFilters,
  hasActiveFilters,
  onOpenCart,
}: ProductGridProps): ReactElement {
  // 1. Loading Skeleton
  if (isLoading) {
    return (
      <div className="product-grid" aria-label="Loading products" aria-busy="true">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton-card" aria-hidden="true">
            <div className="skeleton-media" />
            <div className="skeleton-body">
              <div className="skeleton-line" style={{ width: '35%' }} />
              <div className="skeleton-line" style={{ width: '80%', height: '1.25rem' }} />
              <div className="skeleton-line" style={{ width: '95%' }} />
              <div className="skeleton-line" style={{ width: '60%' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1.25rem',
                }}
              >
                <div className="skeleton-line" style={{ width: '25%', height: '1.5rem' }} />
                <div
                  className="skeleton-line"
                  style={{ width: '30%', height: '2rem', borderRadius: '9999px' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 2. Backend / Network Error State
  if (error) {
    return (
      <div className="state-box" role="alert">
        <div className="state-icon-circle">
          <AlertCircle size={26} />
        </div>
        <h3 className="state-title">Catalogue Temporarily Unavailable</h3>
        <p className="state-copy">
          {error.message || 'We are having trouble connecting to the store inventory. Please check your connection or retry.'}
        </p>
        <button type="button" className="btn-primary" onClick={onRetry}>
          <RotateCw size={15} style={{ display: 'inline', marginRight: '6px' }} />
          Retry Connection
        </button>
      </div>
    );
  }

  // 3. Empty Search / Filter State
  if (products.length === 0 && hasActiveFilters) {
    return (
      <div className="state-box">
        <div className="state-icon-circle">
          <SearchX size={26} />
        </div>
        <h3 className="state-title">No Matching Products Found</h3>
        <p className="state-copy">
          We could not find any products matching your current filters. Try searching with different keywords or reset your filters.
        </p>
        <button type="button" className="btn-secondary" onClick={onResetFilters}>
          Clear Filters & Show All
        </button>
      </div>
    );
  }

  // 4. Empty Catalog State
  if (products.length === 0) {
    return (
      <div className="state-box">
        <div className="state-icon-circle">
          <PackageOpen size={26} />
        </div>
        <h3 className="state-title">Catalogue Currently Updating</h3>
        <p className="state-copy">
          No products are currently listed in this section. Please check back shortly or refresh.
        </p>
        <button type="button" className="btn-primary" onClick={onRetry}>
          <RotateCw size={15} style={{ display: 'inline', marginRight: '6px' }} />
          Refresh Catalogue
        </button>
      </div>
    );
  }

  // 5. Active Product Grid
  return (
    <div className="product-grid" aria-label="Product Catalogue">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onOpenCart={onOpenCart}
        />
      ))}
    </div>
  );
}

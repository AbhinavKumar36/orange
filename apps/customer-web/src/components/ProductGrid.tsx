'use client';

import type { ReactElement } from 'react';
import type { Product } from '@orange/api-contracts';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export function ProductGrid({
  products,
  isLoading,
  error,
  onRetry,
  onResetFilters,
  hasActiveFilters,
}: ProductGridProps): ReactElement {
  // 1. Loading Skeleton
  if (isLoading) {
    return (
      <div className="product-grid" aria-label="Loading menu items" aria-busy="true">
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="state-title">Store Server Unavailable</h3>
        <p className="state-copy">
          We are having trouble connecting to the boutique catalog. Please verify your connection
          or try again.
        </p>
        <button type="button" className="btn-primary" onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }

  // 3. Empty Search / Filter State
  if (products.length === 0 && hasActiveFilters) {
    return (
      <div className="state-box">
        <div className="state-icon-circle">
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
        <h3 className="state-title">No Matching Treats Found</h3>
        <p className="state-copy">
          We could not find any items matching your current filters. Try searching for another
          dessert or browse our full menu.
        </p>
        <button type="button" className="btn-secondary" onClick={onResetFilters}>
          Clear Filters & Show All
        </button>
      </div>
    );
  }

  // 4. Empty Catalog State (Database has no products)
  if (products.length === 0) {
    return (
      <div className="state-box">
        <div className="state-icon-circle">
          <span style={{ fontSize: '1.5rem' }}>🍊</span>
        </div>
        <h3 className="state-title">Catalog Currently Updating</h3>
        <p className="state-copy">
          No menu items are currently listed. Please check back shortly or refresh the catalog.
        </p>
        <button type="button" className="btn-primary" onClick={onRetry}>
          Refresh Menu
        </button>
      </div>
    );
  }

  // 5. Active Product Grid
  return (
    <div className="product-grid" aria-label="Product Catalog">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
        />
      ))}
    </div>
  );
}


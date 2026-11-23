'use client';

import type { ReactElement } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
  resultCount?: number;
}

export function SearchBar({
  query,
  onChange,
  resultCount,
}: SearchBarProps): ReactElement {
  return (
    <div id="menu-search" className="search-bar-wrapper">
      <div className="search-input-box">
        <span className="search-icon-left" aria-hidden="true">
          <Search size={18} />
        </span>

        <input
          id="catalog-search-input"
          type="search"
          className="search-input"
          placeholder="Search products, beverages, snacks, treats..."
          value={query}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Search product catalogue"
        />

        {query.length > 0 && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onChange('')}
            aria-label="Clear search input"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {typeof resultCount === 'number' && (
        <div className="catalog-counter">
          <span>Products:</span>
          <strong>{resultCount}</strong> {resultCount === 1 ? 'item' : 'items'}
        </div>
      )}
    </div>
  );
}

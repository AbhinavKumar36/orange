'use client';

import type { ReactElement } from 'react';

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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>

        <input
          id="catalog-search-input"
          type="search"
          className="search-input"
          placeholder="Search by delicacy, flavor, or ingredient..."
          value={query}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Search menu catalog"
        />

        {query.length > 0 && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onChange('')}
            aria-label="Clear search input"
          >
            ✕
          </button>
        )}
      </div>

      {typeof resultCount === 'number' && (
        <div className="catalog-counter">
          <span>Catalog Results:</span>
          <strong>{resultCount}</strong> {resultCount === 1 ? 'creation' : 'creations'}
        </div>
      )}
    </div>
  );
}

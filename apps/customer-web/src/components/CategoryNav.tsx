'use client';

import type { ReactElement } from 'react';
import type { Category } from '@orange/api-contracts';
import { Layers } from 'lucide-react';

interface CategoryNavProps {
  categories: Category[];
  selectedSlug: string;
  onSelectCategory: (slug: string) => void;
}

export function CategoryNav({
  categories,
  selectedSlug,
  onSelectCategory,
}: CategoryNavProps): ReactElement {
  return (
    <div className="category-nav-bar" role="tablist" aria-label="Product Categories">
      <button
        type="button"
        role="tab"
        aria-selected={selectedSlug === ''}
        className={`category-chip ${selectedSlug === '' ? 'active' : ''}`}
        onClick={() => onSelectCategory('')}
      >
        <Layers size={15} aria-hidden="true" />
        <span>All Products</span>
      </button>

      {categories.map((cat) => {
        const isSelected = selectedSlug.toLowerCase() === cat.slug.toLowerCase();

        return (
          <button
            key={cat.id || cat.slug}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={`category-chip ${isSelected ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat.slug)}
          >
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}

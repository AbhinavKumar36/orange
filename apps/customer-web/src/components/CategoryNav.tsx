'use client';

import type { ReactElement } from 'react';
import type { Category } from '@orange/api-contracts';

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
    <div className="category-nav-bar" role="tablist" aria-label="Menu Categories">
      <button
        type="button"
        role="tab"
        aria-selected={selectedSlug === ''}
        className={`category-chip ${selectedSlug === '' ? 'active' : ''}`}
        onClick={() => onSelectCategory('')}
      >
        <span>🍰</span>
        <span>All Items</span>
      </button>

      {categories.map((cat) => {
        let icon = '🍊';
        if (cat.slug.includes('cake')) icon = '🎂';
        else if (cat.slug.includes('juice')) icon = '🥤';
        else if (cat.slug.includes('chocolate')) icon = '🍫';

        const isSelected = selectedSlug === cat.slug;

        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={`category-chip ${isSelected ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat.slug)}
          >
            <span>{icon}</span>
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}


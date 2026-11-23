'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Category, Product } from '@orange/api-contracts';

interface FeaturedCollectionsProps {
  categories?: Category[];
  products: Product[];
  onSelectCategory?: (slug: string) => void;
}

function getCategoryImage(cat: Category, products: Product[]): string {
  // 1. Prefer product image from real catalog products belonging to this category
  const prodWithImg = products.find(
    (p) => p.categorySlug.toLowerCase() === cat.slug.toLowerCase() && p.imageUrl
  );
  if (prodWithImg?.imageUrl) {
    return prodWithImg.imageUrl;
  }

  // 2. Curated visual fallbacks for recognized retail categories
  const s = cat.slug.toLowerCase();
  if (s.includes('cake') || s.includes('bake') || s.includes('pastry')) {
    return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('juice') || s.includes('drink') || s.includes('beverage')) {
    return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('choc') || s.includes('praline') || s.includes('confection')) {
    return 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('snack') || s.includes('savour') || s.includes('crisp')) {
    return 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('ice') || s.includes('cream') || s.includes('frozen')) {
    return 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=800&q=80';
  }
  return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80';
}

function getCategoryAccent(cat: Category, index: number): { tag: string; bgClass: string } {
  const s = cat.slug.toLowerCase();
  if (s.includes('cake') || s.includes('bake')) {
    return { tag: 'Fresh Bakes', bgClass: 'accent-cake' };
  }
  if (s.includes('juice') || s.includes('drink') || s.includes('beverage')) {
    return { tag: 'Chilled Drinks', bgClass: 'accent-beverage' };
  }
  if (s.includes('choc') || s.includes('praline')) {
    return { tag: 'Confectionery', bgClass: 'accent-chocolate' };
  }
  if (s.includes('snack') || s.includes('savour')) {
    return { tag: 'Savouries', bgClass: 'accent-snack' };
  }
  if (s.includes('ice') || s.includes('cream')) {
    return { tag: 'Frozen Treats', bgClass: 'accent-icecream' };
  }
  const genericTags = ['Curated Food', 'Retail Special', 'In-Store Item'];
  return { tag: genericTags[index % genericTags.length], bgClass: 'accent-general' };
}

export function FeaturedCollections({
  categories = [],
  products,
  onSelectCategory,
}: FeaturedCollectionsProps): ReactElement {
  if (!categories || categories.length === 0) {
    return <></>;
  }

  function handleCategoryClick(slug: string, e: React.MouseEvent) {
    if (onSelectCategory) {
      e.preventDefault();
      onSelectCategory(slug);
    }
  }

  return (
    <section id="categories" className="collections-section" aria-label="Category Discovery">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <div className="section-subtitle">Multi-Category Selection</div>
          <h2 className="section-title">Explore Store Categories</h2>
          <p className="section-lead">
            Discover our wide range of products—from fresh bakes and chilled beverages to savoury snacks and confectionery.
          </p>
        </div>

        {/* Dynamic Category Grid */}
        <div className="category-discovery-grid">
          {categories.map((cat, idx) => {
            const count = products.filter(
              (p) => p.categorySlug.toLowerCase() === cat.slug.toLowerCase()
            ).length;
            const bgImage = getCategoryImage(cat, products);
            const { tag, bgClass } = getCategoryAccent(cat, idx);

            return (
              <Link
                key={cat.id || cat.slug}
                href={`/collection/${cat.slug}`}
                onClick={(e) => handleCategoryClick(cat.slug, e)}
                className={`category-discovery-card ${bgClass}`}
                aria-label={`Browse ${cat.name} category with ${count} items`}
              >
                {/* Background Image Container */}
                <div className="category-card-media">
                  <img
                    src={bgImage}
                    alt={cat.name}
                    className="category-card-img"
                    loading="lazy"
                  />
                  <div className="category-card-scrim" />
                </div>

                {/* Card Top Row Badges */}
                <div className="category-card-top">
                  <span className="category-badge-pill">{tag}</span>
                  <span className="category-count-pill">
                    {count > 0 ? `${count} ${count === 1 ? 'Product' : 'Products'}` : 'View Items'}
                  </span>
                </div>

                {/* Card Content Footer */}
                <div className="category-card-bottom">
                  <div className="category-card-meta">
                    <span className="category-card-index">0{idx + 1}</span>
                    <h3 className="category-card-name">{cat.name}</h3>
                  </div>

                  {cat.description && (
                    <p className="category-card-description">{cat.description}</p>
                  )}

                  <div className="category-card-action">
                    <span className="action-text">Shop Category</span>
                    <span className="action-circle">
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

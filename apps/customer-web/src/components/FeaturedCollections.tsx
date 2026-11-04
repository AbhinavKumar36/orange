'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import type { Category, Product } from '@orange/api-contracts';
import { ProductIllustration } from './ProductIllustration';

interface FeaturedCollectionsProps {
  categories?: Category[];
  products: Product[];
  onSelectCategory?: (slug: string) => void;
}

export function FeaturedCollections({
  products,
  onSelectCategory,
}: FeaturedCollectionsProps): ReactElement {
  // Map category data to luxury editorial panels
  const collectionData = [
    {
      slug: 'artisanal-cakes',
      title: 'Artisanal Cakes',
      subtitle: 'Layered Belgian Sponges & Silky Ganache',
      description: 'Slow-baked with 70% dark chocolate, layered with fruit glazes, and finished with delicate artisanal touches.',
      theme: 'cake-theme',
      accentColor: '#D7A34A',
      badge: 'Patisserie Signature',
      imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
    },
    {
      slug: 'cold-pressed-juices',
      title: 'Cold-Pressed Juices',
      subtitle: '100% Raw Valencia Citrus & Nectars',
      description: 'Hydraulic cold-pressed every morning to lock in natural vitamins, crisp acidity, and unadulterated freshness.',
      theme: 'juice-theme',
      accentColor: '#D7A34A',
      badge: 'Bottled & Chilled',
      imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
    },
    {
      slug: 'gourmet-chocolates',
      title: 'Gourmet Chocolates',
      subtitle: 'Single-Origin Pralines & Cocoa Truffles',
      description: 'Handcrafted confections blending single-origin cocoa beans with roasted Piedmont hazelnuts and almonds.',
      theme: 'choc-theme',
      accentColor: '#D7A34A',
      badge: 'Master Confectionery',
      imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80',
    },
  ];

  function handleCategoryClick(slug: string) {
    if (onSelectCategory) {
      onSelectCategory(slug);
    }
  }

  return (
    <section className="collections-section" aria-label="Featured Collections">
      <div className="container">
        <div className="section-header" style={{ marginBottom: '2.5rem' }}>
          <div className="section-subtitle">Curated Catalog</div>
          <h2 className="section-title">Signature Collections</h2>
          <p className="section-lead">
            Every creation is prepared in small batches using single-origin cacao, fresh cold-pressed citrus, and quality ingredients.
          </p>
        </div>

        <div className="collections-grid">
          {collectionData.map((col, idx) => {
            // Count products in this category
            const count = products.filter(
              (p) => p.categorySlug.toLowerCase() === col.slug.toLowerCase()
            ).length;

            return (
              <div
                key={col.slug}
                className={`collection-card ${col.theme}`}
              >
                {/* Background Atmosphere & Decorative Halo */}
                <div className="collection-card-glow" />

                {/* Card Header & Badge */}
                <div className="collection-card-top">
                  <span className="collection-pill">{col.badge}</span>
                  <span className="collection-count">
                    {count > 0 ? `${count} ${count === 1 ? 'Creation' : 'Creations'}` : 'In Menu'}
                  </span>
                </div>

                {/* Visual Artwork Showcase */}
                <div className="collection-visual-box">
                  {col.imageUrl ? (
                    <img
                      src={col.imageUrl}
                      alt={col.title}
                      className="collection-photo"
                      loading="lazy"
                    />
                  ) : (
                    <ProductIllustration
                      categorySlug={col.slug}
                      name={col.title}
                      className="collection-illustration"
                    />
                  )}
                </div>

                {/* Content & Narrative */}
                <div className="collection-card-body">
                  <div className="collection-num">0{idx + 1}</div>
                  <h3 className="collection-card-title">{col.title}</h3>
                  <div className="collection-card-subtitle">{col.subtitle}</div>
                  <p className="collection-card-desc">{col.description}</p>

                  <div className="collection-card-footer">
                    <Link
                      href={`/collection/${col.slug}`}
                      className="collection-explore-link"
                      onClick={() => handleCategoryClick(col.slug)}
                      aria-label={`Explore ${col.title} collection`}
                    >
                      <span>Explore Collection</span>
                      <span className="arrow-icon" aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

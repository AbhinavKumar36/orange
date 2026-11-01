import type { ReactElement } from 'react';
import Link from 'next/link';
import { ProductIllustration } from './ProductIllustration';

export function Hero(): ReactElement {
  return (
    <section className="hero-section" aria-label="Moody Orange Introduction">
      <div className="container">
        <div className="hero-grid">
          <div>
            <div className="hero-pill">
              <span>🍊</span>
              <span>Artisanal Confectionery & Drinks</span>
            </div>

            <h1 className="hero-title">
              Artisanal Cakes, Juices & <span className="hero-title-highlight">Chocolates</span>
            </h1>

            <p className="hero-copy">
              Explore our selection of cakes, juices, and gourmet chocolates.
              Browse our live catalog and view available items for in-store pickup.
            </p>

            <div className="hero-cta-group">
              <Link href="#menu" className="btn-primary">
                <span>Browse Menu</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link href="#about" className="btn-secondary">
                Our Offerings
              </Link>
            </div>

            <div className="hero-features">
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>Vegetarian Options</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>Counter Pickup</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>Live Menu Availability</span>
              </div>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-art">
              <ProductIllustration categorySlug="artisanal-cakes" name="Signature Truffle" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span className="category-tag">Featured Item</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  Dark Chocolate Truffle Cake
                </h3>
              </div>
              <div
                style={{
                  fontSize: '1.375rem',
                  fontWeight: 800,
                  color: 'var(--color-primary)',
                }}
              >
                ₹650
              </div>
            </div>

            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-body)',
                marginTop: '0.5rem',
              }}
            >
              Rich dark chocolate cake layered with silky chocolate ganache.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


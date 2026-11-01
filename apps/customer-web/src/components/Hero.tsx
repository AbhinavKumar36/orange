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
              <span>Boutique Quick-Commerce Confectionery</span>
            </div>

            <h1 className="hero-title">
              Artisanal Cakes & Fresh{' '}
              <span className="hero-title-highlight">Cold-Pressed</span> Juices
            </h1>

            <p className="hero-copy">
              Handcrafted in small batches every morning using single-origin Belgian chocolate and
              orchard-fresh produce. Browse our live menu and collect your treats fresh at the shop counter.
            </p>

            <div className="hero-cta-group">
              <Link href="#menu" className="btn-primary">
                <span>Browse Menu</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link href="#about" className="btn-secondary">
                Our Story & Freshness
              </Link>
            </div>

            <div className="hero-features">
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>Eggless & Veg Options</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>Zero Artificial Additives</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>Ready in 15–20 Mins</span>
              </div>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-art">
              <ProductIllustration categorySlug="artisanal-cakes" name="Signature Truffle" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span className="category-tag">Chef's Signature</span>
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
              70% Belgian chocolate sponge with silky dark ganache and fresh orchard orange glaze.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


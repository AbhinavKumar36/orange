'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';

export function Hero(): ReactElement {
  const handleScrollToMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const menuEl = document.getElementById('menu');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero-section" aria-label="Mangala Enterprises Showcase">
      {/* Background Ambient Radiance & Vignette */}
      <div className="hero-atmosphere" aria-hidden="true">
        <div className="hero-radial-glow" />
        <div className="hero-mesh-overlay" />
      </div>

      <div className="container hero-container">
        <div className="hero-grid">
          {/* Left Column: Typography, Value Proposition & Actions */}
          <div className="hero-content">
            <div className="hero-pill">
              <span className="pill-dot" aria-hidden="true" />
              <span className="pill-text">Ready-to-Collect In-Store Stock • Instant Pickup</span>
            </div>

            <div className="hero-brand-marquee" aria-hidden="true">
              MANGALA ENTERPRISES
            </div>

            <h1 className="hero-title">
              Exquisite Patisserie & <span className="hero-title-highlight">Fine Confections</span>
            </h1>

            <p className="hero-copy">
              Curated daily in our boutique display vitrines using single-origin Belgian cacao, pure cold-pressed fruit extracts, and farm-fresh ingredients. Every delicacy is in stock and ready for immediate in-store counter collection.
            </p>

            <div className="hero-cta-group">
              <a
                href="#menu"
                onClick={handleScrollToMenu}
                className="btn-primary hero-btn-main"
              >
                <span>Shop In-Stock Menu</span>
                <span className="btn-arrow" aria-hidden="true">→</span>
              </a>
              <Link href="#collections" className="btn-secondary hero-btn-secondary">
                <span>Explore Collections</span>
              </Link>
            </div>

            {/* Quality Standard Badges */}
            <div className="hero-features">
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>Ready to Sell In-Store Stock</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>Immediate Counter Collection</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>FSSAI Certified Transparency</span>
              </div>
            </div>
          </div>

          {/* Right Column: In-Store Display Counter Showcase */}
          <div className="hero-3d-wrapper">
            <div className="hero-display-counter-card">
              <div className="counter-image-frame">
                <img
                  src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80"
                  alt="Mangala Enterprises In-Store Display Counter with Artisanal Delicacies"
                  className="counter-showcase-img"
                  loading="eager"
                />
                <div className="counter-overlay-gradient" />
                <div className="counter-badge-top-left">
                  <span className="live-counter-pill">
                    <span className="live-dot-pulse" />
                    IN-STORE DISPLAY VITRINE
                  </span>
                </div>
              </div>

              {/* Floating Editorial Badge */}
              <div className="hero-stage-badge">
                <div className="badge-flair">STORE DISPLAY COUNTER</div>
                <div className="badge-name">Artisanal Patisserie Showcase</div>
                <div className="badge-sub">Pre-packed & ready for immediate collection</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="hero-scroll-cue">
          <a href="#menu" onClick={handleScrollToMenu} aria-label="Scroll down to menu catalog">
            <span className="scroll-cue-text">DISCOVER CATALOG</span>
            <div className="scroll-cue-mouse">
              <div className="scroll-cue-wheel" />
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

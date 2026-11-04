'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { Hero3DCanvas } from './3d/Hero3DCanvas';

export function Hero(): ReactElement {
  const handleScrollToMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const menuEl = document.getElementById('menu');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero-section" aria-label="Moody Orange Cinematic Showcase">
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
              <span className="pill-text">Artisanal Patisserie & Cold-Pressed Citrus</span>
            </div>

            <div className="hero-brand-marquee" aria-hidden="true">
              MOODY ORANGE
            </div>

            <h1 className="hero-title">
              Pure Citrus Nectar & <span className="hero-title-highlight">Dark Couverture</span>
            </h1>

            <p className="hero-copy">
              Handcrafted in small daily batches using single-origin Belgian cacao and freshly pressed Valencia oranges. Available for fresh in-store counter pickup.
            </p>

            <div className="hero-cta-group">
              <a
                href="#menu"
                onClick={handleScrollToMenu}
                className="btn-primary hero-btn-main"
              >
                <span>Shop Live Menu</span>
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
                <span>Vegetarian & Eggless Options</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>In-Store Counter Pickup</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  ✓
                </span>
                <span>Real-Time Kitchen Stock</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive 3D Centerpiece */}
          <div className="hero-3d-wrapper">
            <div className="hero-3d-stage">
              <Hero3DCanvas />

              {/* Floating Editorial Badge on 3D Stage */}
              <div className="hero-stage-badge">
                <div className="badge-flair">INTERACTIVE 3D</div>
                <div className="badge-name">Valencia Citrus Sculpture</div>
                <div className="badge-sub">Drag or move mouse to tilt</div>
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

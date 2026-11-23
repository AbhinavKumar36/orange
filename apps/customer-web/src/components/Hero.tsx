'use client';

import type { ReactElement } from 'react';
import { ArrowRight, CheckCircle2, Store } from 'lucide-react';

export function Hero(): ReactElement {
  const handleScrollToMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const menuEl = document.getElementById('menu');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScrollToCategories = (e: React.MouseEvent) => {
    e.preventDefault();
    const catEl = document.getElementById('categories');
    if (catEl) {
      catEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero-section" aria-label="Mangala Enterprises Retail Showcase">
      <div className="container hero-container">
        <div className="hero-grid">
          {/* Left Column: Editorial Headline & Value Proposition */}
          <div className="hero-content">
            <div className="hero-pill">
              <span className="pill-dot" aria-hidden="true" />
              <span className="pill-text">Contemporary Food, Beverages & Confectionery</span>
            </div>

            <h1 className="hero-title">
              A curated destination for <span className="hero-title-highlight">food, drinks & treats.</span>
            </h1>

            <p className="hero-copy">
              Mangala Enterprises brings together everyday refreshments, chilled beverages, savoury snacks, celebratory bakes, and handcrafted confectionery under one roof. Pre-packed and organized in store for seamless counter collection.
            </p>

            <div className="hero-cta-group">
              <a
                href="#menu"
                onClick={handleScrollToMenu}
                className="btn-primary hero-btn-main"
              >
                <span>Explore Products</span>
                <ArrowRight size={17} aria-hidden="true" />
              </a>

              <a
                href="#categories"
                onClick={handleScrollToCategories}
                className="btn-secondary hero-btn-secondary"
              >
                <span>Browse Categories</span>
              </a>
            </div>

            {/* Quality & Retail Attributes */}
            <div className="hero-features">
              <div className="hero-feature-item">
                <CheckCircle2 size={16} className="feature-check-icon" aria-hidden="true" />
                <span>Multi-Category Selection</span>
              </div>
              <div className="hero-feature-item">
                <CheckCircle2 size={16} className="feature-check-icon" aria-hidden="true" />
                <span>Verified In-Store Stock</span>
              </div>
              <div className="hero-feature-item">
                <CheckCircle2 size={16} className="feature-check-icon" aria-hidden="true" />
                <span>Zero-Wait Counter Handover</span>
              </div>
            </div>
          </div>

          {/* Right Column: Multi-Category Visual Mosaic */}
          <div className="hero-visual-wrapper">
            <div className="hero-mosaic-grid">
              {/* Card 1: Beverages & Cold Drinks */}
              <div className="mosaic-card mosaic-beverages">
                <img
                  src="https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=700&q=80"
                  alt="Chilled cold-pressed juices and cold beverages"
                  className="mosaic-img"
                  loading="eager"
                />
                <div className="mosaic-overlay" />
                <div className="mosaic-caption">
                  <span className="mosaic-tag">Beverages & Drinks</span>
                  <span className="mosaic-title">Juices & Refreshments</span>
                </div>
              </div>

              {/* Card 2: Cakes & Bakes */}
              <div className="mosaic-card mosaic-cakes">
                <img
                  src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80"
                  alt="Artisanal cakes and gourmet bakes"
                  className="mosaic-img"
                  loading="eager"
                />
                <div className="mosaic-overlay" />
                <div className="mosaic-caption">
                  <span className="mosaic-tag">Cakes & Bakes</span>
                  <span className="mosaic-title">Layered Confections</span>
                </div>
              </div>

              {/* Card 3: Snacks & Savouries */}
              <div className="mosaic-card mosaic-snacks">
                <img
                  src="https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=700&q=80"
                  alt="Savoury snacks and retail treats"
                  className="mosaic-img"
                  loading="eager"
                />
                <div className="mosaic-overlay" />
                <div className="mosaic-caption">
                  <span className="mosaic-tag">Savoury Snacks</span>
                  <span className="mosaic-title">Crisps & Bites</span>
                </div>
              </div>

              {/* Card 4: Chocolates & Confectionery */}
              <div className="mosaic-card mosaic-chocolates">
                <img
                  src="https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=700&q=80"
                  alt="Fine chocolates and confections"
                  className="mosaic-img"
                  loading="eager"
                />
                <div className="mosaic-overlay" />
                <div className="mosaic-caption">
                  <span className="mosaic-tag">Confectionery</span>
                  <span className="mosaic-title">Chocolates & Sweets</span>
                </div>
              </div>

              {/* Center Floating Retail Crest */}
              <div className="hero-center-badge">
                <div className="center-badge-pulse" />
                <Store size={18} className="center-badge-icon" />
                <span className="center-badge-text">In-Store Ready Counter</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

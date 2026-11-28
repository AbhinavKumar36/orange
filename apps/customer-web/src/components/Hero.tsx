'use client';

import { useState, useEffect, useMemo, type ReactElement } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Store } from 'lucide-react';
import { type Product, formatPaiseToRupees } from '@orange/api-contracts';
import { ProductIllustration } from './ProductIllustration';

interface HeroProps {
  products?: Product[];
}

export function Hero({ products = [] }: HeroProps): ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Build dynamic carousel slides from real backend products (diverse categories first)
  const slides = useMemo(() => {
    if (!products || products.length === 0) return [];
    const seen = new Set<string>();
    const picked: Product[] = [];

    // Prefer in-stock products with real imageUrl across distinct categories
    for (const p of products) {
      if (p.isInStock && p.imageUrl && !seen.has(p.categorySlug)) {
        seen.add(p.categorySlug);
        picked.push(p);
      }
      if (picked.length >= 5) break;
    }

    // Fill with remaining products (preferring imageUrl, then any)
    if (picked.length < 5) {
      for (const p of products) {
        if (!picked.some((x) => x.id === p.id) && p.imageUrl) {
          picked.push(p);
        }
        if (picked.length >= 5) break;
      }
    }
    if (picked.length === 0) {
      return products.slice(0, 5);
    }
    return picked;
  }, [products]);

  const slideCount = slides.length;

  useEffect(() => {
    if (activeIndex >= slideCount && slideCount > 0) {
      setActiveIndex(0);
    }
  }, [activeIndex, slideCount]);

  // Auto-advance carousel every 4.5s unless paused or reduced motion preferred
  useEffect(() => {
    if (slideCount <= 1 || isPaused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slideCount);
    }, 4500);

    return () => clearInterval(timer);
  }, [slideCount, isPaused]);

  const handleScrollToMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const menuEl = document.getElementById('menu');
    if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScrollToCategories = (e: React.MouseEvent) => {
    e.preventDefault();
    const catEl = document.getElementById('categories');
    if (catEl) catEl.scrollIntoView({ behavior: 'smooth' });
  };

  const activeProduct = slides[activeIndex] || slides[0] || null;

  return (
    <section className="hero-section" aria-label="Mangala Enterprises Retail Showcase">
      <div className="container hero-container">
        <div className="hero-grid">
          {/* Left Column: Editorial Headline & Value Proposition */}
          <div className="hero-content">
            <div className="hero-pill">
              <span className="pill-dot" aria-hidden="true" />
              <span className="pill-text">Contemporary Food, Beverages &amp; Confectionery</span>
            </div>

            <h1 className="hero-title">
              A curated destination for <span className="hero-title-highlight">food, drinks &amp; treats.</span>
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

          {/* Right Column: Dynamic Auto-Advancing Product Carousel */}
          <div
            className="hero-visual-wrapper"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div
              className="hero-carousel"
              role="region"
              aria-roledescription="carousel"
              aria-label="Featured Store Products"
            >
              {activeProduct ? (
                <div className="hero-carousel-slide" key={activeProduct.id}>
                  <div className="hero-carousel-media">
                    {activeProduct.imageUrl ? (
                      <img
                        src={activeProduct.imageUrl}
                        alt={activeProduct.name}
                        className="hero-carousel-img"
                        loading="eager"
                      />
                    ) : (
                      <ProductIllustration
                        categorySlug={activeProduct.categorySlug}
                        name={activeProduct.name}
                        className="hero-carousel-img"
                      />
                    )}
                    <div className="hero-carousel-scrim" />
                  </div>

                  {/* Top Badges */}
                  <div className="hero-carousel-top">
                    <span className="hero-carousel-cat">{activeProduct.categoryName}</span>
                    <div className="hero-center-badge-inline">
                      <span className="center-badge-pulse" aria-hidden="true" />
                      <Store size={14} className="center-badge-icon" aria-hidden="true" />
                      <span className="center-badge-text">In-Store Ready</span>
                    </div>
                  </div>

                  {/* Bottom Product Caption & CTA */}
                  <div className="hero-carousel-caption">
                    <div className="hero-carousel-info">
                      <h2 className="hero-carousel-title">{activeProduct.name}</h2>
                      <div className="hero-carousel-price">
                        {formatPaiseToRupees(activeProduct.basePrice)}
                      </div>
                    </div>
                    <Link
                      href={`/product/${encodeURIComponent(activeProduct.slug)}`}
                      className="hero-carousel-link"
                    >
                      <span>View</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="hero-carousel-slide hero-carousel-placeholder">
                  <div className="hero-carousel-placeholder-inner">
                    <Store size={36} className="center-badge-icon" aria-hidden="true" />
                    <span className="hero-carousel-cat">Mangala Enterprises</span>
                    <p className="hero-carousel-title">Store Catalogue Loading</p>
                  </div>
                </div>
              )}

              {/* Carousel Controls & Dots */}
              {slideCount > 1 && (
                <div className="hero-carousel-controls">
                  <div className="hero-carousel-dots" role="tablist" aria-label="Carousel slides">
                    {slides.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={idx === activeIndex}
                        aria-label={`Show ${s.name}`}
                        className={`hero-carousel-dot ${idx === activeIndex ? 'active' : ''}`}
                        onClick={() => setActiveIndex(idx)}
                      />
                    ))}
                  </div>

                  <div className="hero-carousel-arrows">
                    <button
                      type="button"
                      className="hero-carousel-arrow-btn"
                      onClick={() => setActiveIndex((prev) => (prev - 1 + slideCount) % slideCount)}
                      aria-label="Previous product"
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="hero-carousel-arrow-btn"
                      onClick={() => setActiveIndex((prev) => (prev + 1) % slideCount)}
                      aria-label="Next product"
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

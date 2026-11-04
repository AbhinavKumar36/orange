'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';

export function BrandStory(): ReactElement {
  return (
    <section id="about" className="brand-story-section" aria-label="Our Craft and Philosophy">
      <div className="container">
        <div className="brand-story-grid">
          {/* Left Column: Editorial Statement */}
          <div className="story-editorial-col">
            <div className="section-subtitle">The Mangala Enterprises Heritage</div>
            <h2 className="story-heading">
              Where Culinary Craft Meets Uncompromising Purity.
            </h2>
            <div className="story-divider" />
            <p className="story-lead">
              Mangala Enterprises is dedicated to elevating everyday culinary indulgence into an art form. We unite time-honored boutique baking techniques with cold-pressed natural fruit nectars and single-origin gourmet chocolates.
            </p>
            <p className="story-text">
              We do not mass-produce. Every morning, our chefs begin by tempering single-origin cacao, cold-pressing sun-ripened fruits, and layering boutique sponge bases for immediate counter pickup. Every pastry, juice, and chocolate praline is crafted with pure ingredients, authentic fats, and clear dietary declarations.
            </p>

            <div className="story-stats-row">
              <div className="story-stat-card">
                <div className="story-stat-val">100%</div>
                <div className="story-stat-lbl">Pure Cold-Pressed Fruit Extracts</div>
              </div>
              <div className="story-stat-card">
                <div className="story-stat-val">70%</div>
                <div className="story-stat-lbl">Single-Origin Cacao Couverture</div>
              </div>
              <div className="story-stat-card">
                <div className="story-stat-val">Instant</div>
                <div className="story-stat-lbl">In-Store Ready Counter Handover</div>
              </div>
            </div>

            <div className="story-cta-box">
              <Link href="#menu" className="btn-primary">
                Browse Live Menu Catalog
              </Link>
            </div>
          </div>

          {/* Right Column: Visual Composition */}
          <div className="story-visual-col">
            <div className="story-art-card">
              <div className="story-art-glow" />
              <div className="story-art-badge">Boutique Kitchen Craft</div>

              <div className="story-quote-box">
                <span className="quote-mark">“</span>
                <p className="quote-text">
                  True luxury in confectionery is not excessive sweetness—it is depth, texture, and uncompromising freshness.
                </p>
                <div className="quote-author">— Mangala Enterprises Culinary Standards</div>
              </div>

              <div className="story-feature-list">
                <div className="story-feature-item">
                  <div className="feature-bullet">🌿</div>
                  <div>
                    <strong>Purity & Transparency:</strong> Recognized food indicators with clear vegetarian and non-vegetarian declarations.
                  </div>
                </div>
                <div className="story-feature-item">
                  <div className="feature-bullet">🍫</div>
                  <div>
                    <strong>Single-Origin Couverture:</strong> Slow-conched Belgian dark chocolate with deep roasted notes and silky melting curves.
                  </div>
                </div>
                <div className="story-feature-item">
                  <div className="feature-bullet">🛍️</div>
                  <div>
                    <strong>Ready to Sell Stock:</strong> Curated and pre-packed delicacies in store display vitrines for zero-wait immediate handover.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

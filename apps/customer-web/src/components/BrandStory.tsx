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
            <div className="section-subtitle">The Moody Orange Philosophy</div>
            <h2 className="story-heading">
              Where Precision Craft Meets Uncompromising Flavor.
            </h2>
            <div className="story-divider" />
            <p className="story-lead">
              Moody Orange was born from a singular obsession: to bring together the bright, untamed vitality of fresh citrus with the decadent, velvety richness of single-origin dark chocolate.
            </p>
            <p className="story-text">
              We do not mass-produce. Every morning, our patisserie kitchen begins by measuring single-origin cacao, hand-pressing Valencia citrus, and layering sponge bases for counter pickup. Every pastry, juice, and praline is crafted with pure ingredients, natural fats, and genuine respect for culinary balance.
            </p>

            <div className="story-stats-row">
              <div className="story-stat-card">
                <div className="story-stat-val">100%</div>
                <div className="story-stat-lbl">Pure Fruit Cold-Pressed Daily</div>
              </div>
              <div className="story-stat-card">
                <div className="story-stat-val">70%</div>
                <div className="story-stat-lbl">Belgian Dark Cacao Standard</div>
              </div>
              <div className="story-stat-card">
                <div className="story-stat-val">~15m</div>
                <div className="story-stat-lbl">Avg. Fresh Counter Pickup Lead</div>
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
              <div className="story-art-badge">Artisanal Quick-Commerce</div>

              <div className="story-quote-box">
                <span className="quote-mark">“</span>
                <p className="quote-text">
                  True luxury in confectionery is not excessive sweetness—it is depth, texture, and uncompromising freshness.
                </p>
                <div className="quote-author">— Moody Orange Kitchen Standards</div>
              </div>

              <div className="story-feature-list">
                <div className="story-feature-item">
                  <div className="feature-bullet">🍊</div>
                  <div>
                    <strong>Valencia Orange Focus:</strong> Sourced at peak ripeness for natural pectin, aromatic oils, and bright sweetness.
                  </div>
                </div>
                <div className="story-feature-item">
                  <div className="feature-bullet">🍫</div>
                  <div>
                    <strong>Single-Origin Couverture:</strong> Slow-conched dark chocolate with deep roasted notes and silky melting curves.
                  </div>
                </div>
                <div className="story-feature-item">
                  <div className="feature-bullet">⏱️</div>
                  <div>
                    <strong>Instant Kitchen Sync:</strong> Live stock counts ensure you never order an item that isn&apos;t ready for fresh counter pickup.
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

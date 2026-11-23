'use client';

import type { ReactElement } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, ShoppingBag, Store } from 'lucide-react';

export function BrandStory(): ReactElement {
  return (
    <section id="about" className="brand-story-section" aria-label="About Mangala Enterprises">
      <div className="container">
        <div className="brand-story-grid">
          {/* Left Column: Editorial Statement */}
          <div className="story-editorial-col">
            <div className="section-subtitle">Retail Perspective</div>
            <h2 className="story-heading">
              Thoughtfully Curated for Every Daily Craving.
            </h2>
            <div className="story-divider" />
            <p className="story-lead">
              Mangala Enterprises is a contemporary food and beverage retail destination. We curate a diverse portfolio spanning celebratory bakes, savoury snacks, cold beverages, ice creams, and confectionery.
            </p>
            <p className="story-text">
              We focus on clarity and convenience: every product in our digital catalogue reflects actual in-store stock, clearly labeled with FSSAI dietary classifications and allergen declarations. Customers can browse, select, and pick up pre-packaged items directly at our store counter.
            </p>

            <div className="story-pillars-grid">
              <div className="story-pillar-card">
                <Store size={20} className="pillar-icon" />
                <div className="pillar-title">Diverse Categories</div>
                <div className="pillar-desc">From cold drinks to savouries and sweet treats.</div>
              </div>
              <div className="story-pillar-card">
                <ShieldCheck size={20} className="pillar-icon" />
                <div className="pillar-title">Food Transparency</div>
                <div className="pillar-desc">Clear FSSAI vegetarian and non-vegetarian labeling.</div>
              </div>
              <div className="story-pillar-card">
                <ShoppingBag size={20} className="pillar-icon" />
                <div className="pillar-title">Live Inventory</div>
                <div className="pillar-desc">Stock updated in real time for counter collection.</div>
              </div>
            </div>

            <div className="story-cta-box">
              <a href="#menu" className="btn-primary">
                <span>Browse Entire Catalogue</span>
                <ArrowRight size={16} />
              </a>
            </div>
          </div>

          {/* Right Column: Visual Composition */}
          <div className="story-visual-col">
            <div className="story-art-card">
              <div className="story-art-badge">Store Experience</div>

              <div className="story-quote-box">
                <p className="quote-text">
                  “Our goal is simple: offer a genuine variety of quality food and beverages with transparent information and prompt in-store service.”
                </p>
                <div className="quote-author">— Mangala Enterprises Retail Standards</div>
              </div>

              <div className="story-feature-list">
                <div className="story-feature-item">
                  <div className="feature-icon-wrapper">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <strong>Standardized Food Declarations:</strong> Official green and red dietary marks and listed allergens on every product.
                  </div>
                </div>
                <div className="story-feature-item">
                  <div className="feature-icon-wrapper">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <strong>Verified In-Store Stock:</strong> Real-time database checks prevent reservations on unavailable inventory.
                  </div>
                </div>
                <div className="story-feature-item">
                  <div className="feature-icon-wrapper">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <strong>Counter Pickup Workflow:</strong> Pre-packed orders ready for direct handover at the retail counter.
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

import type { ReactElement } from 'react';

export function BrandValues(): ReactElement {
  return (
    <section id="about" className="brand-values-section" aria-label="Our Values & Standards">
      <div className="container">
        <div className="section-header">
          <div className="section-subtitle">Craft & Integrity</div>
          <h2 className="section-title">The Moody Orange Standard</h2>
        </div>

        <div className="values-grid">
          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🎂</span>
            </div>
            <h3 className="value-heading">Handcrafted Small Batches</h3>
            <p className="value-text">
              Every morning our pastry chefs craft small batches using 70% single-origin Belgian
              chocolate, rich dairy cream, and unbleached flours. We prioritize pure flavor over mass production.
            </p>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🍊</span>
            </div>
            <h3 className="value-heading">100% Cold-Pressed Juices</h3>
            <p className="value-text">
              We extract raw fruit juices using hydraulic cold-pressing to preserve vitamins,
              enzymes, and natural sweetness. Never heat-pasteurized, diluted with water, or sweetened with syrups.
            </p>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🛍️</span>
            </div>
            <h3 className="value-heading">Boutique Counter Pickup</h3>
            <p className="value-text">
              Browse our live catalog, track fulfillment times, and collect your delicacies freshly
              boxed directly from our shop pickup counter in just 15 to 20 minutes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


import type { ReactElement } from 'react';

export function BrandValues(): ReactElement {
  return (
    <section id="about" className="brand-values-section" aria-label="Our Offerings">
      <div className="container">
        <div className="section-header">
          <div className="section-subtitle">Store Offerings</div>
          <h2 className="section-title">The Moody Orange Selection</h2>
        </div>

        <div className="values-grid">
          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🎂</span>
            </div>
            <h3 className="value-heading">Artisanal Cakes</h3>
            <p className="value-text">
              A curated selection of cakes and confections with vegetarian and eggless options
              clearly marked for your convenience.
            </p>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🍊</span>
            </div>
            <h3 className="value-heading">Refreshing Juices</h3>
            <p className="value-text">
              Chilled fruit juices and refreshments packaged and ready for in-store counter pickup.
            </p>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🛍️</span>
            </div>
            <h3 className="value-heading">In-Store Counter Pickup</h3>
            <p className="value-text">
              Browse current availability across all menu categories and visit our counter to collect
              your order.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


'use client';

import type { ReactElement } from 'react';
import { ShoppingBag, ShieldCheck, Zap, Lock } from 'lucide-react';

export function BrandValues(): ReactElement {
  return (
    <section id="service" className="brand-values-section" aria-label="Store Guarantees & Pickup Convenience">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="section-subtitle">Store Standards</div>
          <h2 className="section-title">In-Store Stock & Counter Convenience</h2>
          <p className="section-lead" style={{ maxWidth: '640px', margin: '0.75rem auto 0' }}>
            We combine a wide product selection with digital inventory accuracy. Every order is prepared and held ready in store for convenient collection at Mangala Enterprises.
          </p>
        </div>

        <div className="values-grid">
          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <ShoppingBag size={22} />
            </div>
            <h3 className="value-heading">Prompt Counter Handover</h3>
            <p className="value-text">
              Collect directly from our store counter. Pre-packaged items are organized and held ready to sell for swift collection.
            </p>
            <div className="value-footer-note">Ready at retail counter</div>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <ShieldCheck size={22} />
            </div>
            <h3 className="value-heading">FSSAI Food Indicators</h3>
            <p className="value-text">
              Every item in our catalogue clearly displays standardized vegetarian and non-vegetarian symbols alongside allergen listings.
            </p>
            <div className="value-footer-note">Standardized dietary labels</div>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <Zap size={22} />
            </div>
            <h3 className="value-heading">Synchronized Stock</h3>
            <p className="value-text">
              Our digital store synchronizes with physical retail stock in real time, so you only see products that are genuinely available.
            </p>
            <div className="value-footer-note">Accurate inventory checks</div>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <Lock size={22} />
            </div>
            <h3 className="value-heading">Secure Account Access</h3>
            <p className="value-text">
              Sign in securely with your mobile number via OTP. Review past purchases, monitor order status, and manage your account.
            </p>
            <div className="value-footer-note">Verified mobile sign-in</div>
          </div>
        </div>
      </div>
    </section>
  );
}

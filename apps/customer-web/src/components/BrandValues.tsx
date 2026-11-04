'use client';

import type { ReactElement } from 'react';

export function BrandValues(): ReactElement {
  return (
    <section id="service" className="brand-values-section" aria-label="Store Guarantees & Pickup Capabilities">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="section-subtitle">Store Standards</div>
          <h2 className="section-title">Crafted for Quality, Prepared for Pickup</h2>
          <p className="section-lead" style={{ maxWidth: '640px', margin: '0.75rem auto 0' }}>
            We combine high patisserie standards with seamless digital convenience. Every order is freshly prepared for immediate or scheduled collection.
          </p>
        </div>

        <div className="values-grid">
          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🛍️</span>
            </div>
            <h3 className="value-heading">Counter Pickup Service</h3>
            <p className="value-text">
              Collect directly from our counter. Choose between immediate preparation (~15-20 minutes) or schedule a dedicated pickup window.
            </p>
            <div className="value-footer-note">Fresh at optimal temperature</div>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🌱</span>
            </div>
            <h3 className="value-heading">100% Vegetarian Selection</h3>
            <p className="value-text">
              Every item in our boutique catalog clearly displays dietary attributes, eggless preparation status, and explicit allergen listings.
            </p>
            <div className="value-footer-note">Transparent culinary standards</div>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>⚡</span>
            </div>
            <h3 className="value-heading">Live Kitchen Availability</h3>
            <p className="value-text">
              Our digital catalog synchronizes in real time with physical inventory so you only see and order delicacies that are genuinely in stock.
            </p>
            <div className="value-footer-note">Zero phantom reservations</div>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🔒</span>
            </div>
            <h3 className="value-heading">Verified Fast Authentication</h3>
            <p className="value-text">
              Log in securely with an Indian mobile number via instant SMS OTP. Review past orders, track pickup preparation, and enjoy one-tap repeat visits.
            </p>
            <div className="value-footer-note">Passcode-free mobile access</div>
          </div>
        </div>
      </div>
    </section>
  );
}

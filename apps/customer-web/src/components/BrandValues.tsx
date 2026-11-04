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
            We combine high culinary standards with seamless digital convenience. Every order is freshly prepared for immediate or scheduled collection at Mangala Enterprises.
          </p>
        </div>

        <div className="values-grid">
          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🛍️</span>
            </div>
            <h3 className="value-heading">Counter Pickup Service</h3>
            <p className="value-text">
              Collect directly from our store counter. Choose between immediate fresh preparation (~15-20 minutes) or schedule a dedicated pickup window.
            </p>
            <div className="value-footer-note">Served fresh at optimal temperature</div>
          </div>

          <div className="value-card">
            <div className="value-icon-box" aria-hidden="true">
              <span>🌿</span>
            </div>
            <h3 className="value-heading">FSSAI Food Classification</h3>
            <p className="value-text">
              Every item in our boutique catalog clearly displays recognized Indian green (Vegetarian) and red (Non-Vegetarian) symbols alongside explicit allergen listings.
            </p>
            <div className="value-footer-note">Transparent FSSAI standards</div>
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
            <h3 className="value-heading">Secure Mobile OTP Access</h3>
            <p className="value-text">
              Log in securely with your Indian mobile number via instant SMS OTP. Review past orders, manage your profile, and receive live pickup notifications.
            </p>
            <div className="value-footer-note">Password-free mobile verification</div>
          </div>
        </div>
      </div>
    </section>
  );
}

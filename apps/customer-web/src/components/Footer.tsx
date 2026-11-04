'use client';

import React, { type ReactElement } from 'react';
import Link from 'next/link';

export function Footer(): ReactElement {
  return (
    <footer className="site-footer" aria-label="Site Footer">
      <div className="container">
        <div className="footer-top-row footer-three-col">
          {/* Brand Col */}
          <div className="footer-brand-col">
            <Link href="/" className="footer-brand-logo" aria-label="Mangala Enterprises Home">
              <span className="brand-logo-mark" aria-hidden="true">🌿</span>
              <span className="footer-brand-name">Mangala Enterprises</span>
            </Link>
            <p className="footer-brand-copy">
              Purveyors of fine artisanal cakes, 100% pure cold-pressed nectars, and single-origin handcrafted chocolates. Prepared with uncompromised quality for in-store counter pickup.
            </p>
            <div className="footer-store-status">
              <span className="status-dot-live" />
              <span>Counter Pickup: 10:00 AM – 10:00 PM Daily</span>
            </div>
          </div>

          {/* Nav Col 1: Discovery */}
          <div className="footer-nav-col">
            <div className="footer-heading">Menu Catalog</div>
            <ul className="footer-links">
              <li>
                <Link href="/#menu" className="footer-link">Full Menu</Link>
              </li>
              <li>
                <Link href="/collection/artisanal-cakes" className="footer-link">Artisanal Cakes</Link>
              </li>
              <li>
                <Link href="/collection/cold-pressed-juices" className="footer-link">Cold-Pressed Juices</Link>
              </li>
              <li>
                <Link href="/collection/gourmet-chocolates" className="footer-link">Gourmet Chocolates</Link>
              </li>
              <li>
                <Link href="/orders" className="footer-link">My Order History</Link>
              </li>
              <li>
                <Link href="/account" className="footer-link">Account Profile</Link>
              </li>
            </ul>
          </div>

          {/* Nav Col 2: Store Policies & Assurance */}
          <div className="footer-nav-col">
            <div className="footer-heading">Patisserie & Service</div>
            <ul className="footer-links">
              <li>
                <Link href="/#about" className="footer-link">Our Heritage & Craft</Link>
              </li>
              <li>
                <Link href="/#service" className="footer-link">Counter Pickup Guarantees</Link>
              </li>
              <li>
                <Link href="/#menu" className="footer-link">Dietary & Allergen Declarations</Link>
              </li>
              <li>
                <span className="footer-link-text">FSSAI Certified Fresh Daily Bakes</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-copyright">
            © {new Date().getFullYear()} Mangala Enterprises. All rights reserved.
          </div>
          <div className="footer-policy-links">
            <span>In-Store Counter Pickup</span>
            <span>•</span>
            <span>Vegetarian & Non-Veg Declarations</span>
            <span>•</span>
            <span>Ready to Sell In-Store Stock</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

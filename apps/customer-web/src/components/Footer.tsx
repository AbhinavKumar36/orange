'use client';

import { useState, useEffect, type ReactElement } from 'react';
import Link from 'next/link';
import type { Category } from '@orange/api-contracts';
import { fetchCategories } from '../lib/api';

export function Footer(): ReactElement {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchCategories()
      .then((cats) => {
        if (isMounted) setCategories(cats);
      })
      .catch(() => {
        // graceful silence
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <footer className="site-footer" aria-label="Site Footer">
      <div className="container">
        <div className="footer-top-row footer-three-col">
          {/* Brand Col */}
          <div className="footer-brand-col">
            <Link href="/" className="footer-brand-logo" aria-label="Mangala Enterprises Home">
              <span className="brand-logo-emblem" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </span>
              <div className="brand-logo-titles">
                <span className="brand-logo-main">MANGALA</span>
                <span className="brand-logo-sub">ENTERPRISES</span>
              </div>
            </Link>
            <p className="footer-brand-copy">
              A contemporary multi-category food and beverage retail destination. Curating savoury snacks, cold beverages, celebratory bakes, and confectionery for convenient in-store pickup.
            </p>
            <div className="footer-store-status">
              <span className="status-dot-live" />
              <span>In-Store Counter Pickup: 10:00 AM – 10:00 PM Daily</span>
            </div>
          </div>

          {/* Nav Col 1: Discovery */}
          <div className="footer-nav-col">
            <div className="footer-heading">Store Categories</div>
            <ul className="footer-links">
              <li>
                <Link href="/#menu" className="footer-link">All Products</Link>
              </li>
              {categories.map((cat) => (
                <li key={cat.id || cat.slug}>
                  <Link href={`/collection/${cat.slug}`} className="footer-link">
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/orders" className="footer-link">Track Order Status</Link>
              </li>
              <li>
                <Link href="/account" className="footer-link">Customer Profile</Link>
              </li>
            </ul>
          </div>

          {/* Nav Col 2: Store Policies & Assurance */}
          <div className="footer-nav-col">
            <div className="footer-heading">Store Information</div>
            <ul className="footer-links">
              <li>
                <Link href="/#about" className="footer-link">About Mangala Enterprises</Link>
              </li>
              <li>
                <Link href="/#service" className="footer-link">Counter Pickup Guidelines</Link>
              </li>
              <li>
                <Link href="/#menu" className="footer-link">FSSAI Dietary Indicators</Link>
              </li>
              <li>
                <span className="footer-link-text">Real-Time Inventory Synchronization</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-copyright">
            © {new Date().getFullYear()} Mangala Enterprises. All rights reserved.
          </div>
          <div className="footer-policy-links">
            <span>In-Store Counter Collection</span>
            <span>•</span>
            <span>FSSAI Compliant Food Declarations</span>
            <span>•</span>
            <span>Verified In-Store Stock</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

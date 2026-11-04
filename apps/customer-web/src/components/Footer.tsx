'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';

export function Footer(): ReactElement {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubscribed(true);
    setEmail('');
  }

  return (
    <footer className="site-footer" aria-label="Site Footer">
      <div className="container">
        <div className="footer-top-row">
          {/* Brand Col */}
          <div className="footer-brand-col">
            <Link href="/" className="footer-brand-logo" aria-label="Moody Orange Home">
              <span className="brand-logo-mark" aria-hidden="true">🍊</span>
              <span className="footer-brand-name">Moody Orange</span>
            </Link>
            <p className="footer-brand-copy">
              Artisanal quick-commerce confectionery and cold-pressed citrus boutique. Handcrafted in small daily batches for counter pickup.
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
            </ul>
          </div>

          {/* Nav Col 2: Brand & Service */}
          <div className="footer-nav-col">
            <div className="footer-heading">Patisserie & Service</div>
            <ul className="footer-links">
              <li>
                <Link href="/#about" className="footer-link">Our Story & Craft</Link>
              </li>
              <li>
                <Link href="/#service" className="footer-link">Counter Pickup Policies</Link>
              </li>
              <li>
                <Link href="/#menu" className="footer-link">Dietary & Allergen Declarations</Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Col */}
          <div className="footer-newsletter-col">
            <div className="footer-heading">Seasonal Delicacy Dispatch</div>
            <p className="footer-newsletter-copy">
              Receive notifications for limited weekend bakes, fresh harvest single-origin cocoa, and seasonal fruit arrivals.
            </p>

            {subscribed ? (
              <div className="newsletter-success">
                <span>✓</span> Thank you for subscribing to Moody Orange seasonal dispatches.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="newsletter-form">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="newsletter-input"
                  required
                  aria-label="Email address for newsletter"
                />
                <button type="submit" className="newsletter-submit-btn">
                  Join
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-copyright">
            © {new Date().getFullYear()} Moody Orange. Artisanal Confectionery & Drinks. All rights reserved.
          </div>
          <div className="footer-policy-links">
            <span>In-Store Counter Pickup</span>
            <span>•</span>
            <span>Vegetarian & Allergen Transparent</span>
            <span>•</span>
            <span>Real-time Kitchen Availability</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

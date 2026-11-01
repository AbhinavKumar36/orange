import type { ReactElement } from 'react';
import Link from 'next/link';

export function Footer(): ReactElement {
  return (
    <footer className="site-footer" aria-label="Site Footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand-title">🍊 Moody Orange</div>
            <p className="footer-brand-copy">
              Boutique storefront for handcrafted artisanal cakes, fresh juices, and gourmet chocolate confections.
            </p>
          </div>

          <div>
            <div className="footer-heading">Menu Discovery</div>
            <ul className="footer-links">
              <li>
                <Link href="/#menu" className="footer-link">
                  Full Menu
                </Link>
              </li>
              <li>
                <Link href="/#menu" className="footer-link">
                  Artisanal Cakes
                </Link>
              </li>
              <li>
                <Link href="/#menu" className="footer-link">
                  Fresh Juices
                </Link>
              </li>
              <li>
                <Link href="/#menu" className="footer-link">
                  Gourmet Chocolates
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="footer-heading">Pickup Information</div>
            <p style={{ fontSize: '0.875rem', lineHeight: '1.6', color: '#A8A29E' }}>
              Orders are available for counter collection at the store. Preparation lead times vary by product.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            © {new Date().getFullYear()} Moody Orange. All rights reserved.
          </div>
          <div>
            Phase 3: Customer Web Catalog & Product Discovery
          </div>
        </div>
      </div>
    </footer>
  );
}


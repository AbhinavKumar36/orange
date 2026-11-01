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
              Boutique quick-commerce ordering platform for handcrafted artisanal cakes, fresh
              raw cold-pressed juices, and gourmet chocolate confections.
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
                  Cold-Pressed Juices
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
              Orders are freshly assembled upon confirmation for shop counter collection. Standard
              preparation lead time is 15–20 minutes.
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


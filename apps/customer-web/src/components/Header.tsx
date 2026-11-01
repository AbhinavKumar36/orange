'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { CartDrawer } from './CartDrawer';

interface HeaderProps {
  onCategorySelect?: (slug: string) => void;
}

export function Header({ onCategorySelect }: HeaderProps): ReactElement {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (slug: string) => {
    setIsMobileMenuOpen(false);
    if (onCategorySelect) {
      onCategorySelect(slug);
    }
  };

  return (
    <>
      <div className="announcement-bar">
        ✨ Fresh batches baked daily • In-store counter pickup in 15–20 mins • Handcrafted with love
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="brand-logo" aria-label="Moody Orange Home">
            <span className="brand-logo-mark" aria-hidden="true">
              🍊
            </span>
            <span>Moody Orange</span>
          </Link>

          <nav className="nav-links" aria-label="Primary Navigation">
            <Link
              href="/#menu"
              className="nav-link"
              onClick={() => handleNavClick('')}
            >
              Full Menu
            </Link>
            <Link
              href="/#menu"
              className="nav-link"
              onClick={() => handleNavClick('artisanal-cakes')}
            >
              Cakes
            </Link>
            <Link
              href="/#menu"
              className="nav-link"
              onClick={() => handleNavClick('cold-pressed-juices')}
            >
              Cold-Pressed Juices
            </Link>
            <Link
              href="/#menu"
              className="nav-link"
              onClick={() => handleNavClick('gourmet-chocolates')}
            >
              Chocolates
            </Link>
            <Link href="/#about" className="nav-link">
              Our Story
            </Link>
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setIsCartOpen(true)}
              aria-label="View Shopping Bag (0 items)"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="cart-badge" aria-hidden="true">
                0
              </span>
            </button>

            {/* Mobile menu toggle button */}
            <button
              type="button"
              className="icon-btn"
              style={{ display: 'flex' }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={isMobileMenuOpen}
            >
              <span style={{ fontSize: '1.25rem' }}>{isMobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {/* Mobile dropdown navigation */}
        {isMobileMenuOpen && (
          <div
            style={{
              backgroundColor: '#FFFDF9',
              borderBottom: '1px solid var(--color-card-border)',
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <Link
              href="/#menu"
              className="nav-link"
              style={{ fontSize: '1rem', fontWeight: 600 }}
              onClick={() => handleNavClick('')}
            >
              Full Menu
            </Link>
            <Link
              href="/#menu"
              className="nav-link"
              style={{ fontSize: '1rem', fontWeight: 600 }}
              onClick={() => handleNavClick('artisanal-cakes')}
            >
              Artisanal Cakes
            </Link>
            <Link
              href="/#menu"
              className="nav-link"
              style={{ fontSize: '1rem', fontWeight: 600 }}
              onClick={() => handleNavClick('cold-pressed-juices')}
            >
              Cold-Pressed Juices
            </Link>
            <Link
              href="/#menu"
              className="nav-link"
              style={{ fontSize: '1rem', fontWeight: 600 }}
              onClick={() => handleNavClick('gourmet-chocolates')}
            >
              Gourmet Chocolates
            </Link>
            <Link
              href="/#about"
              className="nav-link"
              style={{ fontSize: '1rem', fontWeight: 600 }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Our Story
            </Link>
          </div>
        )}
      </header>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}


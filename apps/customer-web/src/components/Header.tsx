'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { CartDrawer } from './CartDrawer';
import { AuthModal } from './AuthModal';
import { useCart } from '../lib/cart';
import { useCustomerAuth } from '../lib/auth';

interface HeaderProps {
  onCategorySelect?: (slug: string) => void;
}

export function Header({ onCategorySelect }: HeaderProps): ReactElement {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { totalQuantity } = useCart();
  const { session, isAuthenticated, logout } = useCustomerAuth();

  const handleNavClick = (slug: string) => {
    setIsMobileMenuOpen(false);
    if (onCategorySelect) {
      onCategorySelect(slug);
    }
  };

  const handleSearchFocus = () => {
    const input = document.getElementById('catalog-search-input');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      const menu = document.getElementById('menu');
      if (menu) menu.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Announcement Bar */}
      <div className="announcement-bar">
        <span className="announcement-dot" aria-hidden="true" />
        <span>Moody Orange • Artisanal Patisserie & Cold-Pressed Nectars • Fresh In-Store Counter Pickup</span>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          {/* Brand Logo */}
          <Link href="/" className="brand-logo" aria-label="Moody Orange Home">
            <span className="brand-logo-mark" aria-hidden="true">
              🍊
            </span>
            <span className="brand-logo-text">
              Moody Orange
            </span>
          </Link>

          {/* Primary Desktop Navigation */}
          <nav className="nav-links" aria-label="Primary Navigation">
            <Link
              href="/#menu"
              className="nav-link"
              onClick={() => handleNavClick('')}
            >
              Full Menu
            </Link>
            <Link
              href="/collection/artisanal-cakes"
              className="nav-link"
              onClick={() => handleNavClick('artisanal-cakes')}
            >
              Artisanal Cakes
            </Link>
            <Link
              href="/collection/cold-pressed-juices"
              className="nav-link"
              onClick={() => handleNavClick('cold-pressed-juices')}
            >
              Cold-Pressed Juices
            </Link>
            <Link
              href="/collection/gourmet-chocolates"
              className="nav-link"
              onClick={() => handleNavClick('gourmet-chocolates')}
            >
              Gourmet Chocolates
            </Link>
            <Link href="/#about" className="nav-link">
              Our Story
            </Link>
            <Link href="/#service" className="nav-link">
              Pickup & Policies
            </Link>
          </nav>

          {/* Header Action Controls */}
          <div className="header-actions">
            {/* Quick Search Trigger */}
            <button
              type="button"
              className="header-action-btn search-trigger-btn"
              onClick={handleSearchFocus}
              aria-label="Search delicacies"
              title="Quick Search"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span className="search-hint-text">Search</span>
            </button>

            {/* Authentication & User Session */}
            {isAuthenticated ? (
              <div className="user-session-group">
                <Link
                  href="/orders"
                  className="orders-link-pill"
                  aria-label="View My Orders"
                >
                  <span className="orders-icon">📋</span>
                  <span>My Orders</span>
                </Link>
                <span className="user-profile-badge" title={session?.user.phone}>
                  👤 {session?.user.fullName ? session.user.fullName.split(' ')[0] : session?.user.phone}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="btn-signout"
                  aria-label="Sign out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="btn-signin"
                aria-label="Sign in to your account"
              >
                <span aria-hidden="true">👤</span>
                <span>Sign In</span>
              </button>
            )}

            {/* Shopping Bag CTA */}
            <button
              type="button"
              className="cart-trigger-btn"
              onClick={() => setIsCartOpen(true)}
              aria-label={`View Shopping Bag (${totalQuantity} items)`}
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
              <span className={`cart-badge ${totalQuantity > 0 ? 'has-items' : ''}`} aria-hidden="true">
                {totalQuantity}
              </span>
            </button>

            {/* Mobile Menu Hamburger Toggle */}
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={isMobileMenuOpen}
            >
              <span className="hamburger-icon">{isMobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Navigation Panel */}
        {isMobileMenuOpen && (
          <div className="mobile-nav-panel" role="dialog" aria-label="Mobile Navigation">
            <Link
              href="/#menu"
              className="mobile-nav-link"
              onClick={() => handleNavClick('')}
            >
              <span>Full Menu Catalog</span>
              <span className="nav-arrow">→</span>
            </Link>
            <Link
              href="/collection/artisanal-cakes"
              className="mobile-nav-link"
              onClick={() => handleNavClick('artisanal-cakes')}
            >
              <span>Artisanal Cakes</span>
              <span className="nav-arrow">→</span>
            </Link>
            <Link
              href="/collection/cold-pressed-juices"
              className="mobile-nav-link"
              onClick={() => handleNavClick('cold-pressed-juices')}
            >
              <span>Cold-Pressed Juices</span>
              <span className="nav-arrow">→</span>
            </Link>
            <Link
              href="/collection/gourmet-chocolates"
              className="mobile-nav-link"
              onClick={() => handleNavClick('gourmet-chocolates')}
            >
              <span>Gourmet Chocolates</span>
              <span className="nav-arrow">→</span>
            </Link>
            <Link
              href="/#about"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>Our Story & Philosophy</span>
              <span className="nav-arrow">→</span>
            </Link>
            <Link
              href="/#service"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>Counter Pickup & Guarantees</span>
              <span className="nav-arrow">→</span>
            </Link>

            {isAuthenticated ? (
              <div className="mobile-user-row">
                <Link
                  href="/orders"
                  className="mobile-orders-btn"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  📋 My Orders
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="mobile-signout-btn"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAuthModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="mobile-signin-btn"
              >
                👤 Sign In / Account
              </button>
            )}
          </div>
        )}
      </header>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}

'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import Link from 'next/link';
import {
  Search,
  ShoppingBag,
  User,
  Clock,
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import type { Category } from '@orange/api-contracts';
import { fetchCategories } from '../lib/api';
import { CartDrawer } from './CartDrawer';
import { AuthModal } from './AuthModal';
import { ThemeToggle } from './ThemeProvider';
import { useCart } from '../lib/cart';
import { useCustomerAuth } from '../lib/auth';

interface HeaderProps {
  categories?: Category[];
  onCategorySelect?: (slug: string) => void;
}

export function Header({ categories: propCategories, onCategorySelect }: HeaderProps): ReactElement {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoriesDropdownOpen, setIsCategoriesDropdownOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>(propCategories || []);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDropdownMouseEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setIsCategoriesDropdownOpen(true);
  };

  const handleDropdownMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setIsCategoriesDropdownOpen(false);
    }, 220);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoriesDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
      }
    };
  }, []);

  const { totalQuantity } = useCart();
  const { session, isAuthenticated, logout } = useCustomerAuth();

  // If categories are not provided via props (e.g. on dedicated subpages), fetch them dynamically
  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setCategories(propCategories);
      return;
    }

    let isMounted = true;
    fetchCategories()
      .then((cats) => {
        if (isMounted) setCategories(cats);
      })
      .catch((err) => {
        console.warn('Failed to fetch categories for header:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [propCategories]);

  const handleNavClick = (slug: string) => {
    setIsMobileMenuOpen(false);
    setIsCategoriesDropdownOpen(false);
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
      {/* Editorial Announcement Bar */}
      <div className="announcement-bar">
        <span className="announcement-dot" aria-hidden="true" />
        <span className="announcement-text">
          Mangala Enterprises • Contemporary Food, Beverages & Gourmet Treats • In-Store Counter Pickup
        </span>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          {/* Brand Identity / Logo */}
          <Link href="/" className="brand-logo" aria-label="Mangala Enterprises Home">
            <span className="brand-logo-emblem" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </span>
            <div className="brand-logo-titles">
              <span className="brand-logo-main">MANGALA</span>
              <span className="brand-logo-sub">ENTERPRISES</span>
            </div>
          </Link>

          {/* Primary Desktop Navigation */}
          <nav className="nav-links" aria-label="Primary Navigation">
            <Link
              href="/#menu"
              className="nav-link"
              onClick={() => handleNavClick('')}
            >
              Shop All
            </Link>

            {/* Dynamic Categories Menu with Dropdown */}
            <div
              ref={dropdownRef}
              className="nav-dropdown-wrapper"
              onMouseEnter={handleDropdownMouseEnter}
              onMouseLeave={handleDropdownMouseLeave}
            >
              <button
                type="button"
                className={`nav-link nav-dropdown-trigger ${isCategoriesDropdownOpen ? 'active' : ''}`}
                aria-expanded={isCategoriesDropdownOpen}
                aria-haspopup="true"
                onClick={() => {
                  if (dropdownTimeoutRef.current) {
                    clearTimeout(dropdownTimeoutRef.current);
                    dropdownTimeoutRef.current = null;
                  }
                  setIsCategoriesDropdownOpen((prev) => !prev);
                }}
              >
                <span>Categories</span>
                <ChevronDown size={14} className={`dropdown-chevron ${isCategoriesDropdownOpen ? 'rotate' : ''}`} />
              </button>

              {isCategoriesDropdownOpen && (
                <div className="nav-dropdown-panel" role="menu">
                  <div className="dropdown-panel-inner">
                    <Link
                      href="/#menu"
                      className="dropdown-item"
                      role="menuitem"
                      onClick={() => handleNavClick('')}
                    >
                      <div className="dropdown-item-content">
                        <span className="dropdown-item-title">All Categories</span>
                        <span className="dropdown-item-desc">Explore the full in-store catalogue</span>
                      </div>
                      <ArrowRight size={14} className="dropdown-item-arrow" />
                    </Link>

                    {categories.map((cat) => (
                      <Link
                        key={cat.id || cat.slug}
                        href={`/collection/${cat.slug}`}
                        className="dropdown-item"
                        role="menuitem"
                        onClick={() => handleNavClick(cat.slug)}
                      >
                        <div className="dropdown-item-content">
                          <span className="dropdown-item-title">{cat.name}</span>
                          {cat.description && (
                            <span className="dropdown-item-desc">{cat.description}</span>
                          )}
                        </div>
                        <ArrowRight size={14} className="dropdown-item-arrow" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link href="/#about" className="nav-link">
              Our Story
            </Link>

            <Link href="/orders" className="nav-link">
              Track Order
            </Link>

            <Link href="/#service" className="nav-link">
              Store Pickup
            </Link>
          </nav>

          {/* Header Action Controls */}
          <div className="header-actions">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Quick Search */}
            <button
              type="button"
              className="header-action-btn search-trigger-btn"
              onClick={handleSearchFocus}
              aria-label="Search catalogue"
              title="Search products"
            >
              <Search size={18} aria-hidden="true" />
              <span className="search-hint-text">Search</span>
            </button>

            {/* Authentication & User Session */}
            {isAuthenticated ? (
              <div className="user-session-group">
                <Link
                  href="/orders"
                  className="orders-link-pill"
                  aria-label="View My Orders"
                  title="My Orders"
                >
                  <Clock size={15} aria-hidden="true" />
                  <span>Orders</span>
                </Link>

                <Link
                  href="/account"
                  className="account-link-pill"
                  aria-label="View Customer Account Profile"
                  title={session?.user.phone}
                >
                  <User size={15} aria-hidden="true" />
                  <span>{session?.user.fullName ? session.user.fullName.split(' ')[0] : 'Account'}</span>
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  className="btn-signout-subtle"
                  aria-label="Sign out"
                  title="Sign out of account"
                >
                  <LogOut size={14} aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="user-session-group">
                <Link
                  href="/orders"
                  className="orders-link-pill"
                  aria-label="Track Order"
                  title="Track your order status"
                >
                  <Clock size={15} aria-hidden="true" />
                  <span>Track</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="btn-signin"
                  aria-label="Sign in to your account"
                >
                  <User size={15} aria-hidden="true" />
                  <span>Sign In</span>
                </button>
              </div>
            )}

            {/* Shopping Bag Trigger */}
            <button
              type="button"
              className="cart-trigger-btn"
              onClick={() => setIsCartOpen(true)}
              aria-label={`View Shopping Bag (${totalQuantity} items)`}
            >
              <ShoppingBag size={20} aria-hidden="true" />
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
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Navigation Panel */}
        {isMobileMenuOpen && (
          <div className="mobile-nav-panel" role="dialog" aria-label="Mobile Navigation">
            <div className="mobile-theme-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Display Theme:</span>
              <ThemeToggle />
            </div>

            <Link
              href="/#menu"
              className="mobile-nav-link"
              onClick={() => handleNavClick('')}
            >
              <span>Explore All Products</span>
              <ArrowRight size={16} className="nav-arrow" />
            </Link>

            {/* Dynamic categories in mobile menu */}
            {categories.map((cat) => (
              <Link
                key={cat.id || cat.slug}
                href={`/collection/${cat.slug}`}
                className="mobile-nav-link category-sublink"
                onClick={() => handleNavClick(cat.slug)}
              >
                <span>{cat.name}</span>
                <ArrowRight size={14} className="nav-arrow" />
              </Link>
            ))}

            <Link
              href="/#about"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>Our Story & Standards</span>
              <ArrowRight size={16} className="nav-arrow" />
            </Link>

            <Link
              href="/#service"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>Store Counter Pickup</span>
              <ArrowRight size={16} className="nav-arrow" />
            </Link>

            <Link
              href="/orders"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>Track Order Status</span>
              <ArrowRight size={16} className="nav-arrow" />
            </Link>

            {isAuthenticated ? (
              <div className="mobile-user-row">
                <Link
                  href="/account"
                  className="mobile-account-btn"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <User size={15} style={{ marginRight: '6px' }} /> Account Profile
                </Link>
                <Link
                  href="/orders"
                  className="mobile-orders-btn"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Clock size={15} style={{ marginRight: '6px' }} /> My Orders
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="mobile-signout-btn"
                >
                  <LogOut size={14} style={{ marginRight: '6px' }} /> Sign Out
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
                <User size={16} style={{ marginRight: '8px' }} /> Sign In / Create Account
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

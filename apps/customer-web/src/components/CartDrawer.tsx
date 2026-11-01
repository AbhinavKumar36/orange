'use client';

import { useEffect, type ReactElement } from 'react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps): ReactElement | null {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag Preview"
    >
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="brand-logo-mark" style={{ width: '1.5rem', height: '1.5rem' }}>
              🍊
            </span>
            <h2 className="drawer-title">Shopping Bag</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close Shopping Bag"
            style={{ width: '2rem', height: '2rem' }}
          >
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div className="state-icon-circle" style={{ width: '4rem', height: '4rem' }}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>

          <div className="phase-notice-badge">Phase 3 Catalog Preview</div>

          <h3 className="state-title">Your Bag is Empty</h3>
          <p className="state-copy" style={{ fontSize: '0.875rem' }}>
            Full checkout, order reservations, and digital pickup tokens will be activated in
            Phase 5. Explore our live artisanal menu today!
          </p>

          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
}


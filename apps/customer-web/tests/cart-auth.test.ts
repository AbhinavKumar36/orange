import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatIndianPhoneNumber,
  validatePhoneNumber,
  saveCustomerSession,
  getStoredCustomerSession,
  clearCustomerSession,
  LOCAL_DEV_TEST_OTPS,
} from '../src/lib/auth';
import {
  addToCart,
  getStoredCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
} from '../src/lib/cart';
import {
  normalizeIndianPhoneNumber,
  isValidIndianPhoneNumber,
  type Product,
} from '@orange/api-contracts';

const sampleProduct: Product = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  categoryId: '11111111-1111-1111-1111-111111111111',
  categoryName: 'Artisanal Cakes',
  categorySlug: 'artisanal-cakes',
  name: 'Dark Chocolate Truffle Cake (500g)',
  slug: 'dark-chocolate-truffle-cake-500g',
  description: 'Dark chocolate sponge',
  basePrice: 65000,
  taxRatePct: 5.0,
  isVeg: true,
  allergens: ['dairy'],
  prepTimeMinutes: 20,
  imageUrl: null,
  isInStock: true,
};

// Polyfill storage & window for node test environment
const mockStorage = new Map<string, string>();
const storagePolyfill = {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
};

const mockSessionStorage = new Map<string, string>();
const sessionStoragePolyfill = {
  getItem: (k: string) => mockSessionStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockSessionStorage.set(k, String(v)),
  removeItem: (k: string) => mockSessionStorage.delete(k),
  clear: () => mockSessionStorage.clear(),
};

(globalThis as any).localStorage = storagePolyfill;
(globalThis as any).sessionStorage = sessionStoragePolyfill;
(globalThis as any).document = { cookie: '' };
(globalThis as any).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

describe('Phase 5 Web: Cart & Customer Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (globalThis as any).document.cookie = '';
  });

  describe('1. Phone Number & OTP Validation', () => {
    it('normalizes 10-digit Indian numbers to E.164 (+91XXXXXXXXXX)', () => {
      expect(formatIndianPhoneNumber('9876543210')).toBe('+919876543210');
      expect(formatIndianPhoneNumber('+919876543210')).toBe('+919876543210');
      expect(formatIndianPhoneNumber('919876543210')).toBe('+919876543210');
    });

    it('strips leading domestic trunk zero (09876543210 -> +919876543210)', () => {
      expect(formatIndianPhoneNumber('09876543210')).toBe('+919876543210');
    });

    it('handles formatted inputs with spaces and hyphens', () => {
      expect(formatIndianPhoneNumber('+91 98765-43210')).toBe('+919876543210');
      expect(formatIndianPhoneNumber('(98765) 43210')).toBe('+919876543210');
    });

    it('validates mobile numbers starting with valid Indian digits (6-9)', () => {
      expect(validatePhoneNumber('+919876543210')).toBe(true);
      expect(validatePhoneNumber('9876543210')).toBe(true);
      expect(validatePhoneNumber('8765432109')).toBe(true);
      expect(validatePhoneNumber('7654321098')).toBe(true);
      expect(validatePhoneNumber('6543210987')).toBe(true);

      // Rejects non-mobile prefix (starts with 1, 2, 3, etc.)
      expect(validatePhoneNumber('1234567890')).toBe(false);
      expect(validatePhoneNumber('5234567890')).toBe(false);
      expect(validatePhoneNumber('')).toBe(false);
      expect(validatePhoneNumber('not-a-number')).toBe(false);
    });

    it('rejects duplicate country prefixes and non-Indian numbers', () => {
      const dupResult = normalizeIndianPhoneNumber('+91919876543210');
      expect(dupResult.isValid).toBe(false);

      const nonIndia = normalizeIndianPhoneNumber('+14155552671');
      expect(nonIndia.isValid).toBe(false);
      expect(nonIndia.error).toContain('+91');
    });

    it('has local dev test OTPs configured for zero-cost authentication', () => {
      expect(LOCAL_DEV_TEST_OTPS['+919876543210']).toBe('123456');
    });

    it('persists and restores customer session across storage and sets cookie', () => {
      const session = {
        accessToken: 'mock_token_abc_123',
        user: {
          id: 'user-uuid-1',
          phone: '+919876543210',
          fullName: 'Boutique Customer',
        },
        expiresAt: Date.now() + 3600 * 1000,
      };

      saveCustomerSession(session);
      const restored = getStoredCustomerSession();
      expect(restored).not.toBeNull();
      expect(restored?.user.phone).toBe('+919876543210');
      expect(restored?.user.fullName).toBe('Boutique Customer');
      expect((globalThis as any).document.cookie).toContain('moody_session=');

      clearCustomerSession();
      expect(getStoredCustomerSession()).toBeNull();
    });
  });

  describe('2. Shopping Cart Operations', () => {
    it('adds item to cart and preserves item details', () => {
      addToCart(sampleProduct, 1);
      const cart = getStoredCart();
      expect(cart.length).toBe(1);
      expect(cart[0].product.id).toBe(sampleProduct.id);
      expect(cart[0].quantity).toBe(1);
    });

    it('increments quantity when same product is added multiple times', () => {
      addToCart(sampleProduct, 1);
      addToCart(sampleProduct, 2);
      const cart = getStoredCart();
      expect(cart.length).toBe(1);
      expect(cart[0].quantity).toBe(3);
    });

    it('updates quantity of an existing item', () => {
      addToCart(sampleProduct, 1);
      updateCartQuantity(sampleProduct.id, 5);
      const cart = getStoredCart();
      expect(cart[0].quantity).toBe(5);
    });

    it('removes item when quantity is updated to zero', () => {
      addToCart(sampleProduct, 2);
      updateCartQuantity(sampleProduct.id, 0);
      const cart = getStoredCart();
      expect(cart.length).toBe(0);
    });

    it('removes item explicitly by productId', () => {
      addToCart(sampleProduct, 2);
      removeFromCart(sampleProduct.id);
      const cart = getStoredCart();
      expect(cart.length).toBe(0);
    });

    it('clears entire cart', () => {
      addToCart(sampleProduct, 2);
      clearCart();
      const cart = getStoredCart();
      expect(cart.length).toBe(0);
    });
  });
});

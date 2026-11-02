'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Product } from '@orange/api-contracts';

const CART_STORAGE_KEY = 'moody_orange_cart_v1';

export interface CartItemWithProduct {
  product: Product;
  quantity: number;
}

export function getStoredCart(): CartItemWithProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItemWithProduct[];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItemWithProduct[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('moody_orange_cart_change'));
  } catch {
    // LocalStorage quota or privacy mode
  }
}

export function addToCart(product: Product, quantity = 1): void {
  if (!product.isInStock) return;
  const current = getStoredCart();
  const existingIndex = current.findIndex((item) => item.product.id === product.id);

  if (existingIndex >= 0) {
    const newQty = Math.min(100, current[existingIndex].quantity + quantity);
    current[existingIndex].quantity = newQty;
  } else {
    current.push({ product, quantity: Math.min(100, Math.max(1, quantity)) });
  }

  saveCart(current);
}

export function updateCartQuantity(productId: string, quantity: number): void {
  const current = getStoredCart();
  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  const existing = current.find((item) => item.product.id === productId);
  if (existing) {
    existing.quantity = Math.min(100, quantity);
    saveCart(current);
  }
}

export function removeFromCart(productId: string): void {
  const current = getStoredCart();
  const filtered = current.filter((item) => item.product.id !== productId);
  saveCart(filtered);
}

export function clearCart(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    window.dispatchEvent(new Event('moody_orange_cart_change'));
  } catch {
    // Ignore
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshCart = useCallback(() => {
    setItems(getStoredCart());
  }, []);

  useEffect(() => {
    setItems(getStoredCart());
    setIsLoaded(true);

    function handleChange() {
      refreshCart();
    }

    window.addEventListener('moody_orange_cart_change', handleChange);
    return () => {
      window.removeEventListener('moody_orange_cart_change', handleChange);
    };
  }, [refreshCart]);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.product.basePrice * item.quantity, 0);

  return {
    items,
    isLoaded,
    totalQuantity,
    subtotal,
    addToCart,
    updateQuantity: updateCartQuantity,
    removeFromCart,
    clearCart,
  };
}


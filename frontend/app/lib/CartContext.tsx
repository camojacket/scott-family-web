'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { CartItem } from '../lib/types';

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;
  clearCart: () => void;
  totalCents: number;
  totalItems: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = 'reunion-cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Persist cart to localStorage on change
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.variantId === item.variantId);
      if (existing) {
        return prev.map(i =>
          i.variantId === item.variantId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((variantId: number) => {
    setItems(prev => prev.filter(i => i.variantId !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.variantId !== variantId));
      return;
    }
    setItems(prev =>
      prev.map(i => i.variantId === variantId ? { ...i, quantity } : i)
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  const totalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalCents, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

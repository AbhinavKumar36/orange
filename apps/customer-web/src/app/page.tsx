'use client';

import { useState, useEffect, useCallback, useMemo, type ReactElement } from 'react';
import type { Category, Product } from '@orange/api-contracts';
import { fetchCategories, fetchProducts } from '../lib/api';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { FeaturedCollections } from '../components/FeaturedCollections';
import { ProductShowcase } from '../components/ProductShowcase';
import { CategoryNav } from '../components/CategoryNav';
import { SearchBar } from '../components/SearchBar';
import { ProductGrid } from '../components/ProductGrid';
import { BrandStory } from '../components/BrandStory';
import { BrandValues } from '../components/BrandValues';
import { Footer } from '../components/Footer';
import { CartDrawer } from '../components/CartDrawer';

export default function HomePage(): ReactElement {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isVegOnly, setIsVegOnly] = useState<boolean>(false);
  const [isInStockOnly, setIsInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'prep-asc'>('featured');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, prods] = await Promise.all([
        fetchCategories().catch((e) => {
          console.warn('Could not load categories:', e);
          return [] as Category[];
        }),
        fetchProducts(),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load menu'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side filtering & sorting across current catalog dataset
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filter
    if (selectedCategorySlug) {
      const target = selectedCategorySlug.toLowerCase();
      result = result.filter((p) => p.categorySlug.toLowerCase() === target);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.categoryName.toLowerCase().includes(q)
      );
    }

    // Vegetarian toggle
    if (isVegOnly) {
      result = result.filter((p) => p.isVeg);
    }

    // In-Stock toggle
    if (isInStockOnly) {
      result = result.filter((p) => p.isInStock);
    }

    // Sorting
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.basePrice - b.basePrice);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.basePrice - a.basePrice);
    } else if (sortBy === 'prep-asc') {
      result.sort((a, b) => a.prepTimeMinutes - b.prepTimeMinutes);
    }

    return result;
  }, [products, selectedCategorySlug, searchQuery, isVegOnly, isInStockOnly, sortBy]);

  const handleResetFilters = () => {
    setSelectedCategorySlug('');
    setSearchQuery('');
    setIsVegOnly(false);
    setIsInStockOnly(false);
    setSortBy('featured');
  };

  const hasActiveFilters = Boolean(
    selectedCategorySlug || searchQuery.trim() || isVegOnly || isInStockOnly || sortBy !== 'featured'
  );

  return (
    <>
      <Header onCategorySelect={(slug) => setSelectedCategorySlug(slug)} />

      <main id="main-content">
        {/* 1. Cinematic 3D Hero */}
        <Hero />

        {/* 2. Featured Editorial Collections */}
        <div id="collections">
          <FeaturedCollections
            categories={categories}
            products={products}
            onSelectCategory={(slug) => {
              setSelectedCategorySlug(slug);
              const menuEl = document.getElementById('menu');
              if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>

        {/* 3. Interactive 3D Product Showcase */}
        <ProductShowcase
          products={products}
          onOpenCart={() => setIsCartOpen(true)}
        />

        {/* 4. Live Store Menu & Catalog Section */}
        <section id="menu" className="category-nav-section" aria-label="Menu Catalog">
          <div className="container">
            <div className="menu-header-bar">
              <div>
                <div className="section-subtitle">Store Menu</div>
                <h2 className="section-title">Explore Our Catalog</h2>
              </div>

              {/* Sorting & Filter Controls */}
              <div className="menu-filter-controls">
                <label className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isVegOnly}
                    onChange={(e) => setIsVegOnly(e.target.checked)}
                  />
                  <span>🌱 Veg Only</span>
                </label>

                <label className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isInStockOnly}
                    onChange={(e) => setIsInStockOnly(e.target.checked)}
                  />
                  <span>🟢 In Stock</span>
                </label>

                <div className="sort-dropdown-box">
                  <span className="sort-label">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'featured' | 'price-asc' | 'price-desc' | 'prep-asc')}
                    className="sort-select"
                    aria-label="Sort delicacies"
                  >
                    <option value="featured">Featured Curations</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="prep-asc">Prep Time: Fastest</option>
                  </select>
                </div>
              </div>
            </div>

            <CategoryNav
              categories={categories}
              selectedSlug={selectedCategorySlug}
              onSelectCategory={(slug) => setSelectedCategorySlug(slug)}
            />

            <SearchBar
              query={searchQuery}
              onChange={(q) => setSearchQuery(q)}
              resultCount={isLoading || error ? undefined : filteredProducts.length}
            />

            <ProductGrid
              products={filteredProducts}
              isLoading={isLoading}
              error={error}
              onRetry={loadData}
              onResetFilters={handleResetFilters}
              hasActiveFilters={hasActiveFilters}
              onOpenCart={() => setIsCartOpen(true)}
            />
          </div>
        </section>

        {/* 5. Editorial Brand Story */}
        <BrandStory />

        {/* 6. Trust & Pickup Capabilities */}
        <BrandValues />
      </main>

      <Footer />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}

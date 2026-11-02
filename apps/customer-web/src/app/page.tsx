'use client';

import { useState, useEffect, useCallback, useMemo, type ReactElement } from 'react';
import type { Category, Product } from '@orange/api-contracts';
import { fetchCategories, fetchProducts } from '../lib/api';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { CategoryNav } from '../components/CategoryNav';
import { SearchBar } from '../components/SearchBar';
import { ProductGrid } from '../components/ProductGrid';
import { BrandValues } from '../components/BrandValues';
import { Footer } from '../components/Footer';

export default function HomePage(): ReactElement {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

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

  // Client-side filtering across current catalog dataset
  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategorySlug) {
      const target = selectedCategorySlug.toLowerCase();
      result = result.filter((p) => p.categorySlug.toLowerCase() === target);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.categoryName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [products, selectedCategorySlug, searchQuery]);

  const handleResetFilters = () => {
    setSelectedCategorySlug('');
    setSearchQuery('');
  };

  const hasActiveFilters = Boolean(selectedCategorySlug || searchQuery.trim());

  return (
    <>
      <Header onCategorySelect={(slug) => setSelectedCategorySlug(slug)} />

      <main id="main-content">
        <Hero />

        <section id="menu" className="category-nav-section" aria-label="Menu Catalog">
          <div className="container">
            <div className="section-header" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <div className="section-subtitle">Store Menu</div>
              <h2 className="section-title">Explore Our Catalog</h2>
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
            />
          </div>
        </section>

        <BrandValues />
      </main>

      <Footer />
    </>
  );
}

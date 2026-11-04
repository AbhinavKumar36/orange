'use client';

import { useState, useEffect, useCallback, useMemo, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Category, Product } from '@orange/api-contracts';
import { fetchCategories, fetchProducts } from '../../../lib/api';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';
import { ProductGrid } from '../../../components/ProductGrid';
import { SearchBar } from '../../../components/SearchBar';
import { CartDrawer } from '../../../components/CartDrawer';

export default function CollectionPage(): ReactElement {
  const params = useParams();
  const slug = params && typeof params.slug === 'string'
    ? params.slug
    : Array.isArray(params?.slug)
    ? params.slug[0]
    : '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [isInStockOnly, setIsInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'prep-asc'>('featured');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, prods] = await Promise.all([
        fetchCategories().catch(() => [] as Category[]),
        fetchProducts(),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load collection'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Current active category
  const activeCategory = useMemo(() => {
    return categories.find((c) => c.slug.toLowerCase() === slug.toLowerCase()) || {
      id: '',
      name: slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Collection',
      slug,
      description: 'Handcrafted delicacies prepared for in-store pickup.',
      display_order: 0,
    };
  }, [categories, slug]);

  // Filtered & sorted products in this collection
  const collectionProducts = useMemo(() => {
    let result = products.filter(
      (p) => !slug || p.categorySlug.toLowerCase() === slug.toLowerCase()
    );

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (isVegOnly) {
      result = result.filter((p) => p.isVeg);
    }

    if (isInStockOnly) {
      result = result.filter((p) => p.isInStock);
    }

    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.basePrice - b.basePrice);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.basePrice - a.basePrice);
    } else if (sortBy === 'prep-asc') {
      result.sort((a, b) => a.prepTimeMinutes - b.prepTimeMinutes);
    }

    return result;
  }, [products, slug, searchQuery, isVegOnly, isInStockOnly, sortBy]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setIsVegOnly(false);
    setIsInStockOnly(false);
    setSortBy('featured');
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() || isVegOnly || isInStockOnly || sortBy !== 'featured'
  );

  return (
    <>
      <Header />

      <main id="main-content" className="collection-page-wrapper">
        {/* Editorial Collection Hero Banner */}
        <section className="collection-hero-banner" aria-label="Collection Overview">
          <div className="container">
            <nav aria-label="Breadcrumb" className="breadcrumbs">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/#menu">Catalog</Link>
              <span aria-hidden="true">/</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                {activeCategory.name}
              </span>
            </nav>

            <div className="collection-hero-content">
              <span className="collection-kicker">Signature Selection</span>
              <h1 className="collection-hero-title">{activeCategory.name}</h1>
              <p className="collection-hero-desc">
                {activeCategory.description || 'Artisanal recipes prepared fresh in small batches for counter pickup.'}
              </p>

              {/* Other Collections Quick Navigation */}
              <div className="collection-pill-tabs" role="tablist" aria-label="Other Collections">
                <Link
                  href="/#menu"
                  className="collection-tab-pill"
                >
                  All Items
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/collection/${c.slug}`}
                    className={`collection-tab-pill ${c.slug === slug ? 'active' : ''}`}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Catalog Section */}
        <section className="container collection-catalog-section">
          {/* Filter Bar */}
          <div className="collection-toolbar">
            <SearchBar
              query={searchQuery}
              onChange={(q) => setSearchQuery(q)}
              resultCount={isLoading || error ? undefined : collectionProducts.length}
            />

            <div className="collection-filter-group">
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

          {/* Product Grid */}
          <ProductGrid
            products={collectionProducts}
            isLoading={isLoading}
            error={error}
            onRetry={loadData}
            onResetFilters={handleResetFilters}
            hasActiveFilters={hasActiveFilters}
            onOpenCart={() => setIsCartOpen(true)}
          />
        </section>
      </main>

      <Footer />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}

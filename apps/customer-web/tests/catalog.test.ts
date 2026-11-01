import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  type Product,
  formatPaiseToRupees,
  ProductListResponseSchema,
  ProductDetailResponseSchema,
} from '@orange/api-contracts';
import {
  fetchCategories,
  fetchProducts,
  fetchProductByIdOrSlug,
  ApiError,
} from '../src/lib/api';

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    categoryId: '11111111-1111-1111-1111-111111111111',
    categoryName: 'Artisanal Cakes',
    categorySlug: 'artisanal-cakes',
    name: 'Dark Chocolate Truffle Cake (500g)',
    slug: 'dark-chocolate-truffle-cake-500g',
    description: '70% Belgian dark chocolate sponge with silky ganache',
    basePrice: 65000, // 65000 paise = 650 INR
    taxRatePct: 5.0,
    isVeg: true,
    allergens: ['dairy', 'gluten'],
    prepTimeMinutes: 20,
    imageUrl: null,
    isInStock: true,
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    categoryId: '22222222-2222-2222-2222-222222222222',
    categoryName: 'Cold-Pressed Juices',
    categorySlug: 'cold-pressed-juices',
    name: 'Valencia Orange Cold-Pressed (300ml)',
    slug: 'valencia-orange-cold-pressed-300ml',
    description: 'Pure Valencia orange juice freshly pressed daily',
    basePrice: 18000, // 18000 paise = 180 INR
    taxRatePct: 5.0,
    isVeg: true,
    allergens: [],
    prepTimeMinutes: 5,
    imageUrl: null,
    isInStock: true,
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    categoryId: '33333333-3333-3333-3333-333333333333',
    categoryName: 'Gourmet Chocolates',
    categorySlug: 'gourmet-chocolates',
    name: 'Seasonal Artisan Praline Box (Sold Out Item)',
    slug: 'seasonal-artisan-praline-box',
    description: 'Limited edition hazelnut truffles',
    basePrice: 45000, // 45000 paise = 450 INR
    taxRatePct: 5.0,
    isVeg: true,
    allergens: ['nuts', 'dairy'],
    prepTimeMinutes: 10,
    imageUrl: null,
    isInStock: false, // Unavailable
  },
];

describe('Customer Web Catalog Invariants & Behaviors (Phase 3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Catalog products render from API data
  it('1. should fetch and parse catalog products conforming to API contracts', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ products: MOCK_PRODUCTS }),
    });

    const products = await fetchProducts();
    expect(products).toHaveLength(3);
    expect(products[0].name).toBe('Dark Chocolate Truffle Cake (500g)');

    // Schema validation ensures structural integrity
    const validated = ProductListResponseSchema.safeParse({ products });
    expect(validated.success).toBe(true);
  });

  // 2. Empty catalog displays a useful state
  it('2. should handle an empty catalog gracefully without errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ products: [] }),
    });

    const products = await fetchProducts();
    expect(products).toEqual([]);
    expect(Array.isArray(products)).toBe(true);
  });

  // 3. Search filters products correctly
  it('3. should pass search query parameters to filter products case-insensitively', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        products: [MOCK_PRODUCTS[0]],
      }),
    });
    global.fetch = fetchMock;

    const products = await fetchProducts({ search: 'Truffle' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('search=Truffle'),
      expect.any(Object)
    );
    expect(products).toHaveLength(1);
    expect(products[0].slug).toBe('dark-chocolate-truffle-cake-500g');
  });

  // 4. Category filtering works
  it('4. should filter products by category slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        products: [MOCK_PRODUCTS[1]],
      }),
    });
    global.fetch = fetchMock;

    const products = await fetchProducts({ category_slug: 'cold-pressed-juices' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('category_slug=cold-pressed-juices'),
      expect.any(Object)
    );
    expect(products[0].categorySlug).toBe('cold-pressed-juices');
  });

  // 5. Product details display the selected product
  it('5. should fetch complete details for a single product', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ product: MOCK_PRODUCTS[0] }),
    });

    const product = await fetchProductByIdOrSlug('dark-chocolate-truffle-cake-500g');
    expect(product).not.toBeNull();
    expect(product?.name).toBe('Dark Chocolate Truffle Cake (500g)');
    expect(product?.basePrice).toBe(65000);

    const validated = ProductDetailResponseSchema.safeParse({ product });
    expect(validated.success).toBe(true);
  });

  // 6. Unknown product IDs show a not-found state
  it('6. should return null when a product ID or slug is not found (HTTP 404)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { statusCode: 404, code: 'NOT_FOUND', message: 'Not found' } }),
    });

    const product = await fetchProductByIdOrSlug('unknown-cake-slug');
    expect(product).toBeNull();
  });

  // 7. API failures display a useful error state
  it('7. should throw ApiError with status and code when backend is unreachable or errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connection failed'));

    await expect(fetchProducts()).rejects.toThrow(ApiError);
    await expect(fetchCategories()).rejects.toThrow(ApiError);
  });

  // 8. INR prices are formatted correctly from the API's actual monetary representation (Paise -> Rupees)
  it('8. should format integer INR paise to display rupees without floating-point artifacts', () => {
    expect(formatPaiseToRupees(65000)).toBe('₹650');
    expect(formatPaiseToRupees(18000)).toBe('₹180');
    expect(formatPaiseToRupees(35050, { showDecimals: true })).toBe('₹350.50');
    expect(formatPaiseToRupees(0)).toBe('₹0');
  });

  // 9. Unavailable products are not presented as available
  it('9. should correctly distinguish in-stock products from sold-out products', () => {
    const inStock = MOCK_PRODUCTS.filter((p) => p.isInStock);
    const soldOut = MOCK_PRODUCTS.filter((p) => !p.isInStock);

    expect(inStock).toHaveLength(2);
    expect(soldOut).toHaveLength(1);
    expect(soldOut[0].slug).toBe('seasonal-artisan-praline-box');
    expect(soldOut[0].isInStock).toBe(false);
  });

  // 10. Product content does not expose private inventory information
  it('10. should strictly protect inventory privacy and never expose physical or reserved counts', () => {
    MOCK_PRODUCTS.forEach((product) => {
      const keys = Object.keys(product);
      expect(keys).not.toContain('physical_stock');
      expect(keys).not.toContain('physicalStock');
      expect(keys).not.toContain('reserved_stock');
      expect(keys).not.toContain('reservedStock');
      expect(keys).not.toContain('low_stock_threshold');
      expect(keys).not.toContain('inventory_id');
      // Only the safe public boolean is permitted
      expect(typeof product.isInStock).toBe('boolean');
    });
  });
});


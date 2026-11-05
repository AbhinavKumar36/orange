import type { FastifyPluginAsync } from 'fastify';
import {
  type Category,
  type Product,
  CategoryListResponseSchema,
  ProductListResponseSchema,
  ProductDetailResponseSchema,
} from '@orange/api-contracts';
import { type AppConfig, loadConfig } from '../config/env.js';
import { mockStockStore } from '../services/inventoryStore.js';

// Canonical fallback catalog matching supabase/seed.sql
export const CANONICAL_CATEGORIES: Category[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Artisanal Cakes',
    slug: 'artisanal-cakes',
    description: 'Freshly baked boutique gourmet cakes',
    display_order: 1,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Cold-Pressed Juices',
    slug: 'cold-pressed-juices',
    description: 'Raw, 100% natural cold-pressed fruit juices',
    display_order: 2,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Gourmet Chocolates',
    slug: 'gourmet-chocolates',
    description: 'Handcrafted single-origin chocolate confections',
    display_order: 3,
  },
];

export const CANONICAL_PRODUCTS: Product[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    categoryId: '11111111-1111-1111-1111-111111111111',
    categoryName: 'Artisanal Cakes',
    categorySlug: 'artisanal-cakes',
    name: 'Dark Chocolate Truffle Cake (500g)',
    slug: 'dark-chocolate-truffle-cake-500g',
    description: '70% Belgian dark chocolate sponge with silky ganache. In-store ready to sell.',
    basePrice: 65000, // integer INR paise (₹650)
    taxRatePct: 5.0,
    isVeg: true,
    foodClassification: 'vegetarian',
    allergens: ['dairy', 'gluten'],
    prepTimeMinutes: 20,
    imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80',
    isInStock: true,
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    categoryId: '22222222-2222-2222-2222-222222222222',
    categoryName: 'Cold-Pressed Juices',
    categorySlug: 'cold-pressed-juices',
    name: 'Valencia Orange Cold-Pressed (300ml)',
    slug: 'valencia-orange-cold-pressed-300ml',
    description: 'Pure Valencia orange juice cold-pressed and bottled, chilled and ready in display counter.',
    basePrice: 18000, // integer INR paise (₹180)
    taxRatePct: 5.0,
    isVeg: true,
    foodClassification: 'vegetarian',
    allergens: [],
    prepTimeMinutes: 5,
    imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80',
    isInStock: true,
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    categoryId: '33333333-3333-3333-3333-333333333333',
    categoryName: 'Gourmet Chocolates',
    categorySlug: 'gourmet-chocolates',
    name: 'Artisanal Praline Box (6 pcs)',
    slug: 'artisanal-praline-box-6-pcs',
    description: 'Assorted roasted hazelnut and almond pralines in luxury presentation box. Ready to collect.',
    basePrice: 35000, // integer INR paise (₹350)
    taxRatePct: 5.0,
    isVeg: true,
    foodClassification: 'vegetarian',
    allergens: ['nuts', 'dairy'],
    prepTimeMinutes: 10,
    imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=800&q=80',
    isInStock: true,
  },
];

export interface MockProductEntry extends Product {
  isActive: boolean;
  lowStockThreshold: number;
}

export let mockCategoriesList: Category[] = CANONICAL_CATEGORIES.map((c) => ({ ...c }));
export let mockProductsList: MockProductEntry[] = CANONICAL_PRODUCTS.map((p) => ({
  ...p,
  isActive: true,
  lowStockThreshold: 5,
}));

export function resetMockCatalogStore(): void {
  mockCategoriesList = CANONICAL_CATEGORIES.map((c) => ({ ...c }));
  mockProductsList = CANONICAL_PRODUCTS.map((p) => ({
    ...p,
    isActive: true,
    lowStockThreshold: 5,
  }));
}

interface SupabaseCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface SupabaseProductRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number | string;
  tax_rate_pct: number | string;
  is_veg: boolean;
  food_classification?: string | null;
  allergens: string[];
  prep_time_minutes: number;
  image_url: string | null;
  is_active: boolean;
  categories?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface SupabaseAvailabilityRow {
  product_id: string;
  is_in_stock: boolean;
}

async function fetchFromSupabase<T>(config: AppConfig, path: string): Promise<T | null> {
  const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
  const url = `${baseUrl}/rest/v1/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;
  if (apiKey) {
    headers.apikey = apiKey;
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      // Log structured error in non-test environments to aid troubleshooting
      if (config.NODE_ENV !== 'test') {
        console.warn(`[Supabase REST Error] ${res.status} ${res.statusText} at ${url}: ${errorText}`);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (config.NODE_ENV !== 'test') {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Supabase Connection Failed] Unable to reach ${url}: ${msg}`);
    }
    return null;
  }
}

async function loadCategories(config: AppConfig): Promise<Category[] | null> {
  const dbRows = await fetchFromSupabase<SupabaseCategoryRow[]>(
    config,
    'categories?is_active=eq.true&order=display_order.asc'
  );

  if (dbRows && Array.isArray(dbRows)) {
    return dbRows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      display_order: row.display_order,
    }));
  }

  // In production, NEVER return mock/sample categories: return null to trigger 503 DATABASE_UNAVAILABLE
  if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
    return mockCategoriesList;
  }

  return null;
}

async function loadProducts(config: AppConfig): Promise<Product[] | null> {
  const [productRows, availabilityRows] = await Promise.all([
    fetchFromSupabase<SupabaseProductRow[]>(
      config,
      'products?select=id,category_id,name,slug,description,base_price,tax_rate_pct,is_veg,allergens,prep_time_minutes,image_url,is_active,categories(id,name,slug)&is_active=eq.true&order=created_at.asc'
    ),
    fetchFromSupabase<SupabaseAvailabilityRow[]>(config, 'product_availability'),
  ]);

  if (productRows && Array.isArray(productRows)) {
    const availabilityMap = new Map<string, boolean>();
    if (availabilityRows && Array.isArray(availabilityRows)) {
      availabilityRows.forEach((row) => {
        availabilityMap.set(row.product_id, Boolean(row.is_in_stock));
      });
    }

    // CRITICAL AVAILABILITY SAFETY:
    // 1. Never default missing availability data to true.
    // 2. If a product has no matching availability record, treat it as unavailable (false).
    // 3. If the availability endpoint fails entirely (availabilityRows is null), availabilityMap is empty,
    //    so every product is conservatively marked unavailable (false).
    // 4. Do not expose physical or reserved stock counts.
    return productRows.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.categories?.name ?? 'General',
      categorySlug: row.categories?.slug ?? 'general',
      name: row.name,
      slug: row.slug,
      description: row.description,
      basePrice: typeof row.base_price === 'string' ? parseInt(row.base_price, 10) : row.base_price,
      taxRatePct:
        typeof row.tax_rate_pct === 'string' ? parseFloat(row.tax_rate_pct) : row.tax_rate_pct,
      isVeg: row.is_veg,
      foodClassification:
        row.food_classification === 'vegetarian' || row.food_classification === 'non_vegetarian'
          ? row.food_classification
          : row.is_veg
          ? 'vegetarian'
          : 'non_vegetarian',
      allergens: Array.isArray(row.allergens) ? row.allergens : [],
      prepTimeMinutes: row.prep_time_minutes,
      imageUrl: row.image_url,
      isInStock: availabilityMap.get(row.id) ?? false,
    }));
  }

  // In production, NEVER return mock/sample products: return null to trigger 503 DATABASE_UNAVAILABLE
  if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
    return mockProductsList
      .filter((p) => p.isActive)
      .map((p) => {
        const stock = mockStockStore.get(p.id);
        const available = stock ? stock.physical - stock.reserved : 50;
        return {
          ...p,
          isInStock: available > 0,
        };
      });
  }

  return null;
}

export interface CatalogRoutesOptions {
  config?: AppConfig;
}

export const catalogRoutes: FastifyPluginAsync<CatalogRoutesOptions> = async (app, options) => {
  const config = options.config ?? loadConfig();

  // 1. GET /api/v1/categories
  app.get('/api/v1/categories', async (request, reply) => {
    const categories = await loadCategories(config);

    if (categories === null) {
      return reply.status(503).send({
        error: {
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database service is temporarily unavailable.',
        },
      });
    }

    const payload = { categories };
    CategoryListResponseSchema.parse(payload);
    return reply.send(payload);
  });

  // 2. GET /api/v1/products
  app.get<{
    Querystring: {
      category_id?: string;
      category_slug?: string;
      search?: string;
    };
  }>('/api/v1/products', async (request, reply) => {
    const products = await loadProducts(config);

    if (products === null) {
      return reply.status(503).send({
        error: {
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database service is temporarily unavailable.',
        },
      });
    }

    let filtered = products;

    if (request.query.category_id) {
      const targetId = request.query.category_id.toLowerCase();
      filtered = filtered.filter((p) => p.categoryId.toLowerCase() === targetId);
    }

    if (request.query.category_slug) {
      const targetSlug = request.query.category_slug.toLowerCase();
      filtered = filtered.filter((p) => p.categorySlug.toLowerCase() === targetSlug);
    }

    if (request.query.search) {
      const q = request.query.search.trim().toLowerCase();
      if (q.length > 0) {
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
      }
    }

    const payload = { products: filtered };
    ProductListResponseSchema.parse(payload);
    return reply.send(payload);
  });

  // 3. GET /api/v1/products/:idOrSlug
  app.get<{
    Params: {
      idOrSlug: string;
    };
  }>('/api/v1/products/:idOrSlug', async (request, reply) => {
    const { idOrSlug } = request.params;
    const products = await loadProducts(config);

    if (products === null) {
      return reply.status(503).send({
        error: {
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database service is temporarily unavailable.',
        },
      });
    }

    const target = idOrSlug.toLowerCase();
    const product = products.find(
      (p) => p.id.toLowerCase() === target || p.slug.toLowerCase() === target
    );

    if (!product) {
      return reply.status(404).send({
        error: {
          statusCode: 404,
          code: 'PRODUCT_NOT_FOUND',
          message: `Product with identifier '${idOrSlug}' not found.`,
        },
      });
    }

    const payload = { product };
    ProductDetailResponseSchema.parse(payload);
    return reply.send(payload);
  });
};


import type { FastifyPluginAsync } from 'fastify';
import {
  type Category,
  type Product,
  CategoryListResponseSchema,
  ProductListResponseSchema,
  ProductDetailResponseSchema,
} from '@orange/api-contracts';
import { type AppConfig, loadConfig } from '../config/env.js';

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
    description: '70% Belgian dark chocolate sponge with silky ganache',
    basePrice: 65000, // integer INR paise (₹650)
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
    basePrice: 18000, // integer INR paise (₹180)
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
    name: 'Artisanal Praline Box (6 pcs)',
    slug: 'artisanal-praline-box-6-pcs',
    description: 'Assorted roasted hazelnut and almond pralines',
    basePrice: 35000, // integer INR paise (₹350)
    taxRatePct: 5.0,
    isVeg: true,
    allergens: ['nuts', 'dairy'],
    prepTimeMinutes: 10,
    imageUrl: null,
    isInStock: true,
  },
];

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
  const url = `${config.SUPABASE_URL}/rest/v1/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (config.SUPABASE_SERVICE_ROLE_KEY) {
    headers.apikey = config.SUPABASE_SERVICE_ROLE_KEY;
    headers.Authorization = `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    clearTimeout(timeoutId);
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

  // If database is unreachable in test or mock service mode, return canonical seed categories
  if (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test') {
    return CANONICAL_CATEGORIES;
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
        availabilityMap.set(row.product_id, row.is_in_stock);
      });
    }

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
      allergens: Array.isArray(row.allergens) ? row.allergens : [],
      prepTimeMinutes: row.prep_time_minutes,
      imageUrl: row.image_url,
      isInStock: availabilityMap.get(row.id) ?? true,
    }));
  }

  // If database is unreachable in test or mock service mode, return canonical seed products
  if (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test') {
    return CANONICAL_PRODUCTS;
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


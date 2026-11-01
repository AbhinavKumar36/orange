import {
  type Category,
  type Product,
  CategoryListResponseSchema,
  ProductListResponseSchema,
  ProductDetailResponseSchema,
} from '@orange/api-contracts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/categories`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      let message = `Failed to fetch categories (status ${res.status})`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson?.error?.message) {
          message = errJson.error.message;
        }
      } catch {
        // Fallback to HTTP status message
      }
      throw new ApiError(res.status, 'CATEGORIES_FETCH_FAILED', message);
    }

    const data = await res.json();
    const parsed = CategoryListResponseSchema.parse(data);
    return parsed.categories;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      503,
      'BACKEND_UNAVAILABLE',
      `Store server is unreachable at ${API_BASE_URL}. Ensure the backend API is running on port 4000.`
    );
  }
}

export interface FetchProductsParams {
  category_id?: string;
  category_slug?: string;
  search?: string;
}

export async function fetchProducts(params: FetchProductsParams = {}): Promise<Product[]> {
  try {
    const query = new URLSearchParams();
    if (params.category_id) query.set('category_id', params.category_id);
    if (params.category_slug) query.set('category_slug', params.category_slug);
    if (params.search) query.set('search', params.search);

    const qs = query.toString();
    const url = `${API_BASE_URL}/products${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      let message = `Failed to fetch products (status ${res.status})`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson?.error?.message) {
          message = errJson.error.message;
        }
      } catch {
        // Fallback to HTTP status message
      }
      throw new ApiError(res.status, 'PRODUCTS_FETCH_FAILED', message);
    }

    const data = await res.json();
    const parsed = ProductListResponseSchema.parse(data);
    return parsed.products;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      503,
      'BACKEND_UNAVAILABLE',
      `Store server is unreachable at ${API_BASE_URL}. Ensure the backend API is running on port 4000.`
    );
  }
}

export async function fetchProductByIdOrSlug(idOrSlug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(idOrSlug)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      let message = `Failed to fetch product (status ${res.status})`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson?.error?.message) {
          message = errJson.error.message;
        }
      } catch {
        // Fallback to HTTP status message
      }
      throw new ApiError(res.status, 'PRODUCT_FETCH_FAILED', message);
    }

    const data = await res.json();
    const parsed = ProductDetailResponseSchema.parse(data);
    return parsed.product;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      503,
      'BACKEND_UNAVAILABLE',
      `Store server is unreachable at ${API_BASE_URL}. Ensure the backend API is running on port 4000.`
    );
  }
}


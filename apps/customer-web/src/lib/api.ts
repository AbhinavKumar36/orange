import {
  type Category,
  type Product,
  type ValidateCartResponse,
  type CheckoutRequest,
  type CheckoutResponse,
  type Order,
  type CustomerProfile,
  type InitiatePaymentResponse,
  type VerifyPaymentRequest,
  type VerifyPaymentResponse,
  CategoryListResponseSchema,
  ProductListResponseSchema,
  ProductDetailResponseSchema,
  ValidateCartResponseSchema,
  CheckoutResponseSchema,
  OrderListResponseSchema,
  OrderDetailResponseSchema,
  CustomerProfileResponseSchema,
  InitiatePaymentResponseSchema,
  VerifyPaymentResponseSchema,
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

interface ErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export async function validateCartApi(
  items: Array<{ productId: string; quantity: number }>
): Promise<ValidateCartResponse> {
  const res = await fetch(`${API_BASE_URL}/orders/validate-cart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    const errJson = (await res.json().catch(() => null)) as ErrorPayload | null;
    throw new ApiError(
      res.status,
      errJson?.error?.code || 'VALIDATION_FAILED',
      errJson?.error?.message || 'Failed to validate cart'
    );
  }

  const data = await res.json();
  return ValidateCartResponseSchema.parse(data);
}

export async function checkoutOrderApi(
  payload: CheckoutRequest,
  token: string,
  idempotencyKey?: string
): Promise<CheckoutResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(`${API_BASE_URL}/orders/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => null)) as ErrorPayload | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code || 'CHECKOUT_FAILED',
      body?.error?.message || 'Failed to place order'
    );
  }

  return CheckoutResponseSchema.parse(body);
}

export async function fetchCustomerOrdersApi(token: string): Promise<Order[]> {
  const res = await fetch(`${API_BASE_URL}/orders`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ErrorPayload | null;
    throw new ApiError(res.status, err?.error?.code || 'FETCH_FAILED', 'Failed to fetch orders');
  }

  const data = await res.json();
  const parsed = OrderListResponseSchema.parse(data);
  return parsed.orders;
}

export async function fetchCustomerOrderByIdApi(id: string, token: string): Promise<Order> {
  const res = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ErrorPayload | null;
    throw new ApiError(res.status, err?.error?.code || 'FETCH_FAILED', 'Failed to fetch order');
  }

  const data = await res.json();
  const parsed = OrderDetailResponseSchema.parse(data);
  return parsed.order;
}

export async function fetchProfileApi(token: string): Promise<CustomerProfile> {
  const res = await fetch(`${API_BASE_URL}/profile`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ErrorPayload | null;
    throw new ApiError(res.status, err?.error?.code || 'FETCH_FAILED', 'Failed to fetch profile');
  }

  const data = await res.json();
  const parsed = CustomerProfileResponseSchema.parse(data);
  return parsed.profile;
}

export async function updateProfileApi(
  payload: { fullName: string; email?: string | null } | string,
  token: string
): Promise<CustomerProfile> {
  const body = typeof payload === 'string' ? { fullName: payload } : payload;
  const res = await fetch(`${API_BASE_URL}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ErrorPayload | null;
    throw new ApiError(res.status, err?.error?.code || 'UPDATE_FAILED', 'Failed to update profile');
  }

  const data = await res.json();
  const parsed = CustomerProfileResponseSchema.parse(data);
  return parsed.profile;
}

export async function initiatePaymentApi(
  orderId: string,
  token: string
): Promise<InitiatePaymentResponse> {
  const res = await fetch(`${API_BASE_URL}/payments/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId }),
  });

  const body = (await res.json().catch(() => null)) as ErrorPayload | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code || 'PAYMENT_INITIATE_FAILED',
      body?.error?.message || 'Failed to initiate payment'
    );
  }

  return InitiatePaymentResponseSchema.parse(body);
}

export async function verifyPaymentApi(
  payload: VerifyPaymentRequest,
  token: string
): Promise<VerifyPaymentResponse> {
  const res = await fetch(`${API_BASE_URL}/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => null)) as ErrorPayload | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code || 'PAYMENT_VERIFY_FAILED',
      body?.error?.message || 'Failed to verify payment'
    );
  }

  return VerifyPaymentResponseSchema.parse(body);
}


import type {
  AdminMeResponse,
  DashboardMetrics,
  AdminProductItem,
  AdminProductCreate,
  AdminProductUpdate,
  AdminCategoryItem,
  AdminCategoryCreate,
  AdminCategoryUpdate,
  AdminOrderStatusUpdate,
  AdminInventoryItem,
  AdminInventoryWriteOff,
  AdminInventoryAdjust,
  AdminRefundRequest,
  AdminRefundResponse,
  OrderPaymentsResponse,
  Order,
} from '@orange/api-contracts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export class AdminApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...((options.headers as Record<string, string>) || {}),
  };

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let code = 'ERROR';
    let message = `API request failed with status ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error?.code) code = err.error.code;
      if (err?.error?.message) message = err.error.message;
    } catch {
      // Fallback
    }
    throw new AdminApiError(res.status, code, message);
  }

  return res.json() as Promise<T>;
}

export async function fetchAdminMe(token: string): Promise<AdminMeResponse> {
  return request<AdminMeResponse>('/admin/me', token);
}

export async function fetchDashboardMetrics(token: string): Promise<DashboardMetrics> {
  return request<DashboardMetrics>('/admin/dashboard', token);
}

export async function fetchAdminProducts(
  token: string,
  params: { search?: string; categoryId?: string; isActive?: boolean } = {}
): Promise<AdminProductItem[]> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.categoryId) q.set('categoryId', params.categoryId);
  if (typeof params.isActive !== 'undefined') q.set('isActive', String(params.isActive));
  const res = await request<{ products: AdminProductItem[] }>(
    `/admin/products${q.toString() ? `?${q}` : ''}`,
    token
  );
  return res.products;
}

export async function createAdminProduct(
  token: string,
  payload: AdminProductCreate
): Promise<AdminProductItem> {
  return request<AdminProductItem>('/admin/products', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminProduct(
  token: string,
  id: string,
  payload: AdminProductUpdate
): Promise<AdminProductItem> {
  return request<AdminProductItem>(`/admin/products/${encodeURIComponent(id)}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function toggleAdminProductStatus(
  token: string,
  id: string,
  isActive: boolean
): Promise<AdminProductItem> {
  return request<AdminProductItem>(`/admin/products/${encodeURIComponent(id)}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function deleteAdminProduct(
  token: string,
  id: string
): Promise<{ success: boolean; id: string; archived: boolean }> {
  return request<{ success: boolean; id: string; archived: boolean }>(
    `/admin/products/${encodeURIComponent(id)}`,
    token,
    {
      method: 'DELETE',
    }
  );
}

export async function uploadAdminProductImage(
  token: string,
  base64: string,
  fileName?: string,
  contentType?: string
): Promise<{ url: string; fileName: string }> {
  return request<{ url: string; fileName: string }>('/admin/upload-image', token, {
    method: 'POST',
    body: JSON.stringify({ base64, fileName, contentType }),
  });
}

export async function fetchAdminCategories(token: string): Promise<AdminCategoryItem[]> {
  const res = await request<{ categories: AdminCategoryItem[] }>('/admin/categories', token);
  return res.categories;
}

export async function createAdminCategory(
  token: string,
  payload: AdminCategoryCreate
): Promise<AdminCategoryItem> {
  return request<AdminCategoryItem>('/admin/categories', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminCategory(
  token: string,
  id: string,
  payload: AdminCategoryUpdate
): Promise<AdminCategoryItem> {
  return request<AdminCategoryItem>(`/admin/categories/${encodeURIComponent(id)}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminCategory(token: string, id: string): Promise<void> {
  await request<{ success: boolean }>(`/admin/categories/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });
}

export async function fetchAdminOrders(
  token: string,
  params: { status?: string; search?: string } = {}
): Promise<Order[]> {
  const q = new URLSearchParams();
  if (params.status && params.status !== 'all') q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  const res = await request<{ orders: Order[] }>(
    `/admin/orders${q.toString() ? `?${q}` : ''}`,
    token
  );
  return res.orders;
}

export async function updateAdminOrderStatus(
  token: string,
  id: string,
  status: AdminOrderStatusUpdate['status']
): Promise<Order> {
  const res = await request<{ order: Order }>(`/admin/orders/${encodeURIComponent(id)}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return res.order;
}

export async function completeAdminOrderHandover(
  token: string,
  id: string,
  cashCollected: boolean
): Promise<{ order: Order }> {
  return request<{ order: Order }>(`/admin/orders/${encodeURIComponent(id)}/handover`, token, {
    method: 'POST',
    body: JSON.stringify({ cashCollected }),
  });
}

export async function cancelAdminOrder(
  token: string,
  id: string,
  reason: string
): Promise<{ order: Order }> {
  return request<{ order: Order }>(`/admin/orders/${encodeURIComponent(id)}/cancel`, token, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function fetchAdminInventory(
  token: string,
  params: { search?: string; lowStockOnly?: boolean } = {}
): Promise<AdminInventoryItem[]> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.lowStockOnly) q.set('lowStockOnly', 'true');
  const res = await request<{ inventory: AdminInventoryItem[] }>(
    `/admin/inventory${q.toString() ? `?${q}` : ''}`,
    token
  );
  return res.inventory;
}

export async function writeOffAdminInventory(
  token: string,
  payload: AdminInventoryWriteOff
): Promise<{ physicalStock: number; reservedStock: number; availableStock: number }> {
  return request<{ physicalStock: number; reservedStock: number; availableStock: number }>(
    '/admin/inventory/write-off',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function adjustAdminInventory(
  token: string,
  payload: AdminInventoryAdjust
): Promise<{ physicalStock: number; reservedStock: number; availableStock: number }> {
  return request<{ physicalStock: number; reservedStock: number; availableStock: number }>(
    '/admin/inventory/adjust',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchAdminOrderPayments(
  token: string,
  orderId: string
): Promise<OrderPaymentsResponse> {
  return request<OrderPaymentsResponse>(`/admin/orders/${orderId}/payments`, token);
}

export async function refundAdminOrder(
  token: string,
  orderId: string,
  payload: AdminRefundRequest
): Promise<AdminRefundResponse> {
  return request<AdminRefundResponse>(`/admin/orders/${orderId}/refund`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

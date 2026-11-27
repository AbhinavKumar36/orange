import { test, expect, type Page } from '@playwright/test';

const customerUrl = 'http://localhost:3000';
const adminUrl = 'http://localhost:3001';
const apiUrl = 'http://localhost:4000/api/v1';

async function openCatalog(page: Page) {
  await page.goto(customerUrl);
  await expect(page.locator('#menu .product-card').first()).toBeVisible();
}

test('live backend health, catalog, filters, cart totals and authorization', async ({ request }) => {
  expect((await request.get(`${apiUrl}/health`)).ok()).toBe(true);
  const productsResponse = await request.get(`${apiUrl}/products`);
  expect(productsResponse.ok()).toBe(true);
  const { products } = await productsResponse.json();
  expect(products.length).toBeGreaterThan(0);
  const product = products.find((p: { isInStock: boolean }) => p.isInStock);
  expect(product).toBeTruthy();
  const filtered = await request.get(`${apiUrl}/products?category_slug=${product.categorySlug}`);
  expect((await filtered.json()).products.every((p: { categorySlug: string }) => p.categorySlug === product.categorySlug)).toBe(true);
  const cart = await request.post(`${apiUrl}/orders/validate-cart`, { data: { items: [{ productId: product.id, quantity: 2 }] } });
  expect(cart.ok()).toBe(true);
  const validation = await cart.json();
  expect(validation.isValid).toBe(true);
  expect(validation.subtotalAmount).toBe(product.basePrice * 2);
  expect(validation.totalAmount).toBe(validation.subtotalAmount + validation.taxAmount + validation.packagingAmount);
  for (const endpoint of ['/profile', '/orders', '/admin/me', '/admin/inventory']) {
    expect((await request.get(apiUrl + endpoint)).status()).toBe(401);
  }
  const forged = await request.get(`${apiUrl}/orders`, { headers: { Authorization: 'Bearer dev_customer_token:00000000-0000-0000-0000-000000000001:+919876543210:0' } });
  expect(forged.status()).toBe(401);
});

test('current storefront search, dietary filtering, sorting and theme persistence', async ({ page }) => {
  await openCatalog(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('food, drinks & treats');
  const search = page.locator('#catalog-search-input');
  await search.fill('no-product-orange-qa-918374');
  await expect(page.locator('#menu .product-card')).toHaveCount(0);
  await search.fill('');
  await expect(page.locator('#menu .product-card').first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Veg Only' }).check();
  await expect(page.locator('#menu .product-card [aria-label="Non-Vegetarian"]')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Sort products' }).selectOption('price-asc');
  const prices = await page.locator('#menu .product-price').allTextContents();
  const amounts = prices.map(p => Number(p.replace(/[^0-9.]/g, '')));
  expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  await page.getByRole('button', { name: /Switch to (Dark|Light) Mode/ }).click();
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
});

test('product details, quantity changes, saved bag and signed-out checkout', async ({ page }) => {
  await openCatalog(page);
  const card = page.locator('#menu .product-card:not(.sold-out)').first();
  await card.locator('.product-title a').click();
  await expect(page.locator('.detail-add-btn')).toBeEnabled();
  await page.locator('.detail-add-btn').click();
  const bag = page.getByRole('dialog', { name: 'Shopping Bag' });
  await expect(bag).toBeVisible();
  await bag.getByRole('button', { name: /Increase quantity/ }).click();
  await expect(bag.locator('.cart-stepper-val')).toHaveText('2');
  await bag.getByRole('button', { name: 'Close Shopping Bag' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'View Shopping Bag (2 items)' }).click();
  await expect(bag.locator('.cart-stepper-val')).toHaveText('2');
  await bag.getByRole('button', { name: /Proceed to Counter Checkout/ }).click();
  await expect(page.locator('#auth-phone-input')).toBeVisible();
  await page.locator('#auth-phone-input').fill('123');
  await expect(page.getByRole('button', { name: 'Get One-Time Code' })).toBeDisabled();
  await expect(page.locator('#auth-otp-input')).toHaveCount(0);
});

test('signed-out account, orders and missing product pages', async ({ page }) => {
  await page.goto(`${customerUrl}/orders`);
  await expect(page.getByRole('button', { name: 'Sign In with Mobile OTP' })).toBeVisible();
  await page.goto(`${customerUrl}/account`);
  await expect(page.getByRole('heading', { name: 'Sign in to view your account' })).toBeVisible();
  await page.goto(`${customerUrl}/product/no-product-orange-qa-918374`);
  await expect(page.getByText('Product Not Found', { exact: true })).toBeVisible();
});

test('mobile navigation and catalogue error recovery', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/products', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'QA catalog unavailable' } }) }));
  await page.goto(customerUrl);
  await expect(page.getByText('QA catalog unavailable')).toBeVisible();
  await page.unroute('**/api/v1/products');
  await page.getByRole('button', { name: /Try Again|Retry/ }).click();
  await expect(page.locator('#menu .product-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Open Menu' }).click();
  const navigation = page.getByRole('dialog', { name: 'Mobile Navigation' });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'Explore All Products' }).click();
  await expect(navigation).toHaveCount(0);
  for (const width of [320, 390, 640, 960, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}px`).toBe(true);
  }
});

test('malformed saved bag entries do not crash the storefront', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('moody_orange_cart_v1', JSON.stringify([
    null, { quantity: 2 }, { product: { id: 'invalid' }, quantity: -4 },
  ])));
  await openCatalog(page);
  await page.getByRole('button', { name: 'View Shopping Bag (0 items)' }).click();
  await expect(page.getByRole('dialog', { name: 'Shopping Bag' })).toBeVisible();
  await expect(page.locator('.cart-item')).toHaveCount(0);
});

test('profile edits update the saved session and account name in the header', async ({ page }) => {
  const user = { id: '00000000-0000-0000-0000-000000000001', phone: '+919876543210', fullName: 'Original Customer' };
  await page.addInitScript(({ user }) => sessionStorage.setItem('moody_orange_customer_session', JSON.stringify({
    accessToken: 'qa-isolated-customer', expiresAt: Date.now() + 3600000, user,
  })), { user });
  let profile = { ...user, email: null as string | null };
  let saves = 0;
  await page.route('**/api/v1/profile', async route => {
    if (route.request().method() === 'PUT') {
      saves++;
      profile = { ...profile, ...route.request().postDataJSON() };
    }
    await route.fulfill({ json: { profile } });
  });
  await page.goto(`${customerUrl}/account`);
  await page.getByRole('button', { name: 'Edit Profile' }).click();
  await page.locator('#account-full-name').fill('Updated Customer');
  await page.locator('#account-email').fill('updated@example.test');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.locator('.account-user-name')).toHaveText('Updated Customer');
  await expect(page.locator('header .user-session-group a[href="/account"]')).toContainText('Updated');
  expect(saves).toBe(1);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('moody_orange_customer_session')!).user.fullName)).toBe('Updated Customer');
});

test('onboarding keeps name entry open when profile save fails and supports retry', async ({ page }) => {
  await page.route('**/auth/v1/otp', route => route.fulfill({ json: {} }));
  await page.route('**/auth/v1/verify', route => route.fulfill({ json: {
    access_token: 'qa-isolated-customer', expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-0000-0000-000000000001', phone: '+919876543210', user_metadata: {} },
  } }));
  let failSave = true;
  await page.route('**/api/v1/profile', route => failSave
    ? route.fulfill({ status: 503, json: { error: { code: 'DATABASE_UNAVAILABLE', message: 'QA profile unavailable' } } })
    : route.fulfill({ json: { profile: { id: '00000000-0000-0000-0000-000000000001', phone: '+919876543210', fullName: 'New Customer', email: null } } }));
  await page.goto(`${customerUrl}/account`);
  await page.getByRole('button', { name: 'Sign In with Mobile OTP' }).click();
  await page.locator('#auth-phone-input').fill('9876543210');
  await page.getByRole('button', { name: 'Get One-Time Code' }).click();
  await page.locator('#auth-otp-input').fill('123456');
  await page.getByRole('button', { name: 'Verify & Continue' }).click();
  await page.locator('#auth-name-input').fill('New Customer');
  await page.getByRole('button', { name: 'Finish Setup' }).click();
  const auth = page.getByRole('dialog', { name: 'Customer Authentication' });
  await expect(auth).toBeVisible();
  await expect(auth.getByText('Failed to update profile')).toBeVisible();
  failSave = false;
  await page.getByRole('button', { name: 'Finish Setup' }).click();
  await expect(auth).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('moody_orange_customer_session')!).user.fullName)).toBe('New Customer');
});

test('cash checkout UI with an isolated order response', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('moody_orange_customer_session', JSON.stringify({
    accessToken: 'qa-isolated-customer', expiresAt: Date.now() + 3600000,
    user: { id: '00000000-0000-0000-0000-000000000001', phone: '+919876543210', fullName: 'QA Customer' },
  })));
  let submissions = 0;
  await page.route('**/api/v1/orders/checkout', async route => {
    submissions++;
    expect(route.request().headers()['x-idempotency-key'] || route.request().headers()['idempotency-key']).toBeTruthy();
    expect(route.request().postDataJSON().paymentMethod).toBe('cash_at_pickup');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      orderId: '10000000-0000-0000-0000-000000000001', orderNumber: 'MO-QA-ISOLATED',
      orderStatus: 'confirmed', paymentStatus: 'unpaid', fulfillmentType: 'counter_pickup',
      totalAmount: 68250, currency: 'INR', expiresAt: null, estimatedPickupAt: new Date().toISOString(),
    }) });
  });
  await openCatalog(page);
  await page.locator('#menu .product-card:not(.sold-out) .btn-card-quick-add').first().click();
  await page.getByRole('dialog', { name: 'Shopping Bag' }).getByRole('button', { name: /Proceed to Counter Checkout/ }).click();
  await expect(page.locator('.checkout-submit-btn')).toBeEnabled();
  await page.locator('.checkout-submit-btn').click();
  await expect(page.getByText('Order Confirmed!', { exact: true })).toBeVisible();
  expect(submissions).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('moody_orange_cart_v1'))).toBeNull();
});

test('checkout reuses a key for an unchanged retry and changes it for edited details', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('moody_orange_customer_session', JSON.stringify({
    accessToken: 'qa-isolated-customer', expiresAt: Date.now() + 3600000,
    user: { id: '00000000-0000-0000-0000-000000000001', phone: '+919876543210', fullName: 'QA Customer' },
  })));
  const keys: string[] = [];
  await page.route('**/api/v1/orders/checkout', async route => {
    keys.push(route.request().headers()['x-idempotency-key']);
    await route.fulfill({ status: 503, json: { error: { code: 'QA_TEMPORARY_FAILURE', message: 'QA checkout unavailable' } } });
  });
  await openCatalog(page);
  await page.locator('#menu .product-card:not(.sold-out) .btn-card-quick-add').first().click();
  await page.getByRole('dialog', { name: 'Shopping Bag' }).getByRole('button', { name: /Proceed to Counter Checkout/ }).click();
  const checkout = page.getByRole('dialog', { name: 'Checkout' });
  for (const count of [1, 2]) {
    await expect(page.locator('.checkout-submit-btn')).toBeEnabled();
    await page.locator('.checkout-submit-btn').click();
    await expect(checkout.getByRole('alert')).toContainText('QA checkout unavailable');
    await expect.poll(() => keys.length).toBe(count);
  }
  await checkout.getByPlaceholder('e.g. Please pack cold items separately').fill('QA changed packing instructions');
  await page.locator('.checkout-submit-btn').click();
  await expect.poll(() => keys.length).toBe(3);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(keys[2]).not.toBe(keys[1]);
});

test('online payment retries use the reserved order and expired reservations recover', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('moody_orange_customer_session', JSON.stringify({
      accessToken: 'qa-isolated-customer', expiresAt: Date.now() + 3600000,
      user: { id: '00000000-0000-0000-0000-000000000001', phone: '+919876543210', fullName: 'QA Customer' },
    }));
    window.Razorpay = class {
      open() {}
      on() {}
    };
  });
  let orders = 0;
  let attempts = 0;
  await page.route('**/api/v1/orders/checkout', route => {
    orders++;
    expect(route.request().postDataJSON().paymentMethod).toBe('online_razorpay');
    return route.fulfill({ json: {
      orderId: '10000000-0000-0000-0000-000000000001', orderNumber: 'MO-QA-ONLINE',
      orderStatus: 'draft', paymentStatus: 'pending', fulfillmentType: 'counter_pickup',
      totalAmount: 68250, currency: 'INR', expiresAt: new Date(Date.now() + 600000).toISOString(), estimatedPickupAt: null,
    } });
  });
  await page.route('**/api/v1/payments/initiate', route => {
    attempts++;
    expect(route.request().postDataJSON().orderId).toBe('10000000-0000-0000-0000-000000000001');
    return route.fulfill({ status: 400, json: { error: {
      code: attempts === 1 ? 'GATEWAY_UNAVAILABLE' : 'ORDER_EXPIRED',
      message: attempts === 1 ? 'QA gateway unavailable' : 'QA reservation expired',
    } } });
  });
  await openCatalog(page);
  await page.locator('#menu .product-card:not(.sold-out) .btn-card-quick-add').first().click();
  await page.getByRole('dialog', { name: 'Shopping Bag' }).getByRole('button', { name: /Proceed to Counter Checkout/ }).click();
  await page.getByRole('button', { name: /Online Draft/ }).click();
  await page.locator('.checkout-submit-btn').click();
  const retry = page.getByRole('button', { name: /Retry Online Payment/ });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(page.locator('.checkout-submit-btn')).toBeEnabled();
  expect(orders).toBe(1);
  expect(attempts).toBe(2);
});

test('admin login rejects a customer authorized by the auth provider', async ({ page }) => {
  await page.route('**/auth/v1/token?grant_type=password', route => route.fulfill({ json: { access_token: 'qa-customer-token', expires_in: 3600 } }));
  await page.route('**/api/v1/admin/me', route => route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN_NOT_STAFF', message: 'Customer is not staff' } } }));
  await page.goto(adminUrl);
  await page.getByRole('textbox', { name: 'Staff Email' }).fill('customer@example.test');
  await page.locator('input[type="password"]').fill('qa-password');
  await page.getByRole('button', { name: 'Sign In to Staff Portal' }).click();
  await expect(page.getByText(/Customers cannot access the staff portal/)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('moody_orange_admin_session'))).toBeNull();
});

test('admin inventory and navigation with isolated staff data', async ({ page }) => {
  const staff = { id: '00000000-0000-0000-0000-000000000002', email: 'staff@example.test', fullName: 'QA Manager', role: 'manager', isActive: true };
  await page.addInitScript(({ staff }) => sessionStorage.setItem('moody_orange_admin_session', JSON.stringify({ accessToken: 'qa-staff', expiresAt: Date.now() + 3600000, staff })), { staff });
  await page.route('**/api/v1/admin/**', async route => {
    const path = new URL(route.request().url()).pathname;
    expect(route.request().method()).toBe('GET');
    let body: object = {};
    if (path.endsWith('/me')) body = { staff };
    else if (path.endsWith('/orders')) body = { orders: [] };
    else if (path.endsWith('/products')) body = { products: [] };
    else if (path.endsWith('/categories')) body = { categories: [] };
    else if (path.endsWith('/inventory')) body = { inventory: [{ productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', productName: 'QA Product', productSlug: 'qa-product', categoryName: 'Cakes', physicalStock: 10, reservedStock: 2, availableStock: 8, lowStockThreshold: 5, isLowStock: false }] };
    else if (path.endsWith('/dashboard')) body = { totalOrders: 0, ordersAwaitingProcessing: 0, ordersReadyForPickup: 0, completedOrders: 0, grossSalesPaise: 0, activeProducts: 0, lowStockProducts: 0, recentOrders: [], lowStockAlerts: [] };
    await route.fulfill({ json: body });
  });
  await page.goto(adminUrl);
  await page.getByRole('button', { name: /Inventory/ }).click();
  await expect(page.getByText('QA Product', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Adjust \/ Restock|Restock Now/ }).click();
  await expect(page.getByText('Stock Adjustment & Restock', { exact: true })).toBeVisible();
  await expect(page.getByText('Adjustment Reason (Required for Audit Log)', { exact: true })).toBeVisible();
});

test('admin inventory errors can be retried and new products preserve zero fields', async ({ page }) => {
  const staff = { id: '00000000-0000-0000-0000-000000000002', email: 'staff@example.test', fullName: 'QA Manager', role: 'manager', isActive: true };
  await page.addInitScript(({ staff }) => sessionStorage.setItem('moody_orange_admin_session', JSON.stringify({ accessToken: 'qa-staff', expiresAt: Date.now() + 3600000, staff })), { staff });
  let failInventory = true;
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/v1/admin/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/products') && route.request().method() === 'POST') {
      submitted = route.request().postDataJSON();
      await route.fulfill({ json: { ...submitted, id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } });
      return;
    }
    expect(route.request().method()).toBe('GET');
    if (path.endsWith('/inventory') && failInventory) {
      await route.fulfill({ status: 503, json: { error: { code: 'DATABASE_UNAVAILABLE', message: 'QA inventory unavailable' } } });
      return;
    }
    let body: object = {};
    if (path.endsWith('/me')) body = { staff };
    else if (path.endsWith('/orders')) body = { orders: [] };
    else if (path.endsWith('/products')) body = { products: [] };
    else if (path.endsWith('/categories')) body = { categories: [{ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'QA Category', slug: 'qa-category', isActive: true, displayOrder: 0 }] };
    else if (path.endsWith('/inventory')) body = { inventory: [] };
    else if (path.endsWith('/dashboard')) body = { totalOrders: 0, ordersAwaitingProcessing: 0, ordersReadyForPickup: 0, completedOrders: 0, grossSalesPaise: 0, activeProducts: 0, lowStockProducts: 0, recentOrders: [], lowStockAlerts: [] };
    await route.fulfill({ json: body });
  });
  await page.goto(adminUrl);
  await page.getByRole('button', { name: /Inventory/ }).click();
  const loadError = page.getByRole('alert').filter({ hasText: 'Unable to load this section' });
  await expect(loadError).toBeVisible();
  failInventory = false;
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await expect(loadError).toHaveCount(0);
  await page.getByRole('button', { name: /Products/ }).click();
  await page.getByRole('button', { name: '+ Add Product', exact: true }).click();
  const modal = page.locator('.modal-card').filter({ has: page.getByRole('heading', { name: 'Add New Product' }) });
  await modal.locator('input[type="text"]').first().fill('QA Zero Stock');
  const numbers = modal.locator('input[type="number"]');
  await numbers.nth(0).fill('100');
  for (const index of [1, 2, 3]) {
    await numbers.nth(index).fill('0');
    await expect(numbers.nth(index)).toHaveValue('0');
  }
  await modal.getByRole('button', { name: 'Save Product' }).click();
  await expect(modal).toHaveCount(0);
  expect(submitted).toMatchObject({ basePrice: 10000, prepTimeMinutes: 0, initialStock: 0, lowStockThreshold: 0 });
});

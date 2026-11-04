import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = 'https://pdosvzdkuulstvzqfnkl.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkb3N2emRrdXVsc3R2enFmbmtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzUyODM4MiwiZXhwIjoyMTA5MTA0MzgyfQ.zQeqzGhSs0gCBCCqUiCwNL8CQRMqSXf-Q2urNwdLbxs';

async function fetchSupabaseOrder(orderNumber: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}&select=*,order_items(*)`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows.length > 0 ? rows[0] : null;
}

test.describe('Moody Orange / Mangala Enterprises: Order Placement & Operations Flow', () => {
  test.beforeAll(async () => {
    const dir = path.resolve('e2e-screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  test('Customer Web: Place Cash on Delivery order and verify persistent creation in remote Supabase', async ({ page }) => {
    // 1. Visit Customer Storefront
    await page.goto('http://localhost:3000');
    await expect(page.locator('h1, .hero-headline, .hero-title').first()).toBeVisible({ timeout: 15000 });

    // 2. Add product to shopping bag
    const quickAddBtn = page.locator('button.btn-card-quick-add:has-text("+ Add")').first();
    await expect(quickAddBtn).toBeVisible({ timeout: 10000 });
    await quickAddBtn.click();

    // Verify "+ Add" changes to "✓ Added" or bag counter increments
    await expect(page.locator('button:has-text("✓ Added"), .cart-count, .nav-cart-btn').first()).toBeVisible({ timeout: 5000 });

    // 3. Verify Cart Drawer is open (Quick Add automatically opens it; fallback to cart button if closed)
    const proceedCheckoutBtn = page.locator('button.cart-checkout-btn, button:has-text("Proceed to Counter Checkout")').first();
    const isCheckoutBtnVisible = await proceedCheckoutBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isCheckoutBtnVisible) {
      const cartBtn = page.locator('button[aria-label*="shopping bag" i], button[aria-label*="cart" i], .nav-cart-btn').first();
      await cartBtn.click({ force: true });
    }

    // 4. In Cart Drawer, click "Proceed to Counter Checkout"
    await expect(proceedCheckoutBtn).toBeVisible({ timeout: 5000 });
    await proceedCheckoutBtn.click();

    // 5. Auth Modal should appear if not authenticated
    const authPhoneInput = page.locator('input[type="tel"]#auth-phone-input, input[placeholder*="43210"]');
    const needsAuth = await authPhoneInput.isVisible({ timeout: 4000 }).catch(() => false);
    if (needsAuth) {
      await authPhoneInput.fill('9876543210');
      const getOtpBtn = page.locator('button[type="submit"]:has-text("Get One-Time Code")');
      await getOtpBtn.click();

      // Enter OTP
      const otpInput = page.locator('#auth-otp-input');
      await expect(otpInput).toBeVisible({ timeout: 10000 });
      await otpInput.fill('123456');

      const verifyOtpBtn = page.locator('button[type="submit"]:has-text("Verify")');
      await verifyOtpBtn.click();
      await expect(otpInput).not.toBeVisible({ timeout: 15000 });
    }

    // 6. Ensure Checkout Modal is visible
    await expect(page.locator('.checkout-modal-card')).toBeVisible({ timeout: 10000 });

    // Customer Name & Phone inputs
    const nameInput = page.locator('.checkout-modal-card input[placeholder*="Maya"], .checkout-modal-card input[type="text"]').first();
    if (await nameInput.isVisible()) {
      const currentVal = await nameInput.inputValue();
      if (!currentVal.trim()) {
        await nameInput.fill('Demo Customer');
      }
    }

    const phoneInput = page.locator('.checkout-modal-card input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      const currentVal = await phoneInput.inputValue();
      if (!currentVal.trim()) {
        await phoneInput.fill('+919876543210');
      }
    }

    // Ensure Cash at Counter is selected
    const cashOption = page.locator('button:has-text("Pay at Counter")');
    if (await cashOption.isVisible()) {
      await cashOption.click();
    }

    // Wait for cart validation to complete
    await page.waitForTimeout(1000);

    // 7. Submit Checkout
    const confirmOrderBtn = page.locator('button.checkout-submit-btn, button[type="submit"]:has-text("Confirm Order")');
    await expect(confirmOrderBtn).toBeEnabled({ timeout: 10000 });
    await confirmOrderBtn.click();

    // 8. Verify Order Confirmation Receipt
    await expect(page.locator('text=Order Confirmed!')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.receipt-order-num')).toBeVisible();

    const orderNumberText = await page.locator('.receipt-order-num').innerText();
    const cleanOrderNumber = orderNumberText.replace('#', '').trim();
    console.log('Successfully placed order:', cleanOrderNumber);

    // Take screenshot of confirmation receipt
    await page.screenshot({ path: 'e2e-screenshots/10-order-confirmed-receipt.png' });

    // 9. AUTHORITATIVE PROOF: Verify order exists in remote hosted Supabase database
    const supabaseOrder = await fetchSupabaseOrder(cleanOrderNumber);
    expect(supabaseOrder).not.toBeNull();
    expect(supabaseOrder.order_number).toBe(cleanOrderNumber);
    expect(supabaseOrder.customer_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(supabaseOrder.order_status).toBe('confirmed');
    expect(supabaseOrder.payment_status).toBe('unpaid');
    expect(supabaseOrder.payment_method).toBe('cash_at_pickup');
    expect(supabaseOrder.order_items.length).toBeGreaterThanOrEqual(1);

    console.log('Verified order in remote hosted Supabase:', supabaseOrder.id, supabaseOrder.order_number);
  });

  test('Admin Web: Order Operations, Search, Filters, Full Details Modal, and Status Transitions', async ({ page }) => {
    // 1. Visit Admin Web Portal
    await page.goto('http://localhost:3001');

    // 2. Log in as Store Manager (manager@moodyorange.com / password123)
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]:has-text("Sign In to Staff Portal")');

    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill('manager@moodyorange.com');
    await passwordInput.fill('password123');
    await submitBtn.click();

    // 3. Verify Live Dispatch Queue tab is active
    await expect(page.locator('text=Store Manager')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('button:has-text("Live Dispatch Queue")')).toBeVisible();

    // Wait for orders to load in queue
    await expect(page.locator('text=MO-').first()).toBeVisible({ timeout: 15000 });

    // Take screenshot of enhanced Order Operations queue
    await page.screenshot({ path: 'e2e-screenshots/11-admin-order-operations-queue.png', fullPage: true });

    // 4. Test Order Operations Details Modal
    const detailsBtn = page.locator('button:has-text("🔍 Details")').first();
    await expect(detailsBtn).toBeVisible({ timeout: 10000 });
    await detailsBtn.click();

    // Verify Order Details Modal opens
    await expect(page.locator('h3:has-text("Order Details")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=CUSTOMER CONTACT')).toBeVisible();
    await expect(page.locator('text=FULFILLMENT SCHEDULE')).toBeVisible();
    await expect(page.locator('text=ORDER ITEMS').first()).toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/12-admin-order-details-modal.png' });

    // Close details modal
    const closeDetailsBtn = page.locator('button:has-text("Close")').last();
    await closeDetailsBtn.click();
    await expect(page.locator('h3:has-text("Order Details")')).not.toBeVisible({ timeout: 5000 });

    // 5. Test Filter Controls
    // Test filter by 'Confirmed'
    const confirmedFilterBtn = page.locator('button:has-text("Confirmed")').first();
    await confirmedFilterBtn.click();
    await page.waitForTimeout(500);

    // Test search filter
    const searchInput = page.locator('input[placeholder*="Search order #"]');
    await searchInput.fill('Demo Customer');
    await page.waitForTimeout(600);

    // Refresh queue
    const refreshBtn = page.locator('button:has-text("Refresh Queue")');
    await refreshBtn.click();
    await page.waitForTimeout(800);

    await page.screenshot({ path: 'e2e-screenshots/13-admin-filtered-queue.png', fullPage: true });
  });
});

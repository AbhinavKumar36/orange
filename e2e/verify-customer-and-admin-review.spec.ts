import { test, expect } from '@playwright/test';

test.describe('Customer and Administrator Experience Verification', () => {
  test('1. Customer: Order Tracking & Live Stepper Experience', async ({ page }) => {
    await page.goto('http://localhost:3000/orders');
    await page.waitForLoadState('networkidle');

    // Verify Heading & Abyss Styling
    await expect(page.locator('h1')).toContainText('Order Tracking & Boutique History');
    
    // Verify presence of Back to Storefront Link
    await expect(page.locator('text=Back to Boutique Storefront')).toBeVisible();

    // Take screenshot of Orders page
    await page.screenshot({ path: 'e2e-screenshots/26-customer-order-tracking.png', fullPage: true });
  });

  test('2. Customer: Out of Stock & Vitrine Counter Details', async ({ page }) => {
    await page.goto('http://localhost:3000/#menu');
    await page.waitForLoadState('networkidle');

    // Verify out-of-stock / in-stock badge styling on cards
    const cardBadge = page.locator('.badge-stock').first();
    await expect(cardBadge).toBeVisible();

    // Click into product title link and wait for product details to render
    const titleLink = page.locator('.product-title a').first();
    await titleLink.click();
    
    // Wait for the lead banner to appear (after skeleton)
    const leadBanner = page.locator('.pickup-lead-banner');
    await expect(leadBanner).toBeVisible({ timeout: 15000 });

    // Verify Vitrine Display Copy (Kitchen notes must be absent)
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('Sold Out in Kitchen');
    expect(pageText).not.toContain('Estimated kitchen lead time');
    expect(pageText).toContain('In-Store Display Confection');

    await page.screenshot({ path: 'e2e-screenshots/27-product-vitrine-detail.png', fullPage: true });
  });

  test('3. Admin: Inventory Out of Stock Badge, Filter Tabs & Stock Adjustment Modal', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Login with seeded manager account if login form is present
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('manager@moodyorange.com');
      await page.locator('input[type="password"]').fill('password123');
      await page.locator('button[type="submit"]:has-text("Sign In to Staff Portal")').click();
      await expect(page.locator('text=Store Manager')).toBeVisible({ timeout: 20000 });
    }

    // Switch to Inventory tab
    const inventoryTab = page.locator('button:has-text("Inventory")');
    await inventoryTab.click();
    await page.waitForTimeout(600);

    // Verify Inventory Filter Tabs exist
    await expect(page.locator('button:has-text("All Items")')).toBeVisible();
    await expect(page.locator('button:has-text("Out of Stock")')).toBeVisible();
    await expect(page.locator('button:has-text("Low Stock")')).toBeVisible();
    await expect(page.locator('button:has-text("Optimal")')).toBeVisible();

    // Click "Adjust / Restock" on the first row
    const adjustBtn = page.locator('button:has-text("Adjust / Restock"), button:has-text("Restock Now")').first();
    await expect(adjustBtn).toBeVisible({ timeout: 5000 });
    await adjustBtn.click();
    await page.waitForTimeout(300);

    // Verify Modal opens with Stock Adjustment controls
    await expect(page.locator('text=Stock Adjustment & Restock')).toBeVisible();
    await expect(page.locator('button:has-text("Restock (+)")')).toBeVisible();
    await expect(page.locator('button:has-text("Set Out of Stock")')).toBeVisible();
    await expect(page.locator('text=Adjustment Reason')).toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/28-admin-stock-modal.png', fullPage: true });

    // Close modal
    await page.locator('button:has-text("Cancel")').click();

    await page.screenshot({ path: 'e2e-screenshots/29-admin-inventory-filters.png', fullPage: true });
  });

  test('4. Admin: Order Operations Queue Auto-Refresh & Live Updates', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('manager@moodyorange.com');
      await page.locator('input[type="password"]').fill('password123');
      await page.locator('button[type="submit"]:has-text("Sign In to Staff Portal")').click();
      await expect(page.locator('text=Store Manager')).toBeVisible({ timeout: 20000 });
    }

    // Switch to Queue tab
    const queueTab = page.locator('button:has-text("Queue")');
    await queueTab.click();
    await page.waitForTimeout(600);

    // Verify Live Updates checkbox is present
    await expect(page.locator('text=Live Updates')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh Queue")')).toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/30-admin-queue-live.png', fullPage: true });
  });
});

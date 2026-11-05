import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const screenshotDir = path.resolve('e2e-screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

test.describe('End-to-End Verification: Customer and Admin Websites', () => {
  test('1. Customer Web: Hero, Showcase Carousel & Abyss Theme', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Verify Title & Wordmark
    await expect(page.locator('text=MANGALA ENTERPRISES').first()).toBeVisible();

    // Verify In-Store Display Vitrine Hero Photo & Badge
    await expect(page.locator('text=IN-STORE DISPLAY VITRINE').first()).toBeVisible();
    await expect(page.locator('text=STORE DISPLAY COUNTER').first()).toBeVisible();
    await expect(page.locator('text=Ready-to-Collect In-Store Stock • Instant Pickup')).toBeVisible();

    // Verify Vitrine Confection Showcase Carousel exists (replaces 3D viewer)
    await expect(page.locator('text=Curated Display Showcase')).toBeVisible();
    await expect(page.locator('text=In-Store Ready Delicacies')).toBeVisible();

    // Check Showcase Carousel Tabs
    const cakeTab = page.locator('.showcase-tab-btn:has-text("Dark Chocolate Truffle Cake")');
    const juiceTab = page.locator('.showcase-tab-btn:has-text("Valencia Orange Cold-Pressed")');
    const chocolateTab = page.locator('.showcase-tab-btn:has-text("Artisanal Praline Box")');
    
    await expect(cakeTab).toBeVisible();
    await expect(juiceTab).toBeVisible();
    await expect(chocolateTab).toBeVisible();

    // Click through Carousel tabs and verify dynamic update
    await juiceTab.click();
    await page.waitForTimeout(400);
    await expect(page.locator('.showcase-stage:has-text("Valencia Orange Cold-Pressed")')).toBeVisible();

    await chocolateTab.click();
    await page.waitForTimeout(400);
    await expect(page.locator('.showcase-stage:has-text("Artisanal Praline Box")')).toBeVisible();

    // Verify Shopping Cart button & badge
    const cartButton = page.locator('.cart-trigger-btn');
    await expect(cartButton).toBeVisible();

    // Capture screenshot of Showcase Carousel & Hero
    await page.screenshot({ path: path.join(screenshotDir, '31-customer-showcase-carousel.png'), fullPage: false });
  });

  test('2. Customer Web: Product Detail & Cart Drawer (No Kitchen Instructions)', async ({ page }) => {
    await page.goto('http://localhost:3000/#menu');
    await page.waitForLoadState('networkidle');

    // Click into first product
    const firstProductLink = page.locator('.product-title a').first();
    await firstProductLink.click();

    // Wait for product details
    const leadBanner = page.locator('.pickup-lead-banner');
    await expect(leadBanner).toBeVisible({ timeout: 15000 });

    // Verify In-Store Vitrine Display copy (kitchen cooking claims must NOT exist)
    const bannerText = await leadBanner.textContent();
    expect(bannerText).toContain('In-Store Display Confection');
    expect(bannerText).toContain('Zero wait time counter collection');

    // Verify kitchen claims are absent
    const mainText = await page.locator('main').textContent();
    expect(mainText).not.toContain('Sold Out in Kitchen');
    expect(mainText).not.toContain('Estimated kitchen lead time');

    await page.screenshot({ path: path.join(screenshotDir, '33-customer-product-detail.png'), fullPage: false });

    // Add to Bag
    const addToBagBtn = page.locator('button.detail-add-btn, button:has-text("Add to Shopping Bag")');
    if (await addToBagBtn.isVisible()) {
      await addToBagBtn.click();
      await page.waitForTimeout(600);

      // Cart drawer opens automatically upon adding to bag
      await expect(page.locator('.drawer-title:has-text("Shopping Bag")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.cart-pickup-banner')).toBeVisible();
      await expect(page.locator('.cart-pickup-banner')).toContainText('In-Store Counter Pickup');

      await page.screenshot({ path: path.join(screenshotDir, '32-customer-cart-drawer.png') });
    }
  });

  test('3. Customer Web: Order Tracking Page & Abyss Styling', async ({ page }) => {
    await page.goto('http://localhost:3000/orders');
    await page.waitForLoadState('networkidle');

    // Verify Heading
    await expect(page.locator('h1')).toContainText('Order Tracking & Boutique History');
    await expect(page.locator('text=Real-time tracker for in-store display reservations')).toBeVisible();

    // Verify Unauthenticated Prompt or Order Lookup
    await expect(page.locator('text=Sign in to Track Your Orders')).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, '34-customer-order-tracking-verified.png'), fullPage: true });
  });

  test('4. Admin Web: Inventory Badges, Status Filter Tabs & Stock Modal', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Login if prompted
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('manager@moodyorange.com');
      await page.locator('input[type="password"]').fill('password123');
      await page.locator('button[type="submit"]:has-text("Sign In to Staff Portal")').click();
      await expect(page.locator('text=Store Manager')).toBeVisible({ timeout: 20000 });
    }

    // Navigate to Inventory tab
    const inventoryTab = page.locator('button:has-text("Inventory")');
    await inventoryTab.click();
    await page.waitForTimeout(600);

    // Verify 4 Status Filter Tabs
    await expect(page.locator('button:has-text("All Items")')).toBeVisible();
    await expect(page.locator('button:has-text("Out of Stock")')).toBeVisible();
    await expect(page.locator('button:has-text("Low Stock")')).toBeVisible();
    await expect(page.locator('button:has-text("Optimal")')).toBeVisible();

    // Open Stock Adjustment Modal
    const adjustBtn = page.locator('button:has-text("Adjust / Restock"), button:has-text("Restock Now")').first();
    await adjustBtn.click();
    await page.waitForTimeout(400);

    // Verify Modal
    await expect(page.locator('text=Stock Adjustment & Restock')).toBeVisible();
    await expect(page.locator('button:has-text("Set Out of Stock")')).toBeVisible();
    await expect(page.locator('button:has-text("+10")')).toBeVisible();
    await expect(page.locator('text=Adjustment Reason (Required for Audit Log)')).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, '35-admin-stock-modal-verified.png') });

    // Cancel modal
    await page.locator('button:has-text("✕")').click();
    await page.waitForTimeout(300);

    // Capture inventory overview
    await page.screenshot({ path: path.join(screenshotDir, '36-admin-inventory-overview.png'), fullPage: false });
  });

  test('5. Admin Web: Order Operations Queue & Live Auto-Refresh Polling', async ({ page }) => {
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

    // Verify Live Updates indicator and Refresh Queue button
    await expect(page.locator('text=Live Updates')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh Queue")')).toBeVisible();

    // Click Refresh Queue
    await page.locator('button:has-text("Refresh Queue")').click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(screenshotDir, '37-admin-queue-verified.png'), fullPage: false });
  });
});

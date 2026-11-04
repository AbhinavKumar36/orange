import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Moody Orange Customer Web Visual Experience', () => {
  test.beforeAll(async () => {
    const dir = path.resolve('e2e-screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  test('Capture 1: Desktop Homepage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/Moody Orange/i);

    // Verify 3D canvas container and hero
    await expect(page.locator('.hero-section')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.hero-3d-stage')).toBeVisible();

    // Verify Featured Collections and 3D Showcase
    await expect(page.locator('#collections')).toBeVisible();
    await expect(page.locator('.showcase-section')).toBeVisible();

    // Give WebGL canvas a brief moment to render first frames
    await page.waitForTimeout(1500);

    // Save Desktop Homepage Screenshot
    await page.screenshot({
      path: 'e2e-screenshots/01-desktop-homepage.png',
      fullPage: false,
    });
  });

  test('Capture 2: Mobile Homepage', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Verify mobile layout
    await expect(page.locator('.hero-section')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Save Mobile Homepage Screenshot
    await page.screenshot({
      path: 'e2e-screenshots/02-mobile-homepage.png',
      fullPage: false,
    });
  });

  test('Capture 3: Collection Page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/collection/artisanal-cakes', { waitUntil: 'networkidle' });

    // Verify collection banner
    await expect(page.locator('.collection-hero-title')).toContainText('Artisanal Cakes', { timeout: 15000 });
    await expect(page.locator('.collection-catalog-section')).toBeVisible();

    await page.waitForTimeout(1000);

    // Save Collection Page Screenshot
    await page.screenshot({
      path: 'e2e-screenshots/03-collection-page.png',
      fullPage: false,
    });
  });

  test('Capture 4: Product Detail Page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/product/dark-chocolate-truffle-cake-500g', { waitUntil: 'networkidle' });

    // Verify detail grid and media box
    await expect(page.locator('.detail-grid')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.detail-title')).toBeVisible();

    await page.waitForTimeout(1000);

    // Save Product Detail Page Screenshot
    await page.screenshot({
      path: 'e2e-screenshots/04-product-detail-page.png',
      fullPage: false,
    });
  });

  test('Capture 5: Cart Drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Add an item first so cart shows real items and breakdown
    const quickAddBtn = page.locator('.btn-card-quick-add').first();
    if (await quickAddBtn.isVisible()) {
      await quickAddBtn.click();
    } else {
      await page.locator('.cart-trigger-btn').click();
    }

    // Verify Cart Drawer is visible
    await expect(page.locator('.drawer-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.drawer-title')).toContainText(/Shopping Bag/i);

    await page.waitForTimeout(800);

    // Save Cart Drawer Screenshot
    await page.screenshot({
      path: 'e2e-screenshots/05-cart-drawer.png',
      fullPage: false,
    });
  });

  test('Capture 6: Checkout Modal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // 1. Sign in as test customer (phone 9876543210 / OTP 123456)
    const signInBtn = page.locator('.btn-signin').first();
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
      await page.locator('input[type="tel"]').fill('9876543210');
      await page.locator('button:has-text("Get One-Time Code")').click();

      // Fill OTP
      const otpInput = page.locator('#auth-otp-input, input[inputmode="numeric"]');
      await expect(otpInput).toBeVisible({ timeout: 5000 });
      await otpInput.fill('123456');
      await page.locator('button:has-text("Verify & Continue"), button[type="submit"]:has-text("Verify")').click();
      await page.waitForTimeout(1000);
    }

    // 2. Add an item to bag
    const quickAddBtn = page.locator('.btn-card-quick-add').first();
    if (await quickAddBtn.isVisible()) {
      await quickAddBtn.click();
    } else {
      await page.locator('.cart-trigger-btn').click();
    }

    // 3. Click Proceed to Checkout in drawer
    const checkoutBtn = page.locator('.cart-checkout-btn');
    await expect(checkoutBtn).toBeVisible({ timeout: 5000 });
    await checkoutBtn.click();

    // 4. Verify Checkout Modal appears with 4 steps & inputs
    await expect(page.locator('.checkout-modal-card')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Save Checkout Modal Screenshot
    await page.screenshot({
      path: 'e2e-screenshots/06-checkout-modal.png',
      fullPage: false,
    });
  });
});

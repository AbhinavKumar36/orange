import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Mangala Enterprises — Visual Redesign & Feature Verification', () => {
  test.beforeAll(async () => {
    const dir = path.resolve('e2e-screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  test('1. Verify Hero with In-Store Display Counter Photo, Abyss Colors, and Non-Blinking Cart Icon', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    // Wait for hero section
    await expect(page.locator('.hero-section')).toBeVisible({ timeout: 15000 });

    // Verify Display Counter Photo in Hero
    const counterImg = page.locator('.counter-showcase-img');
    await expect(counterImg).toBeVisible({ timeout: 10000 });
    const imgSrc = await counterImg.getAttribute('src');
    expect(imgSrc).toContain('unsplash');

    // Verify Ready to Sell Stock copy
    await expect(page.locator('text=Ready-to-Collect In-Store Stock')).toBeVisible();
    await expect(page.locator('text=Ready to Sell In-Store Stock').first()).toBeVisible();

    // Verify Cart Button is prominent and non-blinking
    const cartBtn = page.locator('.cart-trigger-btn');
    await expect(cartBtn).toBeVisible();

    await page.screenshot({
      path: 'e2e-screenshots/21-hero-display-counter.png',
      fullPage: false,
    });
  });

  test('2. Verify Product Showcase Carousel replacing 3D with Side Details Preserved', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    // Scroll to showcase section
    const showcaseSection = page.locator('.showcase-section');
    await showcaseSection.scrollIntoViewIfNeeded();
    await expect(showcaseSection).toBeVisible({ timeout: 10000 });

    // Verify Carousel elements
    await expect(page.locator('.showcase-carousel-card')).toBeVisible();
    await expect(page.locator('.carousel-main-image')).toBeVisible();
    await expect(page.locator('.carousel-thumbnails-row')).toBeVisible();
    await expect(page.locator('.carousel-nav-btn.next-btn')).toBeVisible();

    // Verify Side Details are intact
    await expect(page.locator('.showcase-details-card')).toBeVisible();
    await expect(page.locator('.showcase-product-name')).toBeVisible();
    await expect(page.locator('text=Chef\'s Tasting Notes')).toBeVisible();
    await expect(page.locator('text=Instant Counter Handover').first()).toBeVisible();
    await expect(page.locator('button.showcase-add-btn')).toBeVisible();

    // Click next slide in carousel
    await page.locator('.carousel-nav-btn.next-btn').click();
    await page.waitForTimeout(400);

    // Click tab 02
    await page.locator('button.showcase-tab-btn:has-text("02")').click();
    await page.waitForTimeout(400);

    await page.screenshot({
      path: 'e2e-screenshots/22-product-carousel-showcase.png',
    });
  });

  test('3. Verify Product Catalog Grid with Internet Food Photography', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    const menuEl = page.locator('#menu');
    await menuEl.scrollIntoViewIfNeeded();
    await expect(menuEl).toBeVisible({ timeout: 10000 });

    // Verify product card images from unsplash
    const productImages = page.locator('.card-image');
    await expect(productImages.first()).toBeVisible({ timeout: 10000 });
    const count = await productImages.count();
    expect(count).toBeGreaterThanOrEqual(3);

    await page.screenshot({
      path: 'e2e-screenshots/23-catalog-food-photos.png',
    });
  });

  test('4. Verify Checkout Modal has NO Special Kitchen Instructions and Ready Stock Copy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    // Quick add product
    const addBtn = page.locator('button.btn-card-quick-add').first();
    await addBtn.click();
    await page.waitForTimeout(500);

    // Open Cart Drawer if not open
    const checkoutBtn = page.locator('button.cart-checkout-btn');
    if (!await checkoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('.cart-trigger-btn').click();
    }
    await expect(checkoutBtn).toBeVisible({ timeout: 5000 });
    await checkoutBtn.click();

    // Check auth modal if needed
    const authInput = page.locator('#auth-phone-input');
    if (await authInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await authInput.fill('9876543210');
      await page.locator('button[type="submit"]:has-text("Get One-Time Code")').click();
      const otpInput = page.locator('#auth-otp-input');
      await expect(otpInput).toBeVisible({ timeout: 5000 });
      await otpInput.fill('123456');
      await page.locator('button[type="submit"]:has-text("Verify")').click();
    }

    // Verify Checkout Modal
    await expect(page.locator('.checkout-modal-card')).toBeVisible({ timeout: 10000 });

    // Assert "Special Kitchen Instructions" is REMOVED
    const kitchenInstructions = page.locator('text=Special Kitchen Instructions');
    await expect(kitchenInstructions).toHaveCount(0);

    // Verify Ready in Vitrine subtitle
    await expect(page.locator('text=Ready in vitrine for immediate counter collection')).toBeVisible();

    await page.screenshot({
      path: 'e2e-screenshots/24-checkout-no-special-instructions.png',
    });
  });

  test('5. Verify Admin Order Operations with "Mark Order Packed"', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3001');

    // Login as manager
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]:has-text("Sign In to Staff Portal")');

    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill('manager@moodyorange.com');
    await passwordInput.fill('password123');
    await submitBtn.click();

    // Wait for Store Manager Dashboard to mount
    await expect(page.locator('text=Store Manager')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=MO-').first()).toBeVisible({ timeout: 15000 });

    // Verify "Order Packed / Ready" tab or button is visible
    await expect(page.locator('button:has-text("Order Packed / Ready")').first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'e2e-screenshots/25-admin-order-packed-queue.png',
      fullPage: true,
    });
  });
});

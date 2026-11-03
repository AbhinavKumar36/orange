import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Moody Orange Web Portals Inspection', () => {
  test.beforeAll(async () => {
    const screenshotsDir = path.resolve('e2e-screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Admin Web: Staff login, Customer denial, and Manager RBAC tabs', async ({ page }) => {
    // 1. Visit Admin Web login page
    await page.goto('http://localhost:3001');
    await expect(page).toHaveTitle(/Moody Orange/i);

    const heading = page.locator('h1');
    await expect(heading).toContainText(/Moody Orange/i);
    await expect(page.locator('text=Staff & Counter Administration Portal')).toBeVisible();

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]:has-text("Sign In to Staff Portal")');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
    // Wait for client React hydration so onSubmit handler intercepts form submission
    await expect(page.locator('form[data-hydrated="true"]')).toBeVisible({ timeout: 20000 });
    await page.waitForLoadState('networkidle');

    // 2. Log in as counter_staff (staff@moodyorange.com / password123)
    await emailInput.fill('staff@moodyorange.com');
    await passwordInput.fill('password123');
    await submitBtn.click();

    // Wait for Dashboard to appear
    await expect(page.locator('text=Counter Staff')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('button:has-text("Live Dispatch Queue")')).toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/01-admin-staff-dashboard.png', fullPage: true });

    // 3. Log out
    const logoutBtn = page.locator('button:has-text("Sign Out")');
    await logoutBtn.click();
    await expect(page.locator('text=Sign In to Staff Portal')).toBeVisible({ timeout: 10000 });

    // 4. Test Customer Segregation (attempt login as customer@moodyorange.com)
    await emailInput.fill('customer@moodyorange.com');
    await passwordInput.fill('password123');
    await submitBtn.click();

    // Verify Access Denied banner
    await expect(page.getByText(/access denied/i)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e-screenshots/02-admin-customer-denied.png' });

    // 5. Log in as Store Manager (manager@moodyorange.com / password123)
    await emailInput.fill('manager@moodyorange.com');
    await passwordInput.fill('password123');
    await submitBtn.click();

    await expect(page.locator('text=Store Manager')).toBeVisible({ timeout: 20000 });

    // Verify Manager tabs: Queue, Overview, Products, Categories, Inventory
    await expect(page.locator('button:has-text("Overview")')).toBeVisible();
    await expect(page.locator('button:has-text("Products")')).toBeVisible();
    await expect(page.locator('button:has-text("Categories")')).toBeVisible();
    await expect(page.locator('button:has-text("Inventory")')).toBeVisible();

    await page.screenshot({ path: 'e2e-screenshots/03-admin-manager-dashboard.png', fullPage: true });
  });

  test('Customer Web: Storefront catalog, product rendering, and Auth Modal', async ({ page }) => {
    // 1. Visit Customer Web storefront
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Moody Orange/i);

    // Verify brand header and category filters
    await expect(page.getByRole('link', { name: /Moody Orange/i }).first()).toBeVisible();
    await expect(page.locator('button:has-text("Artisanal Cakes")').first()).toBeVisible({ timeout: 15000 });

    // Take screenshot of customer catalog
    await page.screenshot({ path: 'e2e-screenshots/04-customer-storefront.png', fullPage: true });

    // 2. Open Auth Modal via Sign In button
    const signInBtn = page.locator('button:has-text("Sign In"), button:has-text("Account")').first();
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      await expect(page.locator('text=Mobile Number (India +91)')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('button:has-text("Get One-Time Code")')).toBeVisible();

      // Enter test mobile number
      const phoneInput = page.locator('input[type="tel"]');
      await phoneInput.fill('9876543210');
      await expect(phoneInput).toHaveValue('9876543210');

      await page.screenshot({ path: 'e2e-screenshots/05-customer-auth-modal.png' });

      // 3. Click Get One-Time Code and verify advancing to OTP step
      const getOtpBtn = page.locator('button[type="submit"]:has-text("Get One-Time Code")');
      await getOtpBtn.click();

      // Verify OTP step appears without error
      await expect(page.locator('text=6-Digit Verification Code')).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: 'e2e-screenshots/06-customer-otp-step.png' });

      // 4. Enter test OTP 123456 and verify login
      const otpInput = page.locator('#auth-otp-input');
      await otpInput.fill('123456');
      const verifyBtn = page.locator('button[type="submit"]:has-text("Verify")');
      await verifyBtn.click();

      // Modal closes upon successful login
      await expect(page.locator('#auth-otp-input')).not.toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: 'e2e-screenshots/07-customer-logged-in.png', fullPage: true });
    }
  });
});

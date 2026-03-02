import { test, expect } from '@playwright/test';
import { waitForHydration } from './helpers';

/**
 * Auth E2E Tests
 *
 * Tests the authentication forms: login, registration, validation,
 * and view switching.
 *
 * Note: We must wait for Vue hydration after page load because the form
 * elements are SSR-rendered but event handlers (@submit, @blur) are only
 * attached after hydration completes.
 */

const FORM_TIMEOUT = 20000;

/** Navigate to login page and wait for hydration */
async function gotoLogin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.waitForLoadState('load');
  await waitForHydration(page);
}

test.describe('Auth', () => {
  test('should load login page with form visible', async ({ page }) => {
    await gotoLogin(page);

    await expect(page.locator('[data-testid="auth-card"]')).toBeVisible({
      timeout: FORM_TIMEOUT,
    });

    await expect(page.locator('[data-testid="login-form"]')).toBeVisible({
      timeout: FORM_TIMEOUT,
    });
  });

  test('should show validation errors on empty login submit', async ({
    page,
  }) => {
    await gotoLogin(page);

    const submitButton = page.locator('[data-testid="login-submit"]');
    await expect(submitButton).toBeVisible({ timeout: FORM_TIMEOUT });
    await submitButton.click();

    const emailError = page.locator('[data-testid="login-email-error"]');
    const passwordError = page.locator('[data-testid="login-password-error"]');

    await expect(emailError).toBeVisible({ timeout: 5000 });
    await expect(passwordError).toBeVisible({ timeout: 5000 });
  });

  test('should show email validation error on blur with invalid email', async ({
    page,
  }) => {
    await gotoLogin(page);

    const emailInput = page.locator('[data-testid="login-email"]');
    await expect(emailInput).toBeVisible({ timeout: FORM_TIMEOUT });

    await emailInput.fill('not-an-email');
    await emailInput.blur();

    const emailError = page.locator('[data-testid="login-email-error"]');
    await expect(emailError).toBeVisible({ timeout: 5000 });
  });

  test('should switch to register view', async ({ page }) => {
    await gotoLogin(page);

    const applyButton = page.locator('[data-testid="auth-apply-button"]');
    await expect(applyButton).toBeVisible({ timeout: FORM_TIMEOUT });
    await applyButton.click();

    await expect(page.locator('[data-testid="register-form"]')).toBeVisible({
      timeout: FORM_TIMEOUT,
    });
  });

  test('should show all register form fields', async ({ page }) => {
    await gotoLogin(page);

    // Switch to register view
    const applyButton = page.locator('[data-testid="auth-apply-button"]');
    await expect(applyButton).toBeVisible({ timeout: FORM_TIMEOUT });
    await applyButton.click();

    const registerForm = page.locator('[data-testid="register-form"]');
    await expect(registerForm).toBeVisible({ timeout: FORM_TIMEOUT });

    const expectedFields = [
      'register-email',
      'register-password',
      'register-firstName',
      'register-lastName',
      'register-company',
      'register-phone',
    ];

    for (const fieldId of expectedFields) {
      const field = page.locator(`[data-testid="${fieldId}"]`);
      await expect(field).toBeVisible();
    }
  });

  test('should show validation errors on empty register submit', async ({
    page,
  }) => {
    await gotoLogin(page);

    // Switch to register view
    const applyButton = page.locator('[data-testid="auth-apply-button"]');
    await expect(applyButton).toBeVisible({ timeout: FORM_TIMEOUT });
    await applyButton.click();

    const submitButton = page.locator('[data-testid="register-submit"]');
    await expect(submitButton).toBeVisible({ timeout: FORM_TIMEOUT });
    await submitButton.click();

    // At least some field errors should appear
    const errors = page.locator('[data-testid*="-error"]');
    await expect(errors.first()).toBeVisible({ timeout: 5000 });
  });

  test('should switch back to login from register', async ({ page }) => {
    await gotoLogin(page);

    // Switch to register view first
    const applyButton = page.locator('[data-testid="auth-apply-button"]');
    await expect(applyButton).toBeVisible({ timeout: FORM_TIMEOUT });
    await applyButton.click();

    const registerForm = page.locator('[data-testid="register-form"]');
    await expect(registerForm).toBeVisible({ timeout: FORM_TIMEOUT });

    const backToLogin = page.locator('[data-testid="auth-back-to-login"]');
    await expect(backToLogin).toBeVisible();

    const signInButton = backToLogin.locator('button');
    await signInButton.click();

    await expect(page.locator('[data-testid="login-form"]')).toBeVisible({
      timeout: FORM_TIMEOUT,
    });
  });

  test('should have a close button', async ({ page }) => {
    await gotoLogin(page);

    const closeButton = page.locator('[data-testid="auth-close"]');
    await expect(closeButton).toBeVisible({ timeout: FORM_TIMEOUT });
  });
});

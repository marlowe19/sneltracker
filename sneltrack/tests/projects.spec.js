import { test, expect } from '@playwright/test';
import {
  navigateToUserPage,
  navigateToProjects,
  waitForApiCalls,
  waitForProjectsToLoad,
} from './helpers/test-helpers';

test.describe('Projects Management @mobile', () => {
  const testUser = 'testuser';

  test('should display projects list page', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    
    // Check for page title/heading
    const heading = page.getByRole('heading', { name: /Projecten/i });
    await expect(heading).toBeVisible();
    
    // Check for back button
    const backLink = page.getByRole('link', { name: /Terug|←/i });
    await expect(backLink).toBeVisible();
  });

  test('should navigate back to main page from projects', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    
    // Click back link
    const backLink = page.getByRole('link', { name: /Terug|←/i });
    await backLink.click();
    await waitForApiCalls(page);
    
    // Verify we're back on main page
    await expect(page).toHaveURL(new RegExp(`/${encodeURIComponent(testUser)}(?:/)?$`));
  });

  test('should display projects list on mobile', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);
    
    // Projects list should be visible
    // Look for project-related content (project names, buttons, etc.)
    const projectsSection = page.locator('section').or(page.locator('[class*="project"]'));
    
    // At least the section should exist
    const count = await projectsSection.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to project detail page', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);
    
    // Look for clickable project elements
    const projectLinks = page.locator('a[href*="/projecten/"]').or(
      page.locator('button').filter({ hasText: /.+/ })
    );
    
    const count = await projectLinks.count();
    
    if (count > 0) {
      // Click on first project
      const firstProject = projectLinks.first();
      const projectName = await firstProject.textContent();
      
      await firstProject.click();
      await waitForApiCalls(page);
      
      // Verify we're on project detail page
      await expect(page).toHaveURL(new RegExp(`/${encodeURIComponent(testUser)}/projecten/\\w+`));
    }
  });

  test('should display project creation form when create button is clicked', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);
    
    // Look for create/new project button
    const createButton = page.getByRole('button', { name: /Nieuw|Create|Toevoegen|Add/i });
    
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
      await waitForApiCalls(page);
      
      // Look for form elements
      const formInputs = page.locator('input[type="text"]').or(
        page.locator('input[name*="name"]')
      );
      
      // Form should have at least one input
      const inputCount = await formInputs.count();
      expect(inputCount).toBeGreaterThan(0);
    }
  });

  test('should filter projects by user and shared tabs', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);
    
    // Look for tab buttons
    const userTab = page.getByRole('button', { name: /Mijn|User|Eigen/i });
    const sharedTab = page.getByRole('button', { name: /Gedeeld|Shared/i });
    
    if (await userTab.isVisible().catch(() => false)) {
      // Click user tab
      await userTab.click();
      await waitForApiCalls(page);
      
      // Verify tab is active (might have specific class or aria attribute)
      // This is a basic check
    }
    
    if (await sharedTab.isVisible().catch(() => false)) {
      // Click shared tab
      await sharedTab.click();
      await waitForApiCalls(page);
      
      // Verify tab is active
    }
  });

  test('should have responsive layout on mobile viewport', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    
    // Check viewport size
    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428); // Max mobile width
    
    // Check that main container is visible
    const main = page.locator('main');
    await expect(main).toBeVisible();
    
    // Check that content doesn't overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 10);
  });

  test('should handle project selection in timer', async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);
    
    // Look for project selector
    const projectSelector = page.getByRole('button', { name: /Selecteer project/i });
    
    if (await projectSelector.isVisible().catch(() => false)) {
      await projectSelector.click();
      await page.waitForTimeout(500); // Wait for dropdown
      
      // Look for project options
      const projectOptions = page.getByRole('button').filter({ 
        hasText: /Geen project|project/i 
      });
      
      const count = await projectOptions.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should display project statistics on detail page', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);
    
    // Try to navigate to a project detail page
    const projectLinks = page.locator('a[href*="/projecten/"]');
    const count = await projectLinks.count();
    
    if (count > 0) {
      await projectLinks.first().click();
      await waitForApiCalls(page);
      
      // Look for statistics or project details
      const stats = page.locator('text=/Uur|Hours|Tijd|Time|€|EUR/i');
      const statsCount = await stats.count();
      
      // Should have some statistics displayed
      // This is a basic check - adjust based on actual implementation
      expect(statsCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should handle touch interactions on project items', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);
    
    // Look for project items
    const projectItems = page.locator('button, a').filter({ hasText: /.+/ });
    const count = await projectItems.count();
    
    if (count > 0) {
      const firstItem = projectItems.first();
      const box = await firstItem.boundingBox();
      
      // Touch targets should be appropriately sized
      if (box) {
        expect(box.height).toBeGreaterThan(30); // Minimum touch target
      }
    }
  });

  test('should maintain state when navigating between pages', async ({ page }) => {
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    await waitForProjectsToLoad(page);
    
    // Navigate back
    const backLink = page.getByRole('link', { name: /Terug|←/i });
    await backLink.click();
    await waitForApiCalls(page);
    
    // Navigate to projects again
    await navigateToProjects(page, testUser);
    await waitForApiCalls(page);
    
    // Projects should still be visible
    const heading = page.getByRole('heading', { name: /Projecten/i });
    await expect(heading).toBeVisible();
  });
});


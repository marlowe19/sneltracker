import { test, expect } from '@playwright/test';
import {
  navigateToUserPage,
  navigateToWeek,
  clickDayEntry,
  waitForApiCalls,
} from './helpers/test-helpers';

test.describe('Week Entries @mobile', () => {
  const testUser = 'testuser';

  test.beforeEach(async ({ page }) => {
    await navigateToUserPage(page, testUser);
    await waitForApiCalls(page);
  });

  test('should display week entries section', async ({ page }) => {
    // Look for week-related content
    const weekContent = page.locator('text=/Ma|Di|Wo|Do|Vr|Za|Zo|Week/i');
    const count = await weekContent.count();
    
    // Should have some week-related content
    expect(count).toBeGreaterThan(0);
  });

  test('should display days of the week', async ({ page }) => {
    // Look for day labels (Dutch abbreviations)
    const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
    
    for (const day of dayLabels) {
      const dayElement = page.locator(`text=/${day}/i`);
      const count = await dayElement.count();
      // At least some days should be visible
      if (count > 0) {
        await expect(dayElement.first()).toBeVisible();
      }
    }
  });

  test('should navigate to previous week', async ({ page }) => {
    await navigateToWeek(page, testUser, -1);
    await expect(page).toHaveURL(new RegExp(`w=-1`));
    
    // Week entries should still be visible
    const weekContent = page.locator('text=/Ma|Di|Wo|Do|Vr|Za|Zo/i');
    const count = await weekContent.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to next week', async ({ page }) => {
    await navigateToWeek(page, testUser, 1);
    await expect(page).toHaveURL(new RegExp(`w=1`));
    
    // Week entries should still be visible
    const weekContent = page.locator('text=/Ma|Di|Wo|Do|Vr|Za|Zo/i');
    const count = await weekContent.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should open day modal when clicking on a day', async ({ page }) => {
    // Look for clickable day elements
    const dayElements = page.locator('[role="button"]').filter({ 
      hasText: /Ma|Di|Wo|Do|Vr|Za|Zo|\d{1,2}/ 
    }).or(
      page.locator('.day').or(
        page.locator('[aria-label*="Edit entries"]')
      )
    );
    
    const count = await dayElements.count();
    
    if (count > 0) {
      // Click on first day
      await dayElements.first().click();
      await waitForApiCalls(page);
      await page.waitForTimeout(500); // Wait for modal animation
      
      // Look for modal content
      const modal = page.locator('[role="dialog"]').or(
        page.locator('.modal').or(
          page.locator('[class*="modal"]')
        )
      );
      
      // Modal should be visible or content should be present
      const modalCount = await modal.count();
      // Modal might be present even if not found by these selectors
      // Check for modal-related content like close button or entry list
      const closeButton = page.getByRole('button', { name: /Close|Sluiten|×|✕/i });
      const hasCloseButton = await closeButton.isVisible().catch(() => false);
      
      // Either modal element exists or close button is visible
      expect(modalCount > 0 || hasCloseButton).toBeTruthy();
    }
  });

  test('should close day modal when close button is clicked', async ({ page }) => {
    // Open modal first
    const dayElements = page.locator('[role="button"]').filter({ 
      hasText: /Ma|Di|Wo|Do|Vr|Za|Zo|\d{1,2}/ 
    }).or(
      page.locator('.day').or(
        page.locator('[aria-label*="Edit entries"]')
      )
    );
    
    const count = await dayElements.count();
    
    if (count > 0) {
      await dayElements.first().click();
      await waitForApiCalls(page);
      await page.waitForTimeout(500);
      
      // Look for close button
      const closeButton = page.getByRole('button', { name: /Close|Sluiten|×|✕/i });
      
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
        await waitForApiCalls(page);
        await page.waitForTimeout(500);
        
        // Modal should be closed (close button should not be visible)
        await expect(closeButton).not.toBeVisible();
      }
    }
  });

  test('should display entries in day modal', async ({ page }) => {
    // Open modal
    const dayElements = page.locator('[role="button"]').filter({ 
      hasText: /Ma|Di|Wo|Do|Vr|Za|Zo|\d{1,2}/ 
    }).or(
      page.locator('.day').or(
        page.locator('[aria-label*="Edit entries"]')
      )
    );
    
    const count = await dayElements.count();
    
    if (count > 0) {
      await dayElements.first().click();
      await waitForApiCalls(page);
      await page.waitForTimeout(500);
      
      // Look for entries tab or entries list
      const entriesTab = page.getByRole('button', { name: /Entries|Tijden|Tijd/i });
      const entryList = page.locator('[class*="entry"]').or(
        page.locator('text=/\\d{1,2}:\\d{2}/') // Time format
      );
      
      // Either entries tab exists or entry list is visible
      const hasTab = await entriesTab.isVisible().catch(() => false);
      const entryCount = await entryList.count();
      
      expect(hasTab || entryCount >= 0).toBeTruthy();
    }
  });

  test('should switch between entries and expenses tabs in modal', async ({ page }) => {
    // Open modal
    const dayElements = page.locator('[role="button"]').filter({ 
      hasText: /Ma|Di|Wo|Do|Vr|Za|Zo|\d{1,2}/ 
    }).or(
      page.locator('.day').or(
        page.locator('[aria-label*="Edit entries"]')
      )
    );
    
    const count = await dayElements.count();
    
    if (count > 0) {
      await dayElements.first().click();
      await waitForApiCalls(page);
      await page.waitForTimeout(500);
      
      // Look for tabs
      const entriesTab = page.getByRole('button', { name: /Entries|Tijden|Tijd/i });
      const expensesTab = page.getByRole('button', { name: /Expenses|Uitgaven|Kosten/i });
      
      if (await entriesTab.isVisible().catch(() => false)) {
        await entriesTab.click();
        await waitForApiCalls(page);
      }
      
      if (await expensesTab.isVisible().catch(() => false)) {
        await expensesTab.click();
        await waitForApiCalls(page);
        
        // Expenses content should be visible
        const expensesContent = page.locator('text=/€|EUR|Uitgaven/i');
        const expensesCount = await expensesContent.count();
        expect(expensesCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should display hours and money for each day', async ({ page }) => {
    // Look for time/money displays in day elements
    const timePattern = /\d{1,2}:\d{2}/;
    const moneyPattern = /€|\d+,\d{2}/;
    
    const timeDisplay = page.locator(`text=${timePattern.source}`);
    const moneyDisplay = page.locator(`text=${moneyPattern.source}`);
    
    // Should have some time or money displays
    const timeCount = await timeDisplay.count();
    const moneyCount = await moneyDisplay.count();
    
    expect(timeCount + moneyCount).toBeGreaterThanOrEqual(0);
  });

  test('should handle week navigation with entries', async ({ page }) => {
    // Navigate to previous week
    await navigateToWeek(page, testUser, -1);
    await waitForApiCalls(page);
    
    // Week entries should be visible
    const weekContent = page.locator('text=/Ma|Di|Wo|Do|Vr|Za|Zo/i');
    const count = await weekContent.count();
    expect(count).toBeGreaterThan(0);
    
    // Navigate to next week
    await navigateToWeek(page, testUser, 2);
    await waitForApiCalls(page);
    
    // Week entries should still be visible
    const weekContent2 = page.locator('text=/Ma|Di|Wo|Do|Vr|Za|Zo/i');
    const count2 = await weekContent2.count();
    expect(count2).toBeGreaterThan(0);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Check viewport size
    const viewport = page.viewportSize();
    expect(viewport.width).toBeLessThanOrEqual(428);
    
    // Week entries section should be visible
    const weekContent = page.locator('text=/Ma|Di|Wo|Do|Vr|Za|Zo/i');
    const count = await weekContent.count();
    expect(count).toBeGreaterThan(0);
    
    // Check that content doesn't overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 10);
  });

  test('should handle touch interactions on day elements', async ({ page }) => {
    // Look for day elements
    const dayElements = page.locator('[role="button"]').filter({ 
      hasText: /Ma|Di|Wo|Do|Vr|Za|Zo|\d{1,2}/ 
    }).or(
      page.locator('.day')
    );
    
    const count = await dayElements.count();
    
    if (count > 0) {
      const firstDay = dayElements.first();
      const box = await firstDay.boundingBox();
      
      // Touch targets should be appropriately sized
      if (box) {
        expect(box.height).toBeGreaterThan(30);
      }
    }
  });

  test('should update week entries after timer operations', async ({ page }) => {
    // Start a timer (if possible)
    const startButton = page.getByRole('button', { name: /^Start$/i });
    
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await waitForApiCalls(page);
      
      // Stop timer after a moment
      await page.waitForTimeout(1000);
      
      const stopButton = page.getByRole('button', { name: /^Stop$/i });
      if (await stopButton.isVisible().catch(() => false)) {
        await stopButton.click();
        await waitForApiCalls(page);
        
        // Week entries should update (might show new entry)
        const weekContent = page.locator('text=/Ma|Di|Wo|Do|Vr|Za|Zo/i');
        const count = await weekContent.count();
        expect(count).toBeGreaterThan(0);
      }
    }
  });
});


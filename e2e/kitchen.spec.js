import { test, expect } from '@playwright/test';

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

test('a day in the kitchen', async ({ page }) => {
  // 1. First run shows the welcome card.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome to Hearth/ })).toBeVisible();

  // 2. Larder: add Apple butter with a first batch.
  await page.getByRole('link', { name: 'Larder', exact: true }).click();
  await page.getByRole('button', { name: 'Add item' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Apple butter');
  await dialog.getByLabel('Unit', { exact: true }).selectOption('jar');
  await dialog.getByLabel('Quantity').fill('6');
  await dialog.getByLabel('Where it came from').selectOption('preserved');
  await dialog.getByLabel('Use by').fill(inDays(5));
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Apple butter' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Larder', exact: true }).click();
  const card = page.locator('.item-card', { hasText: 'Apple butter' });
  await expect(card).toContainText('6 jar');
  await expect(card).toContainText('use in 5 days');

  // 3. Root Cellar: add potatoes.
  await page.getByRole('link', { name: 'Root Cellar', exact: true }).click();
  await page.getByRole('button', { name: 'Add item' }).first().click();
  await dialog.getByLabel('Name').fill('Russet potatoes');
  await dialog.getByLabel('Unit', { exact: true }).selectOption('lb');
  await dialog.getByLabel('Quantity').fill('10');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Russet potatoes' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Root Cellar', exact: true }).click();
  await expect(page.locator('.item-card', { hasText: 'Russet potatoes' })).toContainText('10 lb');

  // 4. Recipe Box: write a recipe.
  await page.getByRole('link', { name: 'Recipe Box' }).click();
  await page.getByRole('link', { name: 'New recipe' }).first().click();
  await page.getByLabel('Title').fill('Potato bake');
  await page.getByLabel('Servings').fill('2');
  await page.getByLabel('Paste a list').fill('2 lb Russet potatoes\n1 cup Cream');
  await page.getByRole('button', { name: 'Turn into ingredients' }).click();
  await page.getByLabel('Step 1 text').fill('Slice the potatoes, pour over the cream, and bake until golden.');
  await page.getByRole('button', { name: 'Add to the recipe box' }).click();
  await expect(page.getByRole('heading', { name: 'Potato bake' }).first()).toBeVisible();
  const potatoes = page.locator('.ing', { hasText: 'Russet potatoes' });
  const cream = page.locator('.ing', { hasText: 'Cream' });
  await expect(potatoes).toContainText('have it');
  await expect(cream).toContainText('need it');
  const recipeUrl = page.url();

  // 5. Planner: drag the recipe onto today's supper.
  await page.getByRole('link', { name: 'Meal Planner' }).click();
  const source = page.getByLabel('Drag Potato bake onto a day');
  const target = page.locator('.plan-slot.is-today').nth(2); // breakfast, lunch, supper
  await source.scrollIntoViewIfNeeded();
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 10, { steps: 5 });
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect(target).toContainText('Potato bake');

  // 6. Shopping: build from the plan.
  await page.getByRole('link', { name: 'Shopping List', exact: true }).click();
  await page.getByRole('button', { name: 'Build from the plan' }).first().click();
  await expect(page.locator('.note-row', { hasText: 'Cream' })).toBeVisible();
  await expect(page.locator('.note-row', { hasText: 'potatoes' })).toHaveCount(0);

  // 7. Cook it: the cellar drops to 8 lb.
  await page.goto(recipeUrl);
  await page.getByRole('button', { name: 'I cooked this' }).click();
  await page.getByRole('button', { name: 'Take from the shelves' }).click();
  await expect(page.getByText('Logged Potato bake')).toBeVisible();
  await page.getByRole('link', { name: 'Root Cellar', exact: true }).click();
  await expect(page.locator('.item-card', { hasText: 'Russet potatoes' })).toContainText('8 lb');

  // 8. Delete the recipe, then undo.
  await page.goto(recipeUrl);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Brought back Potato bake')).toBeVisible();
  await page.getByRole('link', { name: 'Recipe Box' }).click();
  await expect(page.locator('.recipe-grid-cards').getByRole('link', { name: /Potato bake/ })).toBeVisible();

  // 9. Hearth lists Apple butter under Use soon.
  await page.getByRole('link', { name: 'Hearth & Larder, home' }).click();
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Use soon' }) })).toContainText('Apple butter');
});

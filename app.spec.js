// © 2026 Мушта Роман Александрович. Проверка страницы в настоящем Chrome (Playwright).
// Страница открывается как локальный файл, данные берутся из встроенного xlsx.
const { test, expect } = require('@playwright/test');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '..', '..', 'index.html');
const ignorable = /Failed to load resource|net::ERR|fonts\.g|ERR_FAILED|CORS|Access to fetch/;

async function open(page, w, h) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !ignorable.test(m.text())) errors.push(m.text()); });
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url);
  await page.waitForSelector('#out table', { timeout: 30000 });
  return errors;
}

for (const [name, w, h] of [['телефон', 390, 844], ['планшет', 820, 1100], ['ноутбук', 1366, 768], ['монитор', 1920, 1080]]) {
  test(`${name}: страница строит портфель, ошибок нет, нет горизонтальной прокрутки всей страницы`, async ({ page }) => {
    const errors = await open(page, w, h);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, 'страница шире экрана на ' + over + ' px').toBeLessThanOrEqual(1);
    expect(await page.locator('#out table tbody tr').count()).toBeGreaterThan(2);
    expect(await page.locator('footer').innerText()).toContain('Версия');
    expect(errors).toEqual([]);
  });
}

test('телефон: панель параметров не закреплена и есть нижние вкладки', async ({ page }) => {
  await open(page, 390, 844);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('aside')).position)).toBe('static');
  await expect(page.locator('#mnav')).toBeVisible();
  await page.click('#gp');
  await expect(page.locator('#pl, #pb').first()).toBeAttached();
});

test('инструкция открывается и закрывается по Esc', async ({ page }) => {
  await open(page, 1366, 768);
  await page.click('#hlp');
  await expect(page.locator('#help')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#help')).toBeHidden();
});

test('тема переключается и запоминается', async ({ page }) => {
  await open(page, 1366, 768);
  await page.selectOption('#th', 'plum');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('plum');
  await page.reload();
  await page.waitForSelector('#out table');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('plum');
});

test('простой режим скрывает расширенные блоки и запоминается', async ({ page }) => {
  await open(page, 1366, 768);
  await page.click('#smd');
  expect(await page.evaluate(() => document.body.dataset.mode)).toBe('simple');
  await expect(page.locator('.simple').first()).toBeVisible();
  await expect(page.locator('#out .adv').first()).toBeHidden();
  await page.reload();
  await page.waitForSelector('#out table');
  expect(await page.evaluate(() => document.body.dataset.mode)).toBe('simple');
});

test('кнопка «Скрыть» убирает бумагу из портфеля', async ({ page }) => {
  await open(page, 1366, 768);
  const first = await page.locator('#out table tbody tr td:first-child b').first().innerText();
  await page.locator('#out button[data-hb]').first().click();
  await expect(page.locator('#out table tbody tr td:first-child b', { hasText: new RegExp('^' + first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') })).toHaveCount(0);
});

test('план сохраняется, график план/факт и отчёт строятся', async ({ page }) => {
  const errors = await open(page, 1366, 768);
  await page.click('#sv');
  await expect(page.locator('#pl')).toContainText('Мой план');
  await expect(page.locator('#pl')).toContainText('График выплат');
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.click('#rp2');
  expect(await page.evaluate(() => window.__printed)).toBe(true);
  expect(await page.locator('#rep').innerHTML()).toContain('Отчёт по облигационному портфелю');
  expect(errors).toEqual([]);
});

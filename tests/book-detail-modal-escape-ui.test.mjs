import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from '@playwright/test';

const PORT = 5198;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const BROWSER_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const detailBook = {
  id: 9101,
  title: 'Esc 닫기 테스트 도서',
  author: '테스트 저자',
  publisher: '테스트 출판사',
  pubDate: '2026-07-07',
  isbn13: '9791190000910',
  priceStandard: 15000,
  priceSales: 13500,
  cover: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="192"></svg>',
  link: 'https://example.com/book-detail-escape',
  description: '상세 모달 Escape 닫기 검증용 도서',
  mallType: 'BOOK',
  subInfo: {},
  addedDate: Date.now(),
  readStatus: '읽지 않음',
  rating: 0,
  isFavorite: false,
  customTags: [],
};

async function waitForServer(serverProcess) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30000) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Vite server exited early with code ${serverProcess.exitCode}`);
    }

    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Vite server did not start: ${lastError?.message ?? 'timeout'}`);
}

async function stopServer(serverProcess) {
  if (serverProcess.exitCode !== null) return;

  serverProcess.kill();
  await Promise.race([
    once(serverProcess, 'exit'),
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]);
}

test('book detail modal keeps text editing Escape local before closing on plain Escape', async () => {
  const serverProcess = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' },
    },
  );

  let browser;

  try {
    await waitForServer(serverProcess);

    const executablePath = BROWSER_CANDIDATES.find(existsSync);
    assert.ok(executablePath, 'Chrome 또는 Edge 실행 파일을 찾을 수 없습니다.');

    browser = await chromium.launch({ executablePath });
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem('hasVisited', 'true');
    });

    const page = await context.newPage();
    await page.goto(BASE_URL);

    await page.evaluate(async ({ detailBook }) => {
      const [{ useBookStore }, { useUIStore }, { useAuthStore }, { useSettingsStore }] = await Promise.all([
        import('/stores/useBookStore.ts'),
        import('/stores/useUIStore.ts'),
        import('/stores/useAuthStore.ts'),
        import('/stores/useSettingsStore.ts'),
      ]);

      useSettingsStore.setState({
        fetchUserSettings: async () => undefined,
      });

      useBookStore.setState({
        myLibraryBooks: [detailBook],
        myLibraryIsbnSet: new Set([detailBook.isbn13]),
        fetchUserLibrary: async () => undefined,
        clearLibrary: () => undefined,
      });

      useAuthStore.setState({
        session: {
          user: {
            id: 'book-detail-escape-test-user',
            email: 'book-detail-escape@example.com',
          },
        },
      });

      useUIStore.setState({
        selectedBookIdForDetail: detailBook.id,
      });
    }, { detailBook });

    await assert.doesNotReject(async () => {
      await page.getByRole('heading', { name: '도서 상세 정보' }).waitFor();
    });

    await page.getByTitle('커스텀 검색어 편집').click();
    const customSearchInput = page.locator('input[placeholder=""]');
    await assert.doesNotReject(async () => {
      await customSearchInput.waitFor();
    });

    await page.keyboard.press('Escape');

    await assert.doesNotReject(async () => {
      await page.getByRole('heading', { name: '도서 상세 정보' }).waitFor();
    });
    await assert.doesNotReject(async () => {
      await customSearchInput.waitFor({ state: 'detached' });
    });

    await page.keyboard.press('Escape');

    await assert.doesNotReject(async () => {
      await page.getByRole('heading', { name: '도서 상세 정보' }).waitFor({ state: 'detached' });
    });
  } finally {
    await browser?.close();
    await stopServer(serverProcess);
  }
});

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from '@playwright/test';

const PORT = 5197;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const BROWSER_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const sampleBook = {
  title: '안티그래비티 테스트 도서',
  author: '테스트 저자',
  publisher: '테스트 출판사',
  pubDate: '2026-07-05',
  isbn: '1234567890',
  isbn13: '9791190000001',
  itemId: 123456,
  cover: 'https://via.placeholder.com/128x192.png?text=Book',
  link: 'https://example.com/book',
  description: '테스트 설명',
  mallType: 'BOOK',
  subInfo: {},
};

const existingBook = {
  ...sampleBook,
  title: '이미 추가된 안티그래비티 도서',
  isbn13: '9791190000002',
  id: 8001,
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

test('cover quick-add keeps search modal open and turns the book into a duplicate state', async () => {
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

    await page.evaluate(async ({ sampleBook, existingBook }) => {
      const [{ useBookStore }, { useUIStore }, { useAuthStore }, { useSettingsStore }] = await Promise.all([
        import('/stores/useBookStore.ts'),
        import('/stores/useUIStore.ts'),
        import('/stores/useAuthStore.ts'),
        import('/stores/useSettingsStore.ts'),
      ]);

      useSettingsStore.setState({
        fetchUserSettings: async () => undefined,
      });

      let removeCallCount = 0;

      useBookStore.setState({
        searchResults: [sampleBook, existingBook],
        myLibraryBooks: [existingBook],
        myLibraryIsbnSet: new Set([existingBook.isbn13]),
        fetchUserLibrary: async () => undefined,
        clearLibrary: () => undefined,
        addToLibrary: async (bookToAdd) => {
          const addedBook = {
            ...bookToAdd,
            id: 9001,
            addedDate: Date.now(),
            readStatus: '읽지 않음',
            rating: 0,
            isFavorite: false,
            customTags: [],
          };

          useBookStore.setState((state) => ({
            myLibraryBooks: [addedBook, ...state.myLibraryBooks],
            myLibraryIsbnSet: new Set(state.myLibraryIsbnSet).add(bookToAdd.isbn13),
          }));

          return addedBook;
        },
        removeFromLibrary: async (id) => {
          removeCallCount += 1;
          useBookStore.setState((state) => {
            const target = state.myLibraryBooks.find(book => book.id === id);
            const nextIsbnSet = new Set(state.myLibraryIsbnSet);
            if (target) nextIsbnSet.delete(target.isbn13);

            return {
              myLibraryBooks: state.myLibraryBooks.filter(book => book.id !== id),
              myLibraryIsbnSet: nextIsbnSet,
              removeCallCount,
            };
          });
        },
      });

      useAuthStore.setState({
        session: {
          user: {
            id: 'quick-add-test-user',
            email: 'quick-add@example.com',
          },
        },
      });

      useUIStore.setState({
        isBookSearchListModalOpen: true,
        selectedBookIdForDetail: null,
      });
    }, { sampleBook, existingBook });

    await assert.doesNotReject(async () => {
      await page.getByRole('heading', { name: '도서 검색 결과' }).waitFor();
    });

    await assert.doesNotReject(async () => {
      await page.getByText(sampleBook.title).waitFor();
    });
    await assert.doesNotReject(async () => {
      await page.getByText(existingBook.title).waitFor();
    });

    await page.evaluate(async () => {
      const { useAuthStore } = await import('/stores/useAuthStore.ts');
      useAuthStore.setState({
        session: {
          user: {
            id: 'quick-add-test-user',
            email: 'quick-add@example.com',
          },
        },
        user: {
          id: 'quick-add-test-user',
          email: 'quick-add@example.com',
        },
      });
    });

    await assert.doesNotReject(async () => {
      await page.getByRole('button', { name: /기존 추가됨/ }).waitFor();
    });
    assert.equal(await page.getByRole('button', { name: /기존 추가됨/ }).isDisabled(), true);

    await page.getByRole('button', { name: /내 서재 추가/ }).click();

    await assert.doesNotReject(async () => {
      await page.getByRole('heading', { name: '도서 검색 결과' }).waitFor();
    });
    await assert.doesNotReject(async () => {
      await page.getByRole('button', { name: /추가 취소/ }).waitFor();
    });

    await page.getByRole('button', { name: /추가 취소/ }).click();

    await assert.doesNotReject(async () => {
      await page.getByRole('button', { name: /내 서재 추가/ }).waitFor();
    });

    await page.locator('li').filter({ hasText: existingBook.title }).locator('h3').click();

    await assert.doesNotReject(async () => {
      await page.getByRole('heading', { name: '도서 검색 결과' }).waitFor({ state: 'detached' });
    });
  } finally {
    await browser?.close();
    await stopServer(serverProcess);
  }
});

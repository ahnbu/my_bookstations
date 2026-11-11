// 책 추가 → 알라딘 전자책 링크 저장 흐름을 실제 store로 검증한다(headless, 창을 띄우지 않는다).
// Supabase·재고 Worker·/api/aladin-ebook 응답은 page.route로 대체하고, 저장 요청 본문·로컬 상태·렌더된 버튼을 확인한다.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from '@playwright/test';

const PORT = 5199;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const BROWSER_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const EBOOK_LINK = 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=18094736';
const kakaoBook = {
  title: '데미안',
  author: '헤르만 헤세',
  pubDate: '2009-01-20',
  description: '시험용',
  isbn13: '9788937460449',
  cover: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="192"></svg>',
  priceStandard: 8000,
  priceSales: 7200,
  publisher: '민음사',
  link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=9788937460449',
  subInfo: {},
  mallType: 'BOOK',
};

async function waitForServer(serverProcess) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < 30000) {
    if (serverProcess.exitCode !== null) throw new Error(`Vite server exited early with code ${serverProcess.exitCode}`);
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
  await Promise.race([once(serverProcess, 'exit'), new Promise(resolve => setTimeout(resolve, 5000))]);
}

async function openApp(browser, { updateStatus, patchDelayMs = 0 }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => { localStorage.setItem('hasVisited', 'true'); });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  const updates = [];
  let nextId = 9301;

  await page.route('**/rest/v1/user_library**', async route => {
    const req = route.request();
    if (req.method() === 'POST') {
      const [row] = JSON.parse(req.postData() || '[]');
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: nextId++, book_data: row.book_data, note: null }) });
    }
    if (req.method() === 'PATCH') {
      updates.push(JSON.parse(req.postData() || '{}'));
      if (patchDelayMs) await new Promise(r => setTimeout(r, patchDelayMs));
      return updateStatus === 204
        ? route.fulfill({ status: 204, body: '' })
        : route.fulfill({ status: updateStatus, contentType: 'application/json', body: JSON.stringify({ message: 'mock failure' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('http://127.0.0.1:8787/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ gwangjuPaper: { error: 'mock' }, lastUpdated: 1 }),
  }));
  await page.route('**/api/aladin-ebook**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'found', itemId: 18094736, link: EBOOK_LINK, paperFound: true }),
  }));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  // 앱의 인증 초기화(세션 없음)가 끝난 뒤에 시험 세션을 넣는다. 먼저 넣으면 초기화가 덮어쓴다.
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const [{ useBookStore }, { useAuthStore }, { useSettingsStore }] = await Promise.all([
      import('/stores/useBookStore.ts'),
      import('/stores/useAuthStore.ts'),
      import('/stores/useSettingsStore.ts'),
    ]);
    useSettingsStore.setState({ fetchUserSettings: async () => undefined });
    useBookStore.setState({
      myLibraryBooks: [],
      myLibraryIsbnSet: new Set(),
      fetchUserLibrary: async () => undefined,
      clearLibrary: () => undefined,
    });
    useAuthStore.setState({ session: { user: { id: 'ebook-save-test-user', email: 'ebook-save@example.com' } } });
  });
  return { context, page, updates, consoleErrors };
}

async function addAndWait(page, book) {
  return page.evaluate(async (bookToAdd) => {
    const { useBookStore } = await import('/stores/useBookStore.ts');
    const added = await useBookStore.getState().addToLibrary(bookToAdd);
    // 백그라운드 갱신(0.8초 뒤 시작)이 끝날 때까지 기다린다.
    const startedAt = Date.now();
    await new Promise(r => setTimeout(r, 1200));
    while (useBookStore.getState().refreshingEbookId !== null && Date.now() - startedAt < 15000) {
      await new Promise(r => setTimeout(r, 100));
    }
    const { getStoreLinks } = await import('/utils/ebookLink.ts');
    const local = useBookStore.getState().myLibraryBooks.find(b => b.id === added.id);
    return { id: added.id, subInfo: local.subInfo, ebookLink: getStoreLinks(local).ebookLink, debug: { waited: Date.now() - startedAt, refreshing: useBookStore.getState().refreshingEbookId, hostname: location.hostname, session: !!(await import('/stores/useAuthStore.ts')).useAuthStore.getState().session, books: useBookStore.getState().myLibraryBooks.length } };
  }, book);
}

test('adding a book stores the Aladin ebook link and renders it; a failed save rolls the screen back', async () => {
  const serverProcess = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BROWSER: 'none' } },
  );
  let browser;
  try {
    await waitForServer(serverProcess);
    const executablePath = BROWSER_CANDIDATES.find(existsSync);
    assert.ok(executablePath, 'Chrome 또는 Edge 실행 파일을 찾을 수 없습니다.');
    browser = await chromium.launch({ executablePath, headless: true });

    // 1) 저장 성공
    {
      const { context, page, updates, consoleErrors } = await openApp(browser, { updateStatus: 204 });
      const result = await addAndWait(page, kakaoBook);
      assert.equal(updates.length, 1, `one book_data update is sent; console errors: ${consoleErrors.join(' | ')}; debug: ${JSON.stringify(result.debug)}`);
      const saved = updates[0].book_data;
      assert.equal(saved.subInfo.ebookList[0].link, EBOOK_LINK);
      assert.equal(saved.subInfo.ebookLookup.status, 'found');
      assert.equal(saved.link, kakaoBook.link, 'paper link unchanged');
      assert.equal(saved.description, kakaoBook.description, 'stored metadata is not overwritten');
      assert.equal(result.ebookLink, EBOOK_LINK, 'local state resolves the same ebook link');
      assert.equal(result.subInfo.ebookLookup.status, 'found');

      const href = await page.locator('a', { hasText: /^전자책$/ }).first().getAttribute('href');
      assert.equal(href, EBOOK_LINK, 'rendered 전자책 button opens the stored ebook page');
      await context.close();
    }

    // 2) 저장 실패 → 화면 되돌림
    {
      const { context, page, updates } = await openApp(browser, { updateStatus: 500 });
      const result = await addAndWait(page, kakaoBook);
      assert.equal(updates.length, 1, 'the update was attempted');
      assert.equal(result.subInfo.ebookLookup, undefined, 'local state is rolled back to before the refresh');
      assert.equal(result.subInfo.ebookList, undefined);
      await context.close();
    }

    // 3) 갱신 저장이 실패하는 사이에 다른 책을 추가해도, 실패한 책만 되돌리고 다른 책은 남는다
    {
      const { context, page, updates } = await openApp(browser, { updateStatus: 500, patchDelayMs: 2000 });
      const result = await page.evaluate(async ({ bookA, bookB }) => {
        const { useBookStore } = await import('/stores/useBookStore.ts');
        const existing = { ...bookA, id: 1, isbn13: '9790000000001', title: '이미 있던 책', addedDate: 1, readStatus: '읽지 않음', rating: 0, isFavorite: false, customTags: [] };
        useBookStore.setState({ myLibraryBooks: [existing], myLibraryIsbnSet: new Set([existing.isbn13]), totalBooksCount: 1 });
        const a = await useBookStore.getState().addToLibrary(bookA);
        await new Promise(r => setTimeout(r, 1200)); // A의 갱신이 시작돼 저장 응답(2초 지연)을 기다리는 중
        const b = await useBookStore.getState().addToLibrary(bookB);
        useBookStore.setState({ selectedBook: useBookStore.getState().myLibraryBooks.find(x => x.id === b.id) });
        // A의 갱신 저장을 기다리는 동안 같은 책 A에 별점·메모를 남긴다(실패해도 남아야 한다)
        useBookStore.setState(s => ({ myLibraryBooks: s.myLibraryBooks.map(x => (x.id === a.id ? { ...x, rating: 5, note: '갱신 도중 남긴 메모' } : x)) }));
        await new Promise(r => setTimeout(r, 6000)); // A·B 갱신이 모두 실패로 끝날 때까지
        const books = useBookStore.getState().myLibraryBooks;
        const pick = id => books.find(x => x.id === id);
        return {
          ids: books.map(x => x.id).sort(),
          expected: [1, a.id, b.id].sort(),
          aLookup: pick(a.id)?.subInfo?.ebookLookup ?? null,
          aRating: pick(a.id)?.rating,
          aNote: pick(a.id)?.note,
          bLookup: pick(b.id)?.subInfo?.ebookLookup ?? null,
          existingTitle: pick(1)?.title,
          selectedId: useBookStore.getState().selectedBook?.id,
          bId: b.id,
        };
      }, { bookA: kakaoBook, bookB: { ...kakaoBook, isbn13: '9788934972464', title: '사피엔스', link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=9788934972464' } });
      assert.equal(updates.length, 2, 'both refresh saves were attempted');
      assert.deepEqual(result.ids, result.expected, 'no book disappears when another book refresh fails');
      assert.equal(result.aLookup, null, 'A is rolled back');
      assert.equal(result.aRating, 5, 'edits made to A during the refresh are kept');
      assert.equal(result.aNote, '갱신 도중 남긴 메모');
      assert.equal(result.bLookup, null, 'B is rolled back');
      assert.equal(result.existingTitle, '이미 있던 책');
      assert.equal(result.selectedId, result.bId, 'selection is kept');
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await stopServer(serverProcess);
  }
});

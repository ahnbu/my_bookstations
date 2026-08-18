// 비로그인 첫 화면(스크롤 · 웰컴 모달 · 데모 서재 · 툴바 동작)을 headless 브라우저로 검증한다.
// 창을 띄우지 않는다: headless: true를 명시한다.

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

const demo = JSON.parse(readFileSync(`${REPO_ROOT}data/demoLibrary.json`, 'utf8'));
const DEMO_COUNT = demo.books.length;

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

test('비로그인 첫 화면은 스크롤되고, 웰컴 모달 없이 데모 서재 툴바가 동작한다', async () => {
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

    browser = await chromium.launch({ executablePath, headless: true });

    // --- 1. 신규 방문자(빈 localStorage) ---
    // 문서가 확실히 넘치도록 뷰포트 높이를 낮춘다
    const freshContext = await browser.newContext({ viewport: { width: 1280, height: 600 } });
    const page = await freshContext.newPage();

    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="demo-library"]', { timeout: 15000 });

    // 웰컴 모달은 기본값이 off이므로 나타나지 않아야 한다.
    // App.tsx가 500ms 지연 후 모달을 열려고 하므로 그 시점을 지나서 확인한다.
    await page.waitForTimeout(1200);
    assert.equal(
      await page.getByRole('button', { name: '다시 보지 않기' }).count(),
      0,
      '웰컴 모달이 기본으로 표시됐다',
    );

    // 세로 스크롤이 잠기지 않아야 한다 (웰컴 모달이 body overflow를 잠그던 회귀 방지)
    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    assert.notEqual(bodyOverflow, 'hidden', 'body 스크롤이 잠겨 있다');

    const isScrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    assert.ok(isScrollable, '문서 높이가 뷰포트를 넘지 않아 스크롤 검증을 할 수 없다');

    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);
    const scrollY = await page.evaluate(() => window.scrollY);
    assert.ok(scrollY > 0, `세로 스크롤이 동작하지 않는다: scrollY=${scrollY}`);
    await page.evaluate(() => window.scrollTo(0, 0));

    // 데모 도서 전량 렌더
    const cards = page.locator('[data-testid="demo-book-card"]');
    assert.equal(await cards.count(), DEMO_COUNT);

    // 재고 배지가 도서당 6개씩 렌더된다
    assert.equal(
      await page.locator('[data-testid="demo-book-card"] .library-tag').count(),
      DEMO_COUNT * 6,
    );

    // --- 2. 검색 ---
    const searchInput = page.getByPlaceholder('제목, 저자명으로 내 서재를 검색하세요');
    await searchInput.fill('데미안');
    await page.waitForTimeout(300);
    const searchedCount = await cards.count();
    assert.ok(searchedCount > 0 && searchedCount < DEMO_COUNT, `검색 결과가 걸러지지 않았다: ${searchedCount}`);
    assert.ok(
      (await cards.first().innerText()).includes('데미안'),
      '검색 결과에 검색어가 포함되지 않았다',
    );
    await searchInput.fill('');
    await page.waitForTimeout(300);
    assert.equal(await cards.count(), DEMO_COUNT, '검색어를 지워도 전체가 복귀하지 않았다');

    // --- 3. 태그 필터 ---
    const firstTagName = demo.tags[0].name;
    const tagButton = page.locator(`button:visible:has-text("${firstTagName}")`).first();
    await tagButton.click();
    await page.waitForTimeout(300);
    const taggedCount = await cards.count();
    assert.ok(taggedCount > 0 && taggedCount < DEMO_COUNT, `태그 필터가 동작하지 않았다: ${taggedCount}`);
    await tagButton.click();
    await page.waitForTimeout(300);
    assert.equal(await cards.count(), DEMO_COUNT, '태그를 해제해도 전체가 복귀하지 않았다');

    // --- 4. 정렬 ---
    const firstTitleBefore = await cards.first().innerText();
    await page.locator('button:visible:has-text("추가순")').first().click();
    await page.locator('button:visible:has-text("제목순")').first().click();
    await page.waitForTimeout(300);
    const firstTitleAfter = await cards.first().innerText();
    assert.notEqual(firstTitleBefore, firstTitleAfter, '정렬을 바꿔도 순서가 그대로다');

    // --- 5. 좋아요 필터 ---
    await page.locator('button[title="좋아하는 책만 보기"]:visible').first().click();
    await page.waitForTimeout(300);
    const favoritedCount = await cards.count();
    assert.ok(
      favoritedCount > 0 && favoritedCount < DEMO_COUNT,
      `좋아요 필터가 동작하지 않았다: ${favoritedCount}`,
    );
    await page.locator('button[title="전체 책 보기"]:visible').first().click();
    await page.waitForTimeout(300);

    // --- 6. 상호작용은 로그인 안내로 연결 ---
    await cards.first().locator('button[title="좋아요"]:visible, button[title="좋아요 취소"]:visible').first().click();
    await page.waitForSelector('text=예시 화면입니다', { timeout: 5000 });

    // --- 7. 모바일 폭에서 가로 스크롤 없음 ---
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(scrollWidth <= 376, `375px 폭에서 가로 스크롤 발생: scrollWidth=${scrollWidth}`);

    assert.deepEqual(pageErrors, [], '페이지 에러가 발생했다');
    assert.deepEqual(consoleErrors, [], '콘솔 에러가 발생했다');

    await freshContext.close();

    // --- 8. 관리자 로컬 설정으로 켠 경우 ---
    const adminContext = await browser.newContext();
    await adminContext.addInitScript(() => {
      localStorage.setItem(
        'adminWelcomeMessageSettings',
        JSON.stringify({ enabled: true, content: '관리자 로컬 설정 환영 메시지' }),
      );
    });

    const adminPage = await adminContext.newPage();
    await adminPage.goto(BASE_URL);
    await adminPage.waitForSelector('text=관리자 로컬 설정 환영 메시지', { timeout: 15000 });
    assert.equal(
      await adminPage.getByRole('button', { name: '다시 보지 않기' }).count(),
      1,
      '관리자 로컬 설정이 켜져 있는데 웰컴 모달이 표시되지 않았다',
    );

    await adminContext.close();
  } finally {
    if (browser) await browser.close();
    await stopServer(serverProcess);
  }
});

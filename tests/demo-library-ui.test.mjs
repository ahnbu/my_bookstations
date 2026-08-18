// 비로그인 첫 화면(웰컴 모달 기본 off + 데모 서재)을 headless 브라우저로 검증한다.
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

test('비로그인 첫 화면은 웰컴 모달 없이 데모 서재 10권을 보여준다', async () => {
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
    const freshContext = await browser.newContext();
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

    // 데모 도서 10권
    assert.equal(await page.locator('[data-testid="demo-book-card"]').count(), 10);

    // 스냅샷의 첫 도서 제목이 실제로 렌더된다
    const firstTitle = demo.books[0].title;
    assert.ok(
      await page.getByText(firstTitle, { exact: false }).first().isVisible(),
      '데모 도서 제목이 보이지 않는다',
    );

    // 재고 배지가 렌더된다 (퇴촌/기타/e경기 등)
    assert.ok(
      await page.locator('[data-testid="demo-book-card"] .library-tag').count() >= 60,
      '재고 배지가 도서당 6개씩 렌더되지 않았다',
    );

    // 상호작용은 로그인 안내로 연결된다
    await page.locator('[data-testid="demo-book-card"]').first().getByTitle(/좋아요/).first().click();
    await page.waitForSelector('text=예시 화면입니다', { timeout: 5000 });

    // 모바일 폭에서 가로 스크롤이 생기지 않는다
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(scrollWidth <= 376, `375px 폭에서 가로 스크롤 발생: scrollWidth=${scrollWidth}`);

    assert.deepEqual(pageErrors, [], '페이지 에러가 발생했다');
    assert.deepEqual(consoleErrors, [], '콘솔 에러가 발생했다');

    await freshContext.close();

    // --- 2. 관리자 로컬 설정으로 켠 경우 ---
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

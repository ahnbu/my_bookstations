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

// 사람이 나중에 보기 위한 증거만 남긴다. 통과 조건이 아니므로 실패해도 테스트를 깨뜨리지 않는다.
// 저장 위치 temp/는 .gitignore에 등록돼 있어 커밋에 포함되지 않는다(local-only).
async function captureScreenshot(page, path) {
  try {
    await page.screenshot({ path, fullPage: false });
  } catch (error) {
    console.warn(`스크린샷 저장 실패(무시): ${path} — ${error.message}`);
  }
}

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

    // --- 0. 데모 모드 안내 띠 (메타 레이어) ---
    // [V-12] 띠가 있고, 서비스 본체(main) 바깥에 있다.
    // main 안에 들어가면 max-w-4xl 콘텐츠로 읽혀 메타/본체 분리가 무의미해진다.
    const bannerPlacement = await page.evaluate(() => {
      const banners = document.querySelectorAll('[data-testid="demo-mode-banner"]');
      if (banners.length !== 1) return { count: banners.length };
      const banner = banners[0];
      return {
        count: 1,
        insideMain: banner.closest('main') !== null,
        text: banner.innerText,
      };
    });
    assert.equal(bannerPlacement.count, 1, `데모 안내 띠가 1개가 아니다: ${bannerPlacement.count}`);
    assert.equal(bannerPlacement.insideMain, false, '안내 띠가 main 안에 있다 — 서비스 본체와 섞였다');
    assert.match(bannerPlacement.text, /예시 데이터/, '안내 띠 문구가 예시임을 알리지 않는다');
    await captureScreenshot(page, `${REPO_ROOT}temp/banner-1280-top.png`);

    // [V-13] 스크롤해도 띠가 화면에 남는다 (sticky)
    const stickyCheck = await page.evaluate(async () => {
      const scrollable = document.documentElement.scrollHeight > window.innerHeight + 600;
      window.scrollTo(0, 600);
      await new Promise(r => setTimeout(r, 200));
      const top = document.querySelector('[data-testid="demo-mode-banner"]').getBoundingClientRect().top;
      const scrolled = window.scrollY;
      window.scrollTo(0, 0);
      return { scrollable, top, scrolled };
    });
    assert.ok(stickyCheck.scrollable, '문서가 충분히 길지 않아 sticky 검증을 할 수 없다');
    assert.ok(stickyCheck.scrolled > 0, `스크롤이 동작하지 않았다: scrollY=${stickyCheck.scrolled}`);
    assert.ok(stickyCheck.top <= 5, `스크롤 후 띠가 화면 밖으로 나갔다: top=${stickyCheck.top}`);

    // 스크롤 상태 증거: 띠가 남아 있고 서재 섹션에 안내가 없음을 사람이 확인한다
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await captureScreenshot(page, `${REPO_ROOT}temp/banner-1280-scrolled.png`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    // [V-14] 서재 섹션 안에는 메타 안내 문구가 남아 있지 않다
    const demoBodyText = await page.locator('[data-testid="demo-library"]').innerText();
    for (const phrase of ['예시', '미리보기', '기준입니다']) {
      assert.ok(
        !demoBodyText.includes(phrase),
        `서재 본문에 메타 안내 문구가 남아 있다: "${phrase}"`,
      );
    }

    // [V-7] 로그인 이력이 없는 신규 컨텍스트에서는 데모 서재가 렌더된다
    assert.equal(await page.locator('[data-testid="demo-library"]').count(), 1, '신규 방문자에게 데모가 렌더되지 않았다');
    assert.equal(await page.locator('[data-testid="logged-out-notice"]').count(), 0, '신규 방문자에게 로그아웃 안내가 떴다');

    // 데모 도서 전량 렌더
    const cards = page.locator('[data-testid="demo-book-list"] > *');
    assert.equal(await cards.count(), DEMO_COUNT);

    // [V-5] 카드가 컨테이너의 직접 자식이다. 중간 래퍼가 있으면 grid 셀이 어긋난다
    const wrapperCount = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="demo-book-list"]');
      if (!list) return -1;
      return [...list.children].filter(child => child.hasAttribute('data-testid')).length;
    });
    assert.equal(wrapperCount, 0, `컨테이너와 카드 사이에 래퍼가 있다: ${wrapperCount}개`);

    // 재고 배지가 도서당 6개씩 렌더된다
    assert.equal(
      await page.locator('[data-testid="demo-book-list"] .library-tag').count(),
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

    // --- 4. 정렬 --- [V-9] 정렬 비교자는 utils/librarySort.ts를 MyLibrary와 공유한다
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

    // --- 5-1. 뷰 전환 레이아웃 (1280px) ---
    // 데모가 컨테이너를 따로 지어 그리드가 1열로 늘어졌던 사고의 재발 방지 단언이다.
    await page.locator('button[title="그리드 보기"]:visible').first().click();
    await page.waitForTimeout(300);

    const gridLayout = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="demo-book-list"]');
      const style = getComputedStyle(list);
      const children = [...list.children];
      return {
        display: style.display,
        tracks: style.gridTemplateColumns.split(' ').filter(Boolean).length,
        firstTop: children[0]?.getBoundingClientRect().top,
        secondTop: children[1]?.getBoundingClientRect().top,
      };
    });

    // [V-1] 그리드 뷰의 컨테이너가 실제 grid다
    assert.equal(gridLayout.display, 'grid', `그리드 뷰인데 display가 grid가 아니다: ${gridLayout.display}`);
    // [V-2] 1280px에서 4열 (useGridColumns의 중형 이상 분기)
    assert.equal(gridLayout.tracks, 4, `1280px에서 그리드 트랙이 4개가 아니다: ${gridLayout.tracks}`);
    // [V-4] 첫 두 카드가 한 행에 나란히 놓인다
    assert.equal(
      gridLayout.firstTop,
      gridLayout.secondTop,
      `그리드인데 카드가 세로로 쌓인다: ${gridLayout.firstTop} vs ${gridLayout.secondTop}`,
    );
    assert.equal(await cards.count(), DEMO_COUNT, '그리드로 전환하니 카드 수가 달라졌다');

    await captureScreenshot(page, `${REPO_ROOT}temp/demo-grid-1280.png`);

    // [V-6] 카드 뷰로 되돌리면 세로 스택으로 복귀한다
    await page.locator('button[title="카드 보기"]:visible').first().click();
    await page.waitForTimeout(300);
    const cardDisplay = await page.evaluate(
      () => getComputedStyle(document.querySelector('[data-testid="demo-book-list"]')).display,
    );
    assert.equal(cardDisplay, 'block', `카드 뷰인데 display가 block이 아니다: ${cardDisplay}`);
    assert.equal(await cards.count(), DEMO_COUNT, '카드 뷰로 되돌리니 카드 수가 달라졌다');

    // --- 6. 상호작용은 로그인 안내로 연결 ---
    await cards.first().locator('button[title="좋아요"]:visible, button[title="좋아요 취소"]:visible').first().click();
    await page.waitForSelector('text=예시 화면입니다', { timeout: 5000 });

    // 토스트가 뜬 상태에서 띠 문구가 가려지지 않는지 사람이 확인한다
    // (토스트는 fixed top-5 right-5 / z-[100]이라 띠와 세로 구간이 겹친다)
    await captureScreenshot(page, `${REPO_ROOT}temp/banner-toast.png`);

    // --- 7. 모바일 폭에서 가로 스크롤 없음 ---
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(scrollWidth <= 376, `375px 폭에서 가로 스크롤 발생: scrollWidth=${scrollWidth}`);

    // [V-3] 375px에서는 2열이다 (useGridColumns의 모바일 분기)
    await page.locator('button[title="그리드 보기"]:visible').first().click();
    await page.waitForTimeout(300);
    const mobileTracks = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('[data-testid="demo-book-list"]'));
      return style.gridTemplateColumns.split(' ').filter(Boolean).length;
    });
    assert.equal(mobileTracks, 2, `375px에서 그리드 트랙이 2개가 아니다: ${mobileTracks}`);
    await captureScreenshot(page, `${REPO_ROOT}temp/demo-grid-375.png`);

    // [V-17] 375px에서 띠가 1줄을 유지한다 (재고 기준일은 sm 미만에서 숨김)
    // 앞 단계에서 띄운 info 토스트(3초)가 사라진 뒤 재야 한다. 토스트는 모바일 폭에서 띠를 덮는다.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForSelector('text=예시 화면입니다', { state: 'detached', timeout: 8000 });
    await page.waitForTimeout(300);

    const mobileBanner = await page.evaluate(() => {
      const banner = document.querySelector('[data-testid="demo-mode-banner"]');
      const style = getComputedStyle(banner);
      const lineHeight = parseFloat(style.lineHeight);
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      return {
        height: banner.getBoundingClientRect().height,
        oneLineHeight: lineHeight + paddingY,
        text: banner.innerText,
      };
    });
    assert.ok(
      mobileBanner.height <= mobileBanner.oneLineHeight + 1,
      `375px에서 띠가 2줄 이상이다: height=${mobileBanner.height}, 1줄=${mobileBanner.oneLineHeight}`,
    );
    assert.ok(!mobileBanner.text.includes('재고'), '375px에서 재고 기준일이 숨겨지지 않았다');

    await captureScreenshot(page, `${REPO_ROOT}temp/banner-375.png`);

    // [V-10] 콘솔·페이지 에러 0건
    assert.deepEqual(pageErrors, [], '페이지 에러가 발생했다');
    assert.deepEqual(consoleErrors, [], '콘솔 에러가 발생했다');

    await freshContext.close();

    // --- 7-1. 로그인 이력이 있으면 데모 대신 안내 화면 ---
    const returningContext = await browser.newContext({ viewport: { width: 1280, height: 600 } });
    await returningContext.addInitScript(() => {
      localStorage.setItem('hasSignedIn', 'true');
    });
    const returningPage = await returningContext.newPage();
    await returningPage.goto(BASE_URL);
    await returningPage.waitForSelector('[data-testid="logged-out-notice"]', { timeout: 15000 });

    // [V-8] 로그아웃·세션 만료 사용자에게 남의 책 20권을 띄우지 않는다
    assert.equal(
      await returningPage.locator('[data-testid="demo-library"]').count(),
      0,
      '로그인 이력이 있는데 데모 서재가 렌더됐다',
    );
    // [V-15] 데모가 안 뜨면 안내 띠도 뜨지 않는다 (조건 드리프트 방지)
    assert.equal(
      await returningPage.locator('[data-testid="demo-mode-banner"]').count(),
      0,
      '데모가 없는데 안내 띠만 렌더됐다 — 판정 조건이 갈라졌다',
    );
    await captureScreenshot(returningPage, `${REPO_ROOT}temp/logged-out-notice.png`);
    await returningContext.close();

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

    // [V-16] 모달이 뜬 상태에서 띠(z-40)가 모달 오버레이(z-50) 위로 뚫고 나오지 않는다.
    // 색만 보고 판단하면 bg-opacity-50 아래의 파란 띠를 "안 덮였다"고 오독하므로 좌표로 실측한다.
    const bannerCovered = await adminPage.evaluate(() => {
      const banner = document.querySelector('[data-testid="demo-mode-banner"]');
      if (!banner) return { hasBanner: false };
      const rect = banner.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        hasBanner: true,
        hitIsBanner: hit === banner || banner.contains(hit),
        hitClass: hit ? hit.className : null,
      };
    });
    assert.ok(bannerCovered.hasBanner, '관리자 컨텍스트에서 데모 띠가 렌더되지 않았다');
    assert.equal(
      bannerCovered.hitIsBanner,
      false,
      `모달이 떠 있는데 띠가 최상단에 있다 — z-index 순서가 잘못됐다 (hit=${bannerCovered.hitClass})`,
    );

    await captureScreenshot(adminPage, `${REPO_ROOT}temp/banner-modal.png`);

    await adminContext.close();
  } finally {
    if (browser) await browser.close();
    await stopServer(serverProcess);
  }
});

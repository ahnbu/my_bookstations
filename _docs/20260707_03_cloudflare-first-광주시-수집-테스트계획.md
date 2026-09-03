---
title: Cloudflare-first 광주시 도서관 수집 테스트계획
created: 2026-07-07 15:10
tags:
  - my-bookstation
  - library-checker
  - diagnostics
  - test-plan
session_id: codex:019f3add-4a5c-7dd1-ba9e-32ac4b87a0e8
session_path: C:/Users/ahnbu/.codex/sessions/2026/07/07/rollout-2026-07-07T13-36-56-019f3add-4a5c-7dd1-ba9e-32ac4b87a0e8.jsonl
ai: codex
status: executed-with-blocker
---

# Cloudflare-first 광주시 도서관 수집 테스트계획 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloudflare Worker에서 광주시 종이책 KOLAS와 시립소장 전자책 수집이 실패하는 원인을 “Cloudflare egress 자체”, “동시성/요청 패턴”, “운영 통합 코드”, “대상 사이트 응답/차단”으로 분리한다.

**Architecture:** 운영 Worker를 바로 수정하지 않고, 먼저 별도 이름의 token 보호 진단 Worker를 배포해 단독/순차/병렬 요청 행렬을 측정한다. Queue/Cron/Workflow는 더 나은 수집망으로 가정하지 않고, 단독 성공 + 병렬 실패가 확인될 때만 “요청을 순차화하는 도구”로 검토한다. Supabase/Vercel은 Cloudflare 내부 가설이 깨진 뒤의 외부 egress 비교군으로만 둔다.

**Tech Stack:** Cloudflare Workers, Wrangler, TypeScript, PowerShell, Node.js, `node-html-parser`

---

## 실행 결과 업데이트

- 실행일시: 2026-07-07 15:18 KST
- 결과 문서: [[20260707_04_cloudflare-first-광주시-수집-테스트결과]]
- 로컬 최소 진단: 5개 case 모두 성공.
- 운영 Worker 기준선: 광주 종이책 5회 중 4회 timeout, 시립소장 전자책 5회 중 5회 timeout.
- Cloudflare 독립 원격 진단: `CLOUDFLARE_API_TOKEN` 권한 부족으로 임시 Worker deploy와 `wrangler dev --remote` 모두 실패.
- 판정: Cloudflare egress 자체 문제와 운영 통합 코드/동시 요청 패턴 문제는 아직 최종 분리되지 않았다.

## 핵심 전제

- 기존 문서 기준 정본 구조는 Cloudflare Worker가 도서관 재고 크롤링 및 키워드 검색 API를 담당하는 것이다.
- Supabase Edge Function과 Vercel Function이 Cloudflare보다 더 안정적이라는 근거는 현재 없다.
- 30초/60초 timeout 연장은 제품 대응안에서 제외한다. 장시간 계측은 “차단/무응답인지, 단순 지연인지”를 구분하기 위한 관측값으로만 사용한다.
- Queue/Cron/Workflow는 같은 Cloudflare 네트워크에서 실행된다. 따라서 Cloudflare egress 자체가 막힌 경우에는 해결책이 아니다.
- Queue/Cron/Workflow가 의미 있는 경우는 요청을 endpoint별/책별로 순차화하거나 rate limit, jitter, single-flight를 적용해야 할 때다.

## 판정 로직

| 관측 결과 | 문제 정의 | Queue/Cron/Workflow 판단 | 다음 액션 |
|---|---|---|---|
| 광주 종이책 단독도 15초 실패 | Cloudflare egress 또는 대상 서버의 Cloudflare 경로 차단/지연 | ❌ 도움 가능성 낮음 | 외부 egress 비교군 실험 |
| 시립소장 단독도 15초 실패 | Cloudflare egress 또는 대상 서버의 Cloudflare 경로 차단/지연 | ❌ 도움 가능성 낮음 | 외부 egress 비교군 실험 |
| 단독은 성공, 병렬만 실패 | 동시 연결 또는 같은 도메인/포트 동시 접근 패턴 문제 | ✅ 도움 가능 | 순차화, Queue, single-flight 검토 |
| 단독/병렬 모두 성공, 운영 통합만 실패 | 운영 통합 코드의 다른 fetch, 캐시, Supabase, 응답 조립 문제 | ⚠️ 조건부 | 운영 코드 내 진단 route로 축소 재현 |
| Cloudflare 진단 Worker는 성공, 현재 운영 Worker만 실패 | 배포 코드 drift 또는 통합 요청 구조 문제 | ⚠️ 조건부 | 운영 Worker와 동일 코드 경로 계측 |
| 특정 Cloudflare colo에서만 실패 | Cloudflare 위치별 egress 차이 | ❌/⚠️ 불확실 | 반복 측정 후 외부 비교군 검토 |

## 파일 계획

| 파일 | 변경 | 목적 |
|---|---|---|
| `library-checker/src/diagnostics-gjcity-worker.ts` | 생성 후 테스트 종료 시 제거 | 운영 코드와 분리된 최소 진단 Worker |
| `tests/gjcity-diagnostics-worker-source.test.mjs` | 생성 후 테스트 종료 시 제거 | 진단 Worker가 token 보호, no-store, 저장소 미사용 조건을 만족하는지 확인 |
| `library-checker/temp/diagnostics-cloudflare-first-YYYYMMDD_HHmm.jsonl` | 생성 | Cloudflare 원격 진단 원본 결과 |
| `library-checker/temp/diagnostics-cloudflare-first-summary-YYYYMMDD_HHmm.json` | 생성 | 행렬 요약 결과 |
| `docs/20260707_04_cloudflare-first-광주시-수집-테스트결과.md` | 테스트 후 생성 | 판정과 다음 액션 기록 |

## 테스트 행렬

| case | 목적 | 호출 방식 | 성공 기준 |
|---|---|---|---|
| `paper-single` | 광주 종이책 단독 egress 확인 | 종이책 endpoint만 5회 순차 호출 | 5회 중 4회 이상 15초 안에 HTTP 200, 결과 marker 존재 |
| `owned-single` | 시립소장 단독 egress 확인 | 시립소장 endpoint만 5회 순차 호출 | 5회 중 4회 이상 15초 안에 HTTP 200, body 1KB 이상 |
| `pair-sequential` | 같은 요청에서 두 endpoint 순차 실행 확인 | paper 후 owned를 5회 반복 | 단독 성공률과 큰 차이 없음 |
| `pair-parallel` | 두 광주시 endpoint 동시 실행 영향 확인 | paper와 owned를 `Promise.allSettled`로 5회 반복 | 순차 대비 timeout 증가 여부 확인 |
| `pair-parallel-jitter` | 반복 호출 간격 영향 확인 | pair 병렬 호출 사이 2초 대기 | jitter로 개선되면 rate pattern 의심 |
| `production-current` | 현재 운영 통합 API 기준선 재확인 | 운영 Worker POST 5회 | 기존 timeout 재현 여부 확인 |

## Task 1: 진단 Worker source test가 준비된다

**Files:**
- Create: `tests/gjcity-diagnostics-worker-source.test.mjs`
- Read: `library-checker/src/diagnostics-gjcity-worker.ts`

- [ ] **Step 1: source-level 안전 테스트 파일이 생성된다**

Create `tests/gjcity-diagnostics-worker-source.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sourcePath = new URL('../library-checker/src/diagnostics-gjcity-worker.ts', import.meta.url);
const source = readFileSync(sourcePath, 'utf8');

test('diagnostic worker is token protected and does not use storage APIs', () => {
  assert.match(source, /DIAGNOSTIC_TOKEN/);
  assert.match(source, /X-Diagnostic-Token/);
  assert.match(source, /Cache-Control['"]?\s*:\s*['"]no-store['"]/);
  assert.match(source, /caseName/);
  assert.match(source, /paper-single/);
  assert.match(source, /owned-single/);
  assert.match(source, /pair-sequential/);
  assert.match(source, /pair-parallel/);
  assert.match(source, /pair-parallel-jitter/);
  assert.match(source, /request\.cf/);
  assert.doesNotMatch(source, /createClient/);
  assert.doesNotMatch(source, /SUPABASE/i);
  assert.doesNotMatch(source, /caches\.default/);
  assert.doesNotMatch(source, /cache\.(match|put)/);
  assert.doesNotMatch(source, /KV|R2|D1/);
});
```

- [ ] **Step 2: 테스트가 먼저 실패한다**

Run:

```powershell
node --test tests/gjcity-diagnostics-worker-source.test.mjs
```

Expected:

- `ENOENT` 또는 source file missing 오류로 실패한다.
- 아직 `library-checker/src/diagnostics-gjcity-worker.ts`가 없기 때문에 실패해야 정상이다.

## Task 2: 최소 진단 Worker가 생성된다

**Files:**
- Create: `library-checker/src/diagnostics-gjcity-worker.ts`
- Test: `tests/gjcity-diagnostics-worker-source.test.mjs`

- [ ] **Step 1: 독립 진단 Worker 파일이 생성된다**

Create `library-checker/src/diagnostics-gjcity-worker.ts`:

```typescript
type Env = {
  DIAGNOSTIC_TOKEN?: string;
};

type TargetName = 'paper' | 'owned';
type CaseName =
  | 'paper-single'
  | 'owned-single'
  | 'pair-sequential'
  | 'pair-parallel'
  | 'pair-parallel-jitter';

type ProbeResult = {
  target: TargetName;
  run: number;
  timeoutMs: number;
  startedAtKst: string;
  elapsedMs: number;
  ok: boolean;
  status: number | null;
  statusText: string | null;
  bytes: number;
  markers: Record<string, boolean>;
  parse: Record<string, number | string | boolean | null>;
  error: { name: string; message: string } | null;
};

function kstNow(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  const sec = String(kst.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), max);
}

function htmlMarkers(target: TargetName, html: string): { markers: Record<string, boolean>; parse: Record<string, number | string | boolean | null> } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
  if (target === 'paper') {
    const resultItems = (html.match(/class=["'][^"']*resultList[^"']*["']/g) || []).length;
    return {
      markers: {
        resultList: html.includes('resultList'),
        noResultText: html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다'),
        webFirewall: html.includes('Web firewall') || html.includes('security policies have been blocked'),
        errorText: html.includes('오류') || html.toLowerCase().includes('error'),
      },
      parse: {
        resultListClassMentions: resultItems,
        title,
      },
    };
  }

  const bookItems = (html.match(/book_resultList/g) || []).length;
  return {
    markers: {
      bookResultList: html.includes('book_resultList'),
      noResultText: html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다'),
      webFirewall: html.includes('Web firewall') || html.includes('security policies have been blocked'),
      errorText: html.includes('오류') || html.toLowerCase().includes('error'),
    },
    parse: {
      bookResultListMentions: bookItems,
      title,
    },
  };
}

async function probePaper(run: number, timeoutMs: number): Promise<ProbeResult> {
  const target: TargetName = 'paper';
  const startedAtKst = kstNow();
  const started = Date.now();
  const url = 'https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do';
  const payload = new URLSearchParams({
    searchType: 'DETAIL',
    searchKey5: 'ISBN',
    searchKeyword5: '9791175790599',
    searchLibrary: 'ALL',
    searchSort: 'SIMILAR',
    searchRecordCount: '30',
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchDetail.do',
      },
      body: payload.toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const html = await response.text();
    const inspected = htmlMarkers(target, html);
    return {
      target,
      run,
      timeoutMs,
      startedAtKst,
      elapsedMs: Date.now() - started,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      bytes: html.length,
      markers: inspected.markers,
      parse: inspected.parse,
      error: null,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      target,
      run,
      timeoutMs,
      startedAtKst,
      elapsedMs: Date.now() - started,
      ok: false,
      status: null,
      statusText: null,
      bytes: 0,
      markers: {},
      parse: {},
      error: { name: err.name, message: err.message },
    };
  }
}

async function probeOwned(run: number, timeoutMs: number): Promise<ProbeResult> {
  const target: TargetName = 'owned';
  const startedAtKst = kstNow();
  const started = Date.now();
  const keyword = encodeURIComponent('하네스 엔지니어링 with');
  const url = `https://lib.gjcity.go.kr:444/elibrary-front/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${keyword}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://lib.gjcity.go.kr:444/elibrary-front/',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const html = await response.text();
    const inspected = htmlMarkers(target, html);
    return {
      target,
      run,
      timeoutMs,
      startedAtKst,
      elapsedMs: Date.now() - started,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      bytes: html.length,
      markers: inspected.markers,
      parse: inspected.parse,
      error: null,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      target,
      run,
      timeoutMs,
      startedAtKst,
      elapsedMs: Date.now() - started,
      ok: false,
      status: null,
      statusText: null,
      bytes: 0,
      markers: {},
      parse: {},
      error: { name: err.name, message: err.message },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCase(caseName: CaseName, repeat: number, timeoutMs: number): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];

  for (let run = 1; run <= repeat; run += 1) {
    if (caseName === 'paper-single') {
      results.push(await probePaper(run, timeoutMs));
    } else if (caseName === 'owned-single') {
      results.push(await probeOwned(run, timeoutMs));
    } else if (caseName === 'pair-sequential') {
      results.push(await probePaper(run, timeoutMs));
      results.push(await probeOwned(run, timeoutMs));
    } else if (caseName === 'pair-parallel') {
      const pair = await Promise.allSettled([probePaper(run, timeoutMs), probeOwned(run, timeoutMs)]);
      for (const item of pair) {
        if (item.status === 'fulfilled') results.push(item.value);
      }
    } else if (caseName === 'pair-parallel-jitter') {
      const pair = await Promise.allSettled([probePaper(run, timeoutMs), probeOwned(run, timeoutMs)]);
      for (const item of pair) {
        if (item.status === 'fulfilled') results.push(item.value);
      }
      if (run < repeat) await sleep(2000);
    }
  }

  return results;
}

function summarize(results: ProbeResult[]) {
  const byTarget: Record<string, { total: number; success: number; timeout: number; maxElapsedMs: number; minBytes: number | null }> = {};
  for (const result of results) {
    const current = byTarget[result.target] || { total: 0, success: 0, timeout: 0, maxElapsedMs: 0, minBytes: null };
    current.total += 1;
    if (result.ok) current.success += 1;
    if (result.error?.message.includes('timeout') || result.error?.name === 'TimeoutError') current.timeout += 1;
    current.maxElapsedMs = Math.max(current.maxElapsedMs, result.elapsedMs);
    current.minBytes = current.minBytes === null ? result.bytes : Math.min(current.minBytes, result.bytes);
    byTarget[result.target] = current;
  }
  return byTarget;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Diagnostic-Token',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/health') {
      return Response.json({ ok: true, nowKst: kstNow(), colo: request.cf?.colo || null }, {
        headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
      });
    }

    if (url.pathname !== '/diagnostics/gjcity') {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const expectedToken = env.DIAGNOSTIC_TOKEN;
    const providedToken = request.headers.get('X-Diagnostic-Token') || url.searchParams.get('token');
    const isLocalhost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if ((!expectedToken && !isLocalhost) || (expectedToken && providedToken !== expectedToken)) {
      return Response.json({ error: 'diagnostic token is required' }, {
        status: 403,
        headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
      });
    }

    const caseName = (url.searchParams.get('case') || 'paper-single') as CaseName;
    const allowedCases: CaseName[] = ['paper-single', 'owned-single', 'pair-sequential', 'pair-parallel', 'pair-parallel-jitter'];
    if (!allowedCases.includes(caseName)) {
      return Response.json({ error: `unsupported case: ${caseName}` }, {
        status: 400,
        headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
      });
    }

    const repeat = parsePositiveInt(url.searchParams.get('repeat'), 5, 10);
    const timeoutMs = parsePositiveInt(url.searchParams.get('timeoutMs'), 15000, 60000);
    const startedAtKst = kstNow();
    const started = Date.now();
    const results = await runCase(caseName, repeat, timeoutMs);

    return Response.json({
      diagnostic: 'cloudflare-first-gjcity-collector',
      caseName,
      startedAtKst,
      elapsedMs: Date.now() - started,
      runtime: 'cloudflare-worker',
      colo: request.cf?.colo || null,
      country: request.cf?.country || null,
      input: { repeat, timeoutMs },
      summary: summarize(results),
      results,
    }, {
      headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
    });
  },
};
```

- [ ] **Step 2: source-level 테스트가 통과한다**

Run:

```powershell
node --test tests/gjcity-diagnostics-worker-source.test.mjs
```

Expected:

- `pass 1`
- `fail 0`

## Task 3: 로컬 진단 Worker가 기준선과 일치한다

**Files:**
- Read: `library-checker/src/diagnostics-gjcity-worker.ts`
- Output: `library-checker/temp/diagnostics-cloudflare-first-local-YYYYMMDD_HHmm.jsonl`

- [ ] **Step 1: 로컬 Worker를 foreground가 아닌 숨김 프로세스로 실행한다**

Run:

```powershell
$port = 8790
$tempDir = 'D:/vibe-coding/my_bookstation/library-checker/temp'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$logPath = Join-Path $tempDir 'diagnostics-gjcity-worker-local.log'
$proc = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList @('/c', 'npx wrangler dev src/diagnostics-gjcity-worker.ts --port 8790 --log-level error > temp\diagnostics-gjcity-worker-local.log 2>&1') `
  -WorkingDirectory 'D:/vibe-coding/my_bookstation/library-checker' `
  -WindowStyle Hidden `
  -PassThru
```

Expected:

- `$proc.Id`가 존재한다.
- `http://127.0.0.1:8790/health`가 40초 안에 HTTP 200을 반환한다.

- [ ] **Step 2: 로컬 진단 행렬이 실행된다**

Run:

```powershell
$env:DIAGNOSTIC_TOKEN_VALUE = 'local-test-token'
$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$out = "D:/vibe-coding/my_bookstation/library-checker/temp/diagnostics-cloudflare-first-local-$stamp.jsonl"
$cases = @('paper-single','owned-single','pair-sequential','pair-parallel','pair-parallel-jitter')
foreach ($caseName in $cases) {
  $url = "http://127.0.0.1:8790/diagnostics/gjcity?case=$caseName&repeat=3&timeoutMs=15000&token=$env:DIAGNOSTIC_TOKEN_VALUE"
  $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 120
  $response.Content | Add-Content -Path $out -Encoding UTF8
}
Write-Output $out
```

Expected:

- `paper-single`은 HTTP 200, `paper.success >= 2/3`이다.
- `owned-single`은 HTTP 200, `owned.success >= 2/3`이다.
- `pair-sequential`, `pair-parallel`, `pair-parallel-jitter`가 모두 JSON을 반환한다.

- [ ] **Step 3: 로컬 Worker 프로세스가 종료된다**

Run:

```powershell
if ($proc -and -not $proc.HasExited) {
  taskkill /F /T /PID $proc.Id
}
Start-Sleep -Seconds 2

$conns = Get-NetTCPConnection -LocalPort 8790 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $conns) {
  $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($conn.OwningProcess)" -ErrorAction SilentlyContinue
  if ($owner.CommandLine -match 'wrangler' -and $owner.CommandLine -match 'diagnostics-gjcity-worker') {
    taskkill /F /T /PID $conn.OwningProcess
  } else {
    Write-Warning "Port 8790 is still used by PID $($conn.OwningProcess): $($owner.CommandLine)"
  }
}

Get-NetTCPConnection -LocalPort 8790 -ErrorAction SilentlyContinue
```

Expected:

- 마지막 명령이 `Listen` connection을 출력하지 않는다.
- warning이 출력되면 테스트를 계속하지 않고 8790 포트 점유 프로세스를 먼저 확인한다.

## Task 4: Cloudflare 임시 진단 Worker가 안전하게 배포된다

**Files:**
- Create external temporary Worker: `library-checker-gjcity-diag`
- Create secret: `DIAGNOSTIC_TOKEN`
- Output: Cloudflare workers.dev URL

- [ ] **Step 1: Cloudflare API token 환경변수가 현재 프로세스에만 주입된다**

Run:

```powershell
$envPath = 'C:/Users/ahnbu/.env'
foreach ($line in Get-Content $envPath) {
  if ($line -match '^\s*(CLOUDFLARE_[A-Z0-9_]+)\s*=\s*(.*)\s*$') {
    $name = $matches[1]
    $value = $matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}
npx wrangler whoami
```

Expected:

- `You are logged in with an Account API Token`을 포함한다.
- token 값은 출력되지 않는다.

- [ ] **Step 2: 배포 전 security gate가 실행된다**

Run:

```powershell
node C:/Users/ahnbu/.claude/skills/_shared/security-gate.mjs deploy-vet --target D:/vibe-coding/my_bookstation/library-checker
```

Expected:

- PASS면 Step 3으로 진행한다.
- `.env.example`만 민감 파일로 차단하면, `.env.example` 내용이 placeholder인지 직접 확인하고 사용자 승인 후 Step 3으로 진행한다.
- 실제 secret 값, credential, 외부 전송 의심 패턴이 나오면 배포를 중단한다.

- [ ] **Step 3: 임시 Worker dry-run이 성공한다**

Run:

```powershell
cd D:/vibe-coding/my_bookstation/library-checker
npx wrangler deploy src/diagnostics-gjcity-worker.ts --name library-checker-gjcity-diag --dry-run --compatibility-date 2025-08-09
```

Expected:

- bundle/build가 성공한다.
- 실제 배포 URL은 생성되지 않는다.

- [ ] **Step 4: 임시 Worker가 배포된다**

Run:

```powershell
cd D:/vibe-coding/my_bookstation/library-checker
$deployOutput = npx wrangler deploy src/diagnostics-gjcity-worker.ts --name library-checker-gjcity-diag --compatibility-date 2025-08-09 2>&1
$deployOutput
$deployText = ($deployOutput | Out-String)
$match = [regex]::Match($deployText, 'https://[^\s]+\.workers\.dev')
if (-not $match.Success) { throw 'workers.dev URL not found in deploy output' }
$env:DIAG_WORKER_URL = $match.Value
Write-Output $env:DIAG_WORKER_URL
```

Expected:

- `$env:DIAG_WORKER_URL`에 실제 `workers.dev` URL이 저장된다.
- 운영 Worker `library-checker`에는 영향이 없다.

- [ ] **Step 5: 임시 Worker secret이 설정된다**

Run:

```powershell
$chars = (48..57) + (65..90) + (97..122)
$env:DIAGNOSTIC_TOKEN_VALUE = -join ($chars | Get-Random -Count 40 | ForEach-Object { [char]$_ })
$env:DIAGNOSTIC_TOKEN_VALUE | npx wrangler secret put DIAGNOSTIC_TOKEN --name library-checker-gjcity-diag
```

Expected:

- command output이 secret 값 자체를 출력하지 않는다.
- `DIAGNOSTIC_TOKEN` secret 등록 성공 메시지가 나온다.

## Task 5: Cloudflare 원격 진단 행렬이 실행된다

**Files:**
- Output: `library-checker/temp/diagnostics-cloudflare-first-YYYYMMDD_HHmm.jsonl`
- Output: `library-checker/temp/diagnostics-cloudflare-first-summary-YYYYMMDD_HHmm.json`

- [ ] **Step 1: health와 token 보호가 확인된다**

Run:

```powershell
$baseUrl = $env:DIAG_WORKER_URL
if (-not $baseUrl) { throw 'DIAG_WORKER_URL is not set. Run Task 4 Step 4 first.' }
Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing -TimeoutSec 30
Invoke-WebRequest -Uri "$baseUrl/diagnostics/gjcity?case=paper-single" -UseBasicParsing -TimeoutSec 30
```

Expected:

- `/health`는 HTTP 200을 반환한다.
- token 없는 `/diagnostics/gjcity`는 HTTP 403을 반환한다.
- 403 body는 `diagnostic token is required`를 포함한다.

- [ ] **Step 2: 단독/순차/병렬 행렬이 실행된다**

Run:

```powershell
$baseUrl = $env:DIAG_WORKER_URL
if (-not $baseUrl) { throw 'DIAG_WORKER_URL is not set. Run Task 4 Step 4 first.' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$out = "D:/vibe-coding/my_bookstation/library-checker/temp/diagnostics-cloudflare-first-$stamp.jsonl"
$cases = @('paper-single','owned-single','pair-sequential','pair-parallel','pair-parallel-jitter')
$headers = @{ 'X-Diagnostic-Token' = $env:DIAGNOSTIC_TOKEN_VALUE }

foreach ($caseName in $cases) {
  $url = "$baseUrl/diagnostics/gjcity?case=$caseName&repeat=5&timeoutMs=15000"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing -TimeoutSec 180
    $sw.Stop()
    $record = $response.Content | ConvertFrom-Json
    $record | Add-Member -NotePropertyName outerElapsedSeconds -NotePropertyValue ([math]::Round($sw.Elapsed.TotalSeconds, 1))
    $record | ConvertTo-Json -Depth 20 -Compress | Add-Content -Path $out -Encoding UTF8
    Write-Output "$caseName OK $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
  } catch {
    $sw.Stop()
    [pscustomobject]@{
      diagnostic = 'cloudflare-first-gjcity-collector'
      caseName = $caseName
      outerElapsedSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 1)
      error = $_.Exception.Message
    } | ConvertTo-Json -Depth 10 -Compress | Add-Content -Path $out -Encoding UTF8
    Write-Output "$caseName ERROR $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
  }
}

Write-Output $out
```

Expected:

- 5개 case가 모두 JSONL에 기록된다.
- 각 JSON은 `caseName`, `colo`, `summary`, `results`를 포함한다.
- 어떤 case가 실패하더라도 다음 case는 계속 실행된다.

- [ ] **Step 3: 결과 요약 JSON이 생성된다**

Run:

```powershell
$latest = Get-ChildItem D:/vibe-coding/my_bookstation/library-checker/temp/diagnostics-cloudflare-first-*.jsonl |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$summaryOut = $latest.FullName -replace '\.jsonl$', '-summary.json'

node -e "
const fs = require('fs');
const lines = fs.readFileSync(process.argv[1], 'utf8').trim().split(/\r?\n/).filter(Boolean);
const rows = lines.map(line => JSON.parse(line));
const summary = rows.map(row => ({
  caseName: row.caseName,
  colo: row.colo || null,
  outerElapsedSeconds: row.outerElapsedSeconds || null,
  summary: row.summary || null,
  topError: row.error || (row.results || []).find(r => r.error)?.error || null
}));
fs.writeFileSync(process.argv[2], JSON.stringify(summary, null, 2));
console.log(process.argv[2]);
" $latest.FullName $summaryOut
```

Expected:

- `diagnostics-cloudflare-first-...-summary.json` 파일이 생성된다.
- 각 case별 성공 수, timeout 수, 최대 elapsed가 한눈에 보인다.

## Task 6: 현재 운영 Worker 기준선이 같은 시간대에 재측정된다

**Files:**
- Output: `library-checker/temp/diagnostics-production-current-YYYYMMDD_HHmm.json`

- [ ] **Step 1: 운영 통합 API가 5회 호출된다**

Run:

```powershell
$body = @{
  isbn='9791175790599'
  author='황민호 (지은이)'
  customTitle=''
  eduTitle='하네스 엔지니어링 with'
  gyeonggiTitle='하네스 엔지니어링 with'
  siripTitle='하네스 엔지니어링 with'
  isDbSchemaChanged=$true
} | ConvertTo-Json -Compress

$rows = for ($i=1; $i -le 5; $i++) {
  $sw=[Diagnostics.Stopwatch]::StartNew()
  try {
    $r=Invoke-WebRequest -Uri 'https://library-checker.byungwook-an.workers.dev' -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 60
    $sw.Stop()
    $json=$r.Content|ConvertFrom-Json
    [pscustomobject]@{
      run=$i
      seconds=[math]::Round($sw.Elapsed.TotalSeconds,1)
      status=$r.StatusCode
      cacheStatus=($r.Headers['X-Cache-Status'] -join ',')
      cacheControl=($r.Headers['Cache-Control'] -join ',')
      gwangju=($json.gwangjuPaper.error ?? 'ok')
      siripOwned=($json.siripEbook.errors.owned ?? 'ok')
      siripSubs="$($json.siripEbook.totalCountSubs)/$($json.siripEbook.availableCountSubs)"
      gyeonggi="$($json.gyeonggiEbookLib.totalCountSummary)/$($json.gyeonggiEbookLib.availableCountSummary)"
      eduErrorCount=$json.gyeonggiEbookEdu.errorCount
    }
  } catch {
    $sw.Stop()
    [pscustomobject]@{
      run=$i
      seconds=[math]::Round($sw.Elapsed.TotalSeconds,1)
      error=$_.Exception.Message
    }
  }
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$out = "D:/vibe-coding/my_bookstation/library-checker/temp/diagnostics-production-current-$stamp.json"
$rows | ConvertTo-Json -Depth 10 | Set-Content -Path $out -Encoding UTF8
Write-Output $out
```

Expected:

- 5회 결과가 저장된다.
- 기존과 같이 광주 종이책/시립소장 timeout이 재현되는지 확인된다.

## Task 7: 판정표가 작성된다

**Files:**
- Create: `docs/20260707_04_cloudflare-first-광주시-수집-테스트결과.md`

- [ ] **Step 1: 결과 문서가 생성된다**

Completion criteria:

- 문서는 KST 기준 실행 시각을 포함한다.
- `paper-single`, `owned-single`, `pair-sequential`, `pair-parallel`, `pair-parallel-jitter`, `production-current` 결과를 표로 포함한다.
- 각 case별 `success/total`, timeout 수, 최대 elapsed, body 최소 bytes, `colo`를 기록한다.
- 임시 Worker URL은 기록하되 `DIAGNOSTIC_TOKEN` 값은 기록하지 않는다.

- [ ] **Step 2: Queue/Cron/Workflow 가치가 조건부로 판정된다**

Decision rules:

| 조건 | 판정 문구 |
|---|---|
| 단독 실패 | `Queue/Cron/Workflow는 해결책으로 보지 않는다. 같은 Cloudflare egress 문제일 가능성이 높다.` |
| 단독 성공 + 병렬 실패 | `Queue/Workflow는 순차화와 rate limit 도구로 검토할 가치가 있다.` |
| 단독/병렬 성공 + 운영 실패 | `운영 통합 코드 경로의 추가 계측이 필요하다.` |
| jitter에서만 개선 | `반복 요청 패턴 또는 대상 서버 rate rule 가능성이 있다.` |
| 모든 Cloudflare case 성공 | `현재 운영 Worker와 진단 Worker의 코드/배포 차이를 비교한다.` |

## Task 8: 임시 리소스가 정리된다

**Files:**
- Delete via safe-trash: `library-checker/src/diagnostics-gjcity-worker.ts`
- Delete via safe-trash: `tests/gjcity-diagnostics-worker-source.test.mjs`
- External delete: Cloudflare Worker `library-checker-gjcity-diag`

- [ ] **Step 1: 임시 Cloudflare Worker가 삭제된다**

Run:

```powershell
cd D:/vibe-coding/my_bookstation/library-checker
npx wrangler delete library-checker-gjcity-diag --force
```

Expected:

- 삭제 성공 메시지가 출력된다.
- `$env:DIAG_WORKER_URL/health` 호출이 실패한다.

- [ ] **Step 2: 임시 로컬 파일이 휴지통으로 이동된다**

Run:

```powershell
$safeTrash = (Get-Command safe-trash -ErrorAction Stop).Source
& $safeTrash `
  D:/vibe-coding/my_bookstation/library-checker/src/diagnostics-gjcity-worker.ts `
  D:/vibe-coding/my_bookstation/tests/gjcity-diagnostics-worker-source.test.mjs
```

Expected:

- `safe-trash`가 `C:/Users/ahnbu/scripts/safe-trash.ps1`로 resolve된다.
- 두 파일이 작업트리에서 사라진다.
- `git status --short`에 source/test 임시 파일이 남지 않는다.

- [ ] **Step 3: 최종 상태가 확인된다**

Run:

```powershell
git status --short
rg -n "X-Diagnostic-Token\\s*=\\s*['\"][A-Za-z0-9]{20,}|token=[A-Za-z0-9]{20,}|library-checker-gjcity-diag\\..*[?&]token=" docs library-checker/temp
```

Expected:

- git status에는 계획 문서, plan-check-lite 검수 보고서, 결과 문서만 남는다.
- `rg`는 실제 token 값 또는 token query 문자열을 포함한 문서를 찾지 않는다.

## 외부 egress 비교군 조건

아래 조건 중 하나를 만족할 때만 Supabase Edge Function 또는 Vercel Node Function 비교 실험을 계획한다.

- `paper-single` 또는 `owned-single`이 Cloudflare 임시 Worker에서 5회 중 2회 이상 timeout이다.
- Cloudflare `colo`가 달라도 동일하게 단독 실패한다.
- 운영 Worker와 독립 진단 Worker 모두 같은 endpoint에서 15초 실패한다.

외부 비교군 실험의 목적은 “Supabase/Vercel이 더 낫다”를 증명하는 것이 아니라, “Cloudflare egress만의 문제인가”를 판정하는 것이다.

## 완료 기준

- Cloudflare 임시 Worker에서 단독/순차/병렬/jitter 행렬 결과가 확보된다.
- 현재 운영 Worker 기준선이 같은 시간대에 5회 재측정된다.
- Queue/Cron/Workflow가 도움 되는 조건인지 아닌지 판정된다.
- Supabase/Vercel 비교군이 필요한지 여부가 문서에 명시된다.
- 임시 Worker, secret, source test, 진단 source 파일이 정리된다.

## Self-review

- Spec coverage: 사용자의 질문인 “Cloudflare 다른 서비스가 왜 더 나은가”에 대해, 더 낫다고 가정하지 않고 단독/병렬/패턴 가설을 분리하는 테스트로 대응했다.
- Placeholder scan: 미해결 표식과 URL placeholder가 남지 않았는지 확인했다.
- Type consistency: `caseName`, `timeoutMs`, `repeat`, `summary`, `results`, `DIAGNOSTIC_TOKEN` 명칭을 코드와 명령에서 동일하게 사용했다.

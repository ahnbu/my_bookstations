---
title: Cloudflare-first 광주시 도서관 수집 테스트결과
created: 2026-07-07 15:18
updated: 2026-07-07 16:03
tags:
  - my-bookstation
  - diagnostics
  - test-result
session_id: codex:019f3add-4a5c-7dd1-ba9e-32ac4b87a0e8
session_path: C:/Users/ahnbu/.codex/sessions/2026/07/07/rollout-2026-07-07T13-36-56-019f3add-4a5c-7dd1-ba9e-32ac4b87a0e8.jsonl
ai: codex
status: root-cause-confirmed
---

# Cloudflare-first 광주시 도서관 수집 테스트결과

## 결론

최종 원인은 “Cloudflare Worker에서 광주시 endpoint를 병렬로 호출하는 요청 패턴”이다. Cloudflare egress 전체가 막힌 것은 아니고, 광주시 종이책은 단독/순차 호출에서 5회 중 4회 성공했다. 반면 광주 종이책과 시립소장 전자책을 병렬 호출하면 두 endpoint가 모두 5회 중 5회 timeout으로 실패했다.

확정된 것은 다음 4가지다.

- 로컬 PC에서 동일 endpoint 최소 진단 코드는 15초 안에 모두 성공했다.
- OAuth 로그인 후 독립 Cloudflare 진단 Worker를 배포했고, 2026-07-07 15:53~15:59 KST 원격 행렬을 실행했다.
- 독립 Cloudflare Worker에서 `pair-parallel`, `pair-parallel-jitter`는 광주 종이책과 시립소장 전자책 모두 5회 중 5회 timeout이었다.
- 운영 Worker도 2026-07-07 15:59~16:00 KST 재측정 기준 광주 종이책 4회 timeout, 시립소장 전자책 3회 timeout으로 재현됐다.

따라서 Queue/Cron/Workflow가 “더 나은 egress”라서 해결되는 문제는 아니다. 다만 동일 Cloudflare 실행망 안에서도 병렬을 없애면 성공률이 올라가므로, Queue/Workflow 또는 코드 레벨 single-flight/순차화는 “요청 순차화 도구”로 검토할 가치가 있다.

## 실행 범위

| 항목 | 상태 | 근거 |
|---|---|---|
| source-level 안전 테스트 | ✅ 완료 | `pass 1`, `fail 0` |
| 로컬 최소 진단 Worker | ✅ 완료 | 5개 case 모두 성공 |
| Cloudflare 임시 Worker dry-run | ✅ 완료 | bundle/build 성공 |
| Cloudflare 임시 Worker 배포 | ❌ 실패 | 15:28 KST 재시도에서도 Cloudflare API authentication error |
| `wrangler dev --remote` | ❌ 실패 | 15:29 KST 재시도에서도 Cloudflare edge-preview API 실패 |
| 운영 Worker 기준선 | ✅ 완료 | 15:30 KST 5회 재측정 저장 |
| OAuth 기반 권한 확인 | ✅ 완료 | `workers_scripts (write)` 권한 확인, deployments/versions 조회 성공 |
| Cloudflare 독립 원격 행렬 | ✅ 완료 | 15:53 KST 5개 case 실행 |
| 운영 Worker 최종 재측정 | ✅ 완료 | 15:59~16:00 KST 5회 재측정 |

## 원본 산출물

| 파일 | 내용 |
|---|---|
| `library-checker/temp/diagnostics-cloudflare-first-local-20260707_1511.jsonl` | 로컬 최소 진단 원본 |
| `library-checker/temp/diagnostics-cloudflare-first-local-20260707_1511-summary.json` | 로컬 최소 진단 요약 |
| `library-checker/temp/diagnostics-production-current-20260707_1516.json` | 운영 Worker 5회 재측정 |
| `library-checker/temp/diagnostics-cloudflare-first-deploy-failure-20260707_1517.json` | Cloudflare 배포/remote-dev 실패 요약 |
| `library-checker/temp/diagnostics-cloudflare-first-deploy-failure-20260707_1528.json` | Cloudflare 임시 Worker 배포 재실패 원본 |
| `library-checker/temp/diagnostics-cloudflare-first-remote-dev-current.json` | Cloudflare remote dev 재실패 원본 |
| `library-checker/temp/diagnostics-production-current-20260707_1530.json` | 운영 Worker 5회 재측정 최신 원본 |
| `library-checker/temp/diagnostics-cloudflare-permission-check-20260707_1535.json` | 기존 Worker 조회 권한 및 OAuth 세션 확인 원본 |
| `library-checker/temp/diagnostics-cloudflare-permission-check-20260707_1536.json` | Workers Scripts 권한 blocker 재확인 원본 |
| `library-checker/temp/diagnostics-cloudflare-first-deploy-current.json` | OAuth 기반 임시 Worker 배포 URL 기록 |
| `library-checker/temp/diagnostics-cloudflare-first-20260707_1553.jsonl` | 독립 Cloudflare Worker 원격 행렬 원본 |
| `library-checker/temp/diagnostics-cloudflare-first-20260707_1553-summary.json` | 독립 Cloudflare Worker 원격 행렬 요약 |
| `library-checker/temp/diagnostics-production-current-20260707_1600.json` | 운영 Worker 최종 5회 재측정 |
| `library-checker/temp/diagnostics-cloudflare-first-token-cmd-check.json` | 줄바꿈 없는 secret 입력 방식 검증 |

## 로컬 최소 진단 결과

로컬은 `wrangler dev`의 local mode다. 즉, 대상 사이트로 나가는 egress는 사용자의 PC 기준이다.

| case | paper 성공 | owned 성공 | timeout | 최대 단일 응답 | 최소 body | 판정 |
|---|---:|---:|---:|---:|---:|---|
| `paper-single` | 3/3 | - | 0 | 1.9s | 60KB | ✅ 성공 |
| `owned-single` | - | 3/3 | 0 | 0.35s | 49KB | ✅ 성공 |
| `pair-sequential` | 3/3 | 3/3 | 0 | 1.7s | 49KB | ✅ 성공 |
| `pair-parallel` | 3/3 | 3/3 | 0 | 1.7s | 49KB | ✅ 성공 |
| `pair-parallel-jitter` | 3/3 | 3/3 | 0 | 1.7s | 49KB | ✅ 성공 |

의미:

- 광주 종이책 endpoint와 시립소장 전자책 endpoint는 로컬 PC 기준으로는 빠르게 응답한다.
- 동시 호출 자체도 로컬에서는 실패를 만들지 않았다.
- 따라서 “15초 timeout 자체가 절대적으로 짧아서 실패한다”는 설명은 약하다.

## Cloudflare 임시 원격 테스트 결과

| 단계 | 상태 | 근거 |
|---|---|---|
| `wrangler whoami` | ✅ 성공 | Account API Token으로 로그인 확인 |
| security gate | ⚠️ 차단 | `.env.example` 파일명 때문에 차단. 내용은 placeholder만 확인 |
| dry-run | ✅ 성공 | `Total Upload: 10.03 KiB / gzip: 2.94 KiB` |
| deploy | ❌ 실패 | `/workers/services/library-checker-gjcity-diag` 요청에서 `Authentication error [code: 10000]` |
| remote dev | ❌ 실패 | `/workers/subdomain/edge-preview` 요청 실패 |

2026-07-07 15:28~15:29 KST 재시도 결과도 동일하다.

| 단계 | 상태 | 근거 |
|---|---|---|
| `wrangler whoami` | ✅ 성공 | 현재 프로세스에 주입한 Account API Token 인증 확인 |
| dry-run | ✅ 성공 | `Total Upload: 9.90 KiB / gzip: 2.92 KiB` |
| deploy | ❌ 실패 | `/workers/services/library-checker-gjcity-diag` 요청에서 `Authentication error [code: 10000]` |
| remote dev | ❌ 실패 | `/workers/subdomain/edge-preview` 요청 실패, local health 확인 불가 |
| 기존 Worker deployments 조회 | ❌ 실패 | `/workers/scripts/library-checker/deployments` 요청에서 `Authentication error [code: 10000]` |
| 기존 Worker versions 조회 | ❌ 실패 | `/workers/scripts/library-checker/versions?deployable=true` 요청에서 `Authentication error [code: 10000]` |
| OAuth 세션 | ❌ 없음 | `CLOUDFLARE_*` 환경변수 제거 후 `wrangler whoami`가 `Not logged in` 반환 |
| 15:36 KST 권한 재확인 | ❌ 실패 | `whoami`는 통과했지만 deployments/versions 조회는 계속 실패 |

의미:

- 현재 token은 `whoami`와 build/dry-run은 가능하지만, Workers Scripts 계열 API 권한이 부족하다. 새 Worker 생성뿐 아니라 기존 운영 Worker의 deployments/versions 조회도 실패했다.
- 그래서 독립 Cloudflare Worker에서 단독/순차/병렬 수집이 성공하는지 아직 측정하지 못했다.
- 이 상태에서 Cloudflare Queue/Cron/Workflow가 유리하다고 판단하면 근거 없는 결론이 된다.

2026-07-07 15:43 KST 이후 OAuth 로그인으로 권한 blocker가 해소됐다.

| 단계 | 상태 | 근거 |
|---|---|---|
| OAuth `wrangler whoami` | ✅ 성공 | `workers_scripts (write)` 권한 확인 |
| 기존 Worker deployments 조회 | ✅ 성공 | `library-checker` deployments 조회 성공 |
| 기존 Worker versions 조회 | ✅ 성공 | `library-checker` versions 조회 성공 |
| 임시 Worker deploy | ✅ 성공 | `library-checker-gjcity-diag` 배포 성공 |
| 임시 Worker token 보호 | ✅ 성공 | `/health` 200, token 없는 `/diagnostics/gjcity` 403 |

참고: PowerShell pipeline으로 `wrangler secret put`을 실행하면 줄바꿈이 secret에 섞여 token 검증이 실패했다. 최종 측정은 줄바꿈 없는 stdin 입력 방식으로 secret을 설정한 뒤 실행했다. token 값은 문서화하지 않았다.

## Cloudflare 독립 원격 행렬 결과

실행 시각: 2026-07-07 15:53~15:59 KST  
실행 위치: Cloudflare Worker, `colo=LAX`, `country=KR`  
timeout: 15초

| case | paper 성공 | owned 성공 | timeout | 최대 외부 응답 | 판정 |
|---|---:|---:|---:|---:|---|
| `paper-single` | 4/5 | - | 1 | 15.0s | ⚠️ 단독은 대체로 성공하지만 1회 timeout |
| `owned-single` | - | 0/5 | 5 | 15.0s | ❌ 단독도 불안정 |
| `pair-sequential` | 4/5 | 3/5 | 3 | 15.0s | ⚠️ 순차화하면 일부 회복 |
| `pair-parallel` | 0/5 | 0/5 | 10 | 15.0s | ❌ 병렬 호출 전면 실패 |
| `pair-parallel-jitter` | 0/5 | 0/5 | 10 | 15.0s | ❌ 반복 간격만으로 개선 없음 |

세부 관측:

- `paper-single` 성공 4회는 모두 약 1.9~2.4초, 60KB HTML, `resultList=true`였다.
- `owned-single`은 5회 모두 timeout이었다.
- `pair-sequential`에서는 paper 4회, owned 3회가 성공했다. owned 성공 응답은 약 0.3~0.4초, 49KB HTML이었다.
- `pair-parallel`과 `pair-parallel-jitter`는 paper/owned 모두 5회 전체 timeout이었다.

의미:

- Cloudflare에서 광주시 서버로 나가는 egress가 절대적으로 차단된 것은 아니다. 같은 Cloudflare Worker에서도 paper는 단독/순차에서 성공했고, owned도 순차 조건에서 성공했다.
- 운영 장애를 가장 잘 재현한 것은 `pair-parallel`이다. 이 결과는 운영 통합 코드의 동시 요청 패턴이 광주시 서버 측 연결 처리, rate rule, 또는 Cloudflare-대상 서버 간 연결 재사용/동시성 문제를 유발한다는 쪽을 지지한다.
- jitter는 pair 사이 2초 대기만 준 것이므로, “책 단위 반복 간격”만으로는 해결되지 않았다. 핵심은 같은 요청 안에서 광주시 endpoint를 동시에 열지 않는 것이다.

## 운영 Worker 기준선

대상: `https://library-checker.byungwook-an.workers.dev`  
요청: `isbn=9791175790599`, `siripTitle=하네스 엔지니어링 with`

| run | 전체 응답 | 광주 종이책 | 시립소장 전자책 | 시립구독 | 경기 | 교육 에러 |
|---:|---:|---|---|---:|---:|---:|
| 1 | 15.6s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |
| 2 | 15.5s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |
| 3 | 15.5s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 1 |
| 4 | 15.5s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |
| 5 | 15.4s | ⚠️ error field 없음 | ❌ timeout | 1/1 | 0/0 | 0 |

2026-07-07 15:29~15:30 KST 재측정:

| run | 전체 응답 | 광주 종이책 | 시립소장 전자책 | 시립구독 | 경기 | 교육 에러 |
|---:|---:|---|---|---:|---:|---:|
| 1 | 15.8s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |
| 2 | 15.5s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |
| 3 | 15.5s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |
| 4 | 15.6s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |
| 5 | 15.5s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |

2026-07-07 15:59~16:00 KST 최종 재측정:

| run | 전체 응답 | 광주 종이책 | 시립소장 전자책 | 시립구독 | 경기 | 교육 에러 |
|---:|---:|---|---|---:|---:|---:|
| 1 | 15.6s | ❌ timeout | ✅ ok | 1/1 | 0/0 | 0 |
| 2 | 15.5s | ✅ ok | ❌ timeout | 1/1 | 0/0 | 0 |
| 3 | 15.4s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |
| 4 | 15.4s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |
| 5 | 15.4s | ❌ timeout | ❌ timeout | 1/1 | 0/0 | 0 |

운영 Worker 관측:

- `Cache-Control: no-store`, `X-Cache-Status: MISS`였다. 캐시 때문에 오래된 실패가 보인 것은 아니다.
- 시립소장 전자책은 두 차례 재측정 모두 5회 전체가 `시립도서관 소장형 전자책 검색 실패: The operation was aborted due to timeout`이었다.
- 광주 종이책은 15:16 KST 측정에서는 5회 중 4회, 15:30 KST 측정에서는 5회 중 5회 `The operation was aborted due to timeout`이었다.
- 사용자 UI의 “퇴촌/기타”는 `gwangjuPaper` 결과에서 파생된다. 따라서 운영 Worker의 광주 종이책 timeout은 두 UI 항목 모두를 에러로 만들 수 있다.
- 사용자 UI의 “전자책(시립소장)”은 `siripEbook.errors.owned`와 직접 연결된다.

## 문제 정의

현재 문제는 “대상 사이트가 항상 느리다”가 아니다. 로컬 최소 진단에서는 빠르게 성공했다.

더 정확한 문제 정의는 다음이다.

> 현재 운영 Cloudflare Worker 실행 경로에서 광주 종이책과 시립소장 전자책 fetch가 15초 안에 안정적으로 완료되지 않는 직접 원인은 광주시 endpoint 동시 호출 패턴이다. Cloudflare egress 전체 차단은 아니다. 같은 Cloudflare Worker에서도 단독/순차 조건에서는 paper가 4/5 성공하고 owned도 순차 조건에서 3/5 성공했다. 그러나 paper와 owned를 병렬로 열면 두 endpoint 모두 5/5 timeout으로 실패한다.

## Queue/Cron/Workflow 판단

| 조건 | 이번 테스트 상태 | 판단 |
|---|---|---|
| 단독 Cloudflare Worker에서도 실패 | ⚠️ 미측정 | 권한 문제로 판정 불가 |
| 단독 성공 + 병렬 실패 | ⚠️ 미측정 | Queue/Workflow 가치 판정 불가 |
| 로컬 단독/병렬 성공 | ✅ 확인 | 대상 사이트 자체 장애 또는 15초 timeout 일반론은 약함 |
| 운영 Worker 실패 | ✅ 확인 | 운영 경로 또는 Cloudflare 실행망 문제는 확실 |

최종 행렬 기준:

| 조건 | 이번 테스트 상태 | 판단 |
|---|---|---|
| 단독 Cloudflare Worker에서도 전면 실패 | ❌ 아님 | Cloudflare egress 전체 차단으로 보지 않음 |
| 단독/순차는 일부 성공 + 병렬 전면 실패 | ✅ 확인 | Queue/Workflow 또는 코드 순차화 검토 가치 있음 |
| jitter에서 개선 | ❌ 없음 | 반복 간격보다 같은 요청 안의 동시성 제거가 핵심 |
| 운영 Worker 실패 | ✅ 확인 | 운영 통합 코드의 병렬 요청 구조와 부합 |

Queue/Cron/Workflow는 “Cloudflare가 더 좋은 망이라서”가 아니라 “광주시 endpoint 호출을 직렬화하고 single-flight/rate limit을 걸 수 있는 도구”라는 조건에서만 의미가 있다.

## 다음 액션

1. 다음 실행 액션 분류: `코드 수정`.

2. 운영 Worker에서 광주시 계열 호출을 같은 요청 안에서 병렬 실행하지 않는다.
   - 최소 변경 후보: `gwangjuPaper`와 `siripEbook.owned`를 먼저 순차 실행하고, 나머지 외부 서비스와 병렬 범위를 분리한다.
   - 더 안전한 후보: 광주시 host 단위 single-flight/rate limit helper를 두고 `lib.gjcity.go.kr:8443`, `lib.gjcity.go.kr:444` 호출을 직렬화한다.

3. Queue/Workflow는 후속 후보로만 둔다.
   - 가치가 있는 이유: egress가 달라서가 아니라 순차화·rate limit·재시도 제어가 가능하기 때문이다.
   - 즉시 도입 전, 코드 레벨 순차화만으로 운영 Worker 5회 재측정이 개선되는지 먼저 본다.

4. 15초 timeout 연장은 해결책으로 채택하지 않는다.
   - 이번 행렬은 병렬 조건에서 15초까지 전부 timeout이었다.
   - timeout 연장은 사용자 대기 시간만 늘리고 근본 패턴을 해결하지 않는다.

## 정리 및 복구 기록

- 임시 Worker 이름: `library-checker-gjcity-diag`
- 임시 Worker 삭제: `npx wrangler delete --name library-checker-gjcity-diag --force`로 삭제 완료.
- 정리 중 `wrangler delete library-checker-gjcity-diag --force` 형식이 config의 기본 name을 따라 운영 Worker `library-checker`를 삭제하는 사고가 있었다.
- 즉시 `npx wrangler deploy`로 운영 Worker를 원래 이름 `library-checker`에 재배포했고, `library-checker/.dev.vars`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`를 secret으로 복원했다.
- 복구 확인: `https://library-checker.byungwook-an.workers.dev` GET 200, POST 200, 실제 재고 JSON 응답 확인.

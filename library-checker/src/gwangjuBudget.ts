import type { SiripEbookOwnedResult } from './types';

export const GWANGJU_GROUP_BUDGET_MS = 15000;
export const GWANGJU_ENDPOINT_TIMEOUT_MS = 10000;
export const MIN_GWANGJU_OWNED_ATTEMPT_MS = 1000;
export const SIRIP_OWNED_SKIPPED_BY_BUDGET_MESSAGE = '총 예산 부족으로 시립소장 전자책 조회 생략';

export function getRemainingBudgetMs(
  startedAtMs: number,
  nowMs = Date.now(),
  budgetMs = GWANGJU_GROUP_BUDGET_MS
): number {
  return Math.max(0, budgetMs - (nowMs - startedAtMs));
}

export function getEndpointTimeoutMs(
  remainingBudgetMs: number,
  endpointTimeoutMs = GWANGJU_ENDPOINT_TIMEOUT_MS
): number {
  return Math.min(endpointTimeoutMs, Math.max(0, remainingBudgetMs));
}

export function shouldAttemptOwnedLookup(
  remainingBudgetMs: number,
  minAttemptMs = MIN_GWANGJU_OWNED_ATTEMPT_MS
): boolean {
  return remainingBudgetMs >= minAttemptMs;
}

export function createSiripOwnedSkippedResult(searchTitle: string): SiripEbookOwnedResult {
  return {
    libraryName: '시립도서관 소장형 전자책',
    totalCount: 0,
    availableCount: 0,
    unavailableCount: 0,
    bookList: [],
    error: `${SIRIP_OWNED_SKIPPED_BY_BUDGET_MESSAGE}: ${searchTitle}`
  };
}

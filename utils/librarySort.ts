// utils/librarySort.ts
//
// 서재 목록 정렬 비교자의 정본이다.
// MyLibrary(로그인)와 DemoLibrary(비로그인 예시)가 같은 함수를 쓴다.
//
// MyLibrary.tsx의 인라인 비교자를 그대로 옮긴 것이며 규칙을 바꾸지 않았다.
// 정렬 키를 추가하거나 순서를 바꾸려면 이 파일만 고친다.

import { ReadStatus, SelectedBook, SortKey } from '../types';

const READ_STATUS_ORDER: Record<ReadStatus, number> = { '완독': 0, '읽는 중': 1, '읽지 않음': 2 };

export interface LibrarySortConfig {
  key: SortKey | null;
  order: 'asc' | 'desc';
}

export function createSortComparator(
  sortConfig: LibrarySortConfig
): (a: SelectedBook, b: SelectedBook) => number {
  return (a, b) => {
    if (!sortConfig.key) return 0;

    let aVal: unknown = a[sortConfig.key as keyof SelectedBook];
    let bVal: unknown = b[sortConfig.key as keyof SelectedBook];

    // Handle pubDate for sorting
    if (sortConfig.key === 'pubDate') {
      aVal = new Date(a.pubDate).getTime();
      bVal = new Date(b.pubDate).getTime();
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortConfig.order === 'asc' ? aVal - bVal : bVal - aVal;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      if (sortConfig.key === 'readStatus') {
        const comparison = READ_STATUS_ORDER[a.readStatus] - READ_STATUS_ORDER[b.readStatus];
        return sortConfig.order === 'asc' ? comparison : -comparison;
      }
      const comparison = aVal.localeCompare(bVal, 'ko-KR');
      return sortConfig.order === 'asc' ? comparison : -comparison;
    }

    return 0;
  };
}

export default createSortComparator;

// 종이책·전자책 버튼 링크와 알라딘 전자책 링크 저장 규칙 (한 곳에서 계산한다).
// 카카오 전환 계획: _docs/20261111_02_카카오검색전환-알라딘전자책링크_수행계획_실행완료.md
// node --test가 이 파일을 바로 import하므로 상대 경로에 .ts 확장자를 붙인다.
import {
  aladinEbookSearchUrl,
  aladinIsbnSearchUrl,
  aladinPaperUrl,
  type EbookLookupResult,
} from '../lib/aladinEbook.ts';

type StoreItem = {
  itemId: number;
  isbn: string;
  isbn13: string;
  priceSales: number;
  link: string;
};

type EbookLookup = { status: 'found' | 'none' | 'failed'; checkedAt: number };

export type LinkableBook = {
  title: string;
  isbn13: string;
  link?: string | null;
  mallType?: string;
  subInfo?: {
    ebookList?: StoreItem[];
    paperBookList?: StoreItem[];
    ebookLookup?: EbookLookup;
    [key: string]: unknown;
  } | null;
};

export const EBOOK_LOOKUP_RETRY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 버튼 링크. 위에서부터 먼저 걸리는 규칙:
 * 1. 예전 알라딘 전자책 검색으로 추가한 책(mallType EBOOK): 기존 규칙 그대로
 * 2. 종이책 = book.link
 * 3. 저장된 전자책 링크가 있으면 그 링크
 * 4. 알라딘 API 시절 저장(링크에 ItemId=)이고 전자책 링크가 없으면 버튼 없음(새로고침 뒤 없음·실패여도 유지)
 * 5. 그 밖(새 책의 없음·실패·조회 전, 검색 결과)은 알라딘 전자책 검색 결과
 */
export function getStoreLinks(book: LinkableBook | null | undefined): { paperLink: string | null; ebookLink: string | null } {
  if (!book) return { paperLink: null, ebookLink: null };
  const sub = book.subInfo || {};

  if (book.mallType === 'EBOOK') {
    return { paperLink: sub.paperBookList?.[0]?.link || null, ebookLink: book.link || null };
  }

  const paperLink = book.link || null;
  const storedEbook = sub.ebookList?.[0]?.link;
  if (storedEbook) return { paperLink, ebookLink: storedEbook };

  // 알라딘 API 시절 저장한 책은 종이책 링크가 ItemId= 형태다(카카오로 추가한 책은 ISBN= 또는 검색 주소).
  // 조회 기록과 무관하게 판정한다 — 새로고침에서 전자책을 못 찾아도 예전처럼 버튼을 숨긴다.
  const isAladinApiEra = !!book.link && book.link.includes('ItemId=');
  if (isAladinApiEra) return { paperLink, ebookLink: null };

  return { paperLink, ebookLink: aladinEbookSearchUrl(book.title) };
}

/** 전자책 링크가 검색 결과 주소인지(버튼 설명 문구용). */
export function isEbookSearchLink(link: string | null): boolean {
  return !!link && link.includes('/search/wsearchresult.aspx');
}

export function shouldLookupEbook(book: LinkableBook, now: number = Date.now()): boolean {
  if (book.mallType === 'EBOOK') return false;
  const sub = book.subInfo || {};
  if (sub.ebookList && sub.ebookList.length > 0) return false;
  const lookup = sub.ebookLookup;
  if (!lookup) return true;
  if (lookup.status === 'failed') return true;
  return now - lookup.checkedAt > EBOOK_LOOKUP_RETRY_MS;
}

/** 조회 결과를 책 데이터에 반영한 새 객체를 돌려준다(원본은 바꾸지 않는다). */
export function applyEbookLookup<T extends LinkableBook>(book: T, result: EbookLookupResult, now: number = Date.now()): T {
  const sub = { ...(book.subInfo || {}) };
  let link = book.link;

  if (result.status === 'found') {
    sub.ebookList = [{ itemId: result.itemId, isbn: '', isbn13: '', priceSales: 0, link: result.link }];
    sub.ebookLookup = { status: 'found', checkedAt: now };
  } else if (result.status === 'none') {
    sub.ebookLookup = { status: 'none', checkedAt: now };
    // 알라딘 미등록 책: 카카오로 새로 추가해 생성한 ISBN 상품 링크일 때만 ISBN 검색으로 바꾼다.
    if (result.paperFound === false && book.link === aladinPaperUrl(book.isbn13)) {
      link = aladinIsbnSearchUrl(book.isbn13);
    }
  } else {
    sub.ebookLookup = { status: 'failed', checkedAt: now };
  }

  return { ...book, link, subInfo: sub };
}

/** 브라우저에서 서버 함수로 전자책 링크를 조회한다. 실패해도 throw하지 않는다. */
export async function fetchEbookLookup(isbn13: string): Promise<EbookLookupResult> {
  try {
    const res = await fetch(`/api/aladin-ebook?isbn=${encodeURIComponent(isbn13)}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data.status !== 'string') {
      return { status: 'failed', reason: `http-${res.status}` };
    }
    return data as EbookLookupResult;
  } catch (err) {
    return { status: 'failed', reason: err instanceof Error ? err.message : 'network' };
  }
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  applyEbookLookup,
  EBOOK_LOOKUP_RETRY_MS,
  getStoreLinks,
  isEbookSearchLink,
  shouldLookupEbook,
} from '../utils/ebookLink.ts';
import { aladinEbookSearchUrl, aladinIsbnSearchUrl, aladinPaperUrl } from '../lib/aladinEbook.ts';
import { ApiCombinedBookDataSchema } from '../types.ts';

const NOW = 1_800_000_000_000;
const ebookItem = { itemId: 18094736, isbn: '', isbn13: '', priceSales: 0, link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=18094736' };

const kakaoBook = (over = {}) => ({
  title: '데미안',
  author: '헤르만 헤세',
  pubDate: '2009-01-20',
  description: '',
  isbn13: '9788937460449',
  cover: 'https://t1.daumcdn.net/lbook/image/540810',
  priceStandard: 8000,
  priceSales: 7200,
  publisher: '민음사',
  link: aladinPaperUrl('9788937460449'),
  subInfo: {},
  mallType: 'BOOK',
  ...over,
});

const aladinEraBook = (over = {}) => kakaoBook({
  link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=260084&partner=openAPI&start=api',
  ...over,
});

// --- getStoreLinks: rules 1~5 ---

test('rule 1: legacy Aladin ebook item keeps paper/ebook swap', () => {
  const book = kakaoBook({
    mallType: 'EBOOK',
    link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=999',
    subInfo: { paperBookList: [{ ...ebookItem, link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=111' }] },
  });
  assert.deepEqual(getStoreLinks(book), {
    paperLink: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=111',
    ebookLink: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=999',
  });
});

test('rules 2+3: stored ebook link is used (new or Aladin-era)', () => {
  assert.equal(getStoreLinks(kakaoBook({ subInfo: { ebookList: [ebookItem] } })).ebookLink, ebookItem.link);
  assert.equal(getStoreLinks(aladinEraBook({ subInfo: { ebookList: [ebookItem] } })).ebookLink, ebookItem.link);
  assert.equal(getStoreLinks(kakaoBook()).paperLink, aladinPaperUrl('9788937460449'));
});

test('rule 4: Aladin-era book without ebook keeps the button hidden, also after a none/failed refresh', () => {
  assert.equal(getStoreLinks(aladinEraBook()).ebookLink, null);
  const afterNone = applyEbookLookup(aladinEraBook(), { status: 'none', paperFound: true }, NOW);
  const afterFailed = applyEbookLookup(aladinEraBook(), { status: 'failed', reason: 'timeout' }, NOW);
  assert.equal(getStoreLinks(afterNone).ebookLink, null);
  assert.equal(getStoreLinks(afterFailed).ebookLink, null);
  // 새로고침에서 전자책을 찾으면 버튼이 생긴다
  const afterFound = applyEbookLookup(aladinEraBook(), { status: 'found', itemId: 18094736, link: ebookItem.link, paperFound: true }, NOW);
  assert.equal(getStoreLinks(afterFound).ebookLink, ebookItem.link);
});

test('rule 5: new book none / failed / not yet looked up / search result → ebook search', () => {
  const search = aladinEbookSearchUrl('데미안');
  assert.equal(getStoreLinks(kakaoBook()).ebookLink, search);
  assert.equal(getStoreLinks(kakaoBook({ subInfo: { ebookLookup: { status: 'none', checkedAt: NOW } } })).ebookLink, search);
  assert.equal(getStoreLinks(kakaoBook({ subInfo: { ebookLookup: { status: 'failed', checkedAt: NOW } } })).ebookLink, search);
  assert.equal(isEbookSearchLink(search), true);
  assert.equal(isEbookSearchLink(ebookItem.link), false);
});

test('null book yields no links', () => {
  assert.deepEqual(getStoreLinks(null), { paperLink: null, ebookLink: null });
});

// --- shouldLookupEbook ---

test('lookup only when no ebook link and not checked recently', () => {
  assert.equal(shouldLookupEbook(kakaoBook(), NOW), true);
  assert.equal(shouldLookupEbook(kakaoBook({ subInfo: { ebookList: [ebookItem] } }), NOW), false);
  assert.equal(shouldLookupEbook(kakaoBook({ mallType: 'EBOOK' }), NOW), false);
  assert.equal(shouldLookupEbook(kakaoBook({ subInfo: { ebookLookup: { status: 'none', checkedAt: NOW - 1000 } } }), NOW), false);
  assert.equal(shouldLookupEbook(kakaoBook({ subInfo: { ebookLookup: { status: 'none', checkedAt: NOW - EBOOK_LOOKUP_RETRY_MS - 1 } } }), NOW), true);
  assert.equal(shouldLookupEbook(kakaoBook({ subInfo: { ebookLookup: { status: 'failed', checkedAt: NOW } } }), NOW), true);
});

// --- applyEbookLookup ---

test('found stores the ebook link and keeps other subInfo keys', () => {
  const paperBookList = [{ ...ebookItem, itemId: 1 }];
  const out = applyEbookLookup(kakaoBook({ subInfo: { paperBookList } }), { status: 'found', itemId: 18094736, link: ebookItem.link, paperFound: true }, NOW);
  assert.deepEqual(out.subInfo.ebookList, [ebookItem]);
  assert.deepEqual(out.subInfo.ebookLookup, { status: 'found', checkedAt: NOW });
  assert.deepEqual(out.subInfo.paperBookList, paperBookList);
  assert.equal(getStoreLinks(out).ebookLink, ebookItem.link);
});

test('none records the check; unknown-at-Aladin new book gets an ISBN search link', () => {
  const none = applyEbookLookup(kakaoBook(), { status: 'none', paperFound: true }, NOW);
  assert.deepEqual(none.subInfo.ebookLookup, { status: 'none', checkedAt: NOW });
  assert.equal(none.link, aladinPaperUrl('9788937460449'));

  const notFound = applyEbookLookup(kakaoBook(), { status: 'none', paperFound: false }, NOW);
  assert.equal(notFound.link, aladinIsbnSearchUrl('9788937460449'));
});

test('none never rewrites an Aladin-era link', () => {
  const book = aladinEraBook();
  const out = applyEbookLookup(book, { status: 'none', paperFound: false }, NOW);
  assert.equal(out.link, book.link);
});

test('failed records the check and leaves links', () => {
  const book = kakaoBook();
  const out = applyEbookLookup(book, { status: 'failed', reason: 'timeout' }, NOW);
  assert.deepEqual(out.subInfo.ebookLookup, { status: 'failed', checkedAt: NOW });
  assert.equal(out.link, book.link);
  assert.deepEqual(book.subInfo, {}, 'input is not mutated');
});

// --- V-4: saved data compatibility ---

test('old and new book_data shapes parse with the stored schema', () => {
  const withEbook = ApiCombinedBookDataSchema.safeParse(aladinEraBook({ subInfo: { ebookList: [{ ...ebookItem, isbn: '893746044X', isbn13: '9791190000000', priceSales: 5040 }] } }));
  const withoutEbook = ApiCombinedBookDataSchema.safeParse(aladinEraBook());
  const newShape = ApiCombinedBookDataSchema.safeParse(applyEbookLookup(kakaoBook(), { status: 'found', itemId: 1, link: ebookItem.link, paperFound: true }, NOW));
  assert.equal(withEbook.success, true);
  assert.equal(withoutEbook.success, true);
  assert.equal(newShape.success, true);
  assert.deepEqual(newShape.data.subInfo.ebookLookup, { status: 'found', checkedAt: NOW });
});

// --- V-5: refresh keeps stored metadata; bulk refresh skips ebook lookup ---

test('refreshBookInfo no longer re-fetches catalog metadata and bulk refresh skips ebook lookup', () => {
  const src = readFileSync(new URL('../stores/useBookStore.ts', import.meta.url), 'utf8');
  const start = src.indexOf('refreshBookInfo: async');
  const end = src.indexOf('updateReadStatus: async', start);
  const refreshBody = src.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.doesNotMatch(refreshBody, /searchBookCatalog|searchAladinBooks/);
  assert.match(refreshBody, /createBookDataFromApis\(metadataSource/);
  assert.match(refreshBody, /if \(uiUpdated\) revertThisBook\(\)/);

  const bulkStart = src.indexOf('bulkRefreshAllBooks: async');
  const bulkBody = src.slice(bulkStart, src.indexOf('pauseBulkRefresh', bulkStart));
  assert.match(bulkBody, /refreshBookInfo\([^)]*\{ resolveEbook: false \}\)/);
  assert.match(src, /refreshBookInfo\(newBookWithId\.id[^)]*\{ resolveEbook: true \}\)/);
});

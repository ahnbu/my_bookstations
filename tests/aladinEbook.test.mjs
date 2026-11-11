import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  aladinEbookSearchUrl,
  aladinIsbnSearchUrl,
  aladinPaperUrl,
  isValidIsbn13,
  parseAladinPaperPage,
} from '../lib/aladinEbook.ts';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('paper page with an ebook tab yields the ebook product link', () => {
  const parsed = parseAladinPaperPage(fixture('aladin-paper-with-ebook.html'));
  assert.equal(parsed.paperFound, true);
  assert.deepEqual(parsed.ebook, {
    itemId: 18094736,
    link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=18094736',
  });
});

test('paper page without an ebook tab yields no ebook', () => {
  const parsed = parseAladinPaperPage(fixture('aladin-paper-no-ebook.html'));
  assert.equal(parsed.paperFound, true);
  assert.equal(parsed.ebook, null);
});

test('unknown ISBN page (title "알라딘") is not a product page and ignores 전자책 menu links', () => {
  const parsed = parseAladinPaperPage(fixture('aladin-paper-not-found.html'));
  assert.equal(parsed.paperFound, false);
  assert.equal(parsed.ebook, null);
});

test('empty html is handled', () => {
  assert.deepEqual(parseAladinPaperPage(''), { paperFound: false, ebook: null });
});

test('aladin url helpers', () => {
  assert.equal(aladinPaperUrl('9788937460449'), 'https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=9788937460449');
  assert.equal(aladinIsbnSearchUrl('9791191891287'), 'https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=9791191891287');
  const url = aladinEbookSearchUrl('사피엔스 - 유인원에서 사이보그까지, 인간 역사의 대담하고 위대한 질문');
  assert.ok(url.startsWith('https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=eBook&SearchWord='));
  assert.equal(decodeURIComponent(url.split('SearchWord=')[1]), '사피엔스');
  assert.equal(decodeURIComponent(aladinEbookSearchUrl('[큰글자도서] 데미안 (양장)').split('SearchWord=')[1]), '데미안');
});

test('isbn13 validation', () => {
  assert.equal(isValidIsbn13('9788937460449'), true);
  assert.equal(isValidIsbn13('abc'), false);
  assert.equal(isValidIsbn13('978893746044'), false);
});

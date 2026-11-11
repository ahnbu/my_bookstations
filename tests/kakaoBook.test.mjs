import assert from 'node:assert/strict';
import test from 'node:test';

import { isbn10to13, kakaoCoverUrl, kakaoDocToAladdinItem, pickIsbn13, toKakaoTarget } from '../lib/kakaoBook.ts';
import { aladinPaperUrl } from '../lib/aladinEbook.ts';
import { AladdinBookItemSchema } from '../types.ts';

const sampleDoc = {
  title: '사피엔스',
  contents: '인류 역사를 다룬 책',
  url: 'https://search.daum.net/search?w=bookpage&bookId=521598',
  isbn: '8934972467 9788934972464',
  datetime: '2015-11-23T00:00:00.000+09:00',
  authors: ['유발 하라리'],
  publisher: '김영사',
  price: 26800,
  sale_price: 24120,
  thumbnail: 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F521598%3Ftimestamp%3D20260113110825',
  status: '정상판매',
};

test('kakao doc converts to the stored Aladin-shaped item with an Aladin ISBN link', () => {
  const item = kakaoDocToAladdinItem(sampleDoc);
  assert.deepEqual(item, {
    title: '사피엔스',
    author: '유발 하라리',
    pubDate: '2015-11-23',
    description: '인류 역사를 다룬 책',
    isbn13: '9788934972464',
    cover: 'https://t1.daumcdn.net/lbook/image/521598?timestamp=20260113110825',
    priceStandard: 26800,
    priceSales: 24120,
    publisher: '김영사',
    link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=9788934972464',
    subInfo: {},
    mallType: 'BOOK',
  });
  assert.equal(item.link, aladinPaperUrl(item.isbn13), 'kakaoBook link must match aladinPaperUrl');
  assert.equal(AladdinBookItemSchema.safeParse(item).success, true, 'converted item passes the client schema');
});

test('prices are always numbers (detail modal calls toLocaleString)', () => {
  const item = kakaoDocToAladdinItem({ ...sampleDoc, price: undefined, sale_price: -1 });
  assert.equal(item.priceStandard, 0);
  assert.equal(item.priceSales, 0);
  const onlyList = kakaoDocToAladdinItem({ ...sampleDoc, sale_price: -1 });
  assert.equal(onlyList.priceSales, 26800);
});

test('isbn selection: 13 digits first, 10 digits converted, none skipped', () => {
  assert.equal(pickIsbn13('8934972467 9788934972464'), '9788934972464');
  assert.equal(pickIsbn13(' 9788934972464'), '9788934972464');
  assert.equal(pickIsbn13('8934972467'), '9788934972464');
  assert.equal(isbn10to13('8937460440'), '9788937460449');
  assert.equal(isbn10to13('12345'), null);
  assert.equal(pickIsbn13(''), null);
  assert.equal(kakaoDocToAladdinItem({ ...sampleDoc, isbn: '' }), null);
});

test('cover falls back to the thumbnail, then empty', () => {
  assert.equal(kakaoCoverUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg');
  assert.equal(kakaoCoverUrl(''), '');
  assert.equal(kakaoCoverUrl(undefined), '');
});

test('search type mapping', () => {
  assert.equal(toKakaoTarget('Keyword'), null);
  assert.equal(toKakaoTarget('Title'), 'title');
  assert.equal(toKakaoTarget('Author'), 'person');
  assert.equal(toKakaoTarget('Publisher'), 'publisher');
  assert.equal(toKakaoTarget('ISBN'), 'isbn');
  assert.equal(toKakaoTarget('eBook'), null);
});

// 데모 서재 스냅샷의 데이터 계약과 읽기 전용 설계 계약을 검증한다.
// 구현 세부(조건문 형태, 변수명, 포매팅)는 단언 대상으로 삼지 않는다.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const demo = JSON.parse(readFileSync(`${REPO_ROOT}data/demoLibrary.json`, 'utf8'));

const STOCK_TOTAL_COLUMNS = [
  'stock_gwangju_toechon_total',
  'stock_gwangju_other_total',
  'stock_sirip_subs_total',
  'stock_sirip_owned_total',
  'stock_gyeonggi_total',
  'stock_gyeonggi_edu_total',
];

const FORBIDDEN_KEYS = ['note', 'user_id', 'email', 'created_at'];

const badgeCount = book =>
  STOCK_TOTAL_COLUMNS.filter(column => (book[column] ?? 0) > 0).length;

test('데모 스냅샷은 도서 20권을 담고 id가 -1 ~ -20의 서로 다른 음수다', () => {
  assert.equal(demo.books.length, 20);

  const ids = demo.books.map(book => book.id);
  assert.equal(new Set(ids).size, 20, 'id가 중복된다');
  for (const id of ids) {
    assert.ok(Number.isInteger(id) && id <= -1 && id >= -20, `범위를 벗어난 id: ${id}`);
  }
});

test('모든 도서에 화면 렌더에 필요한 서지 필드가 있다', () => {
  for (const book of demo.books) {
    for (const field of ['title', 'author', 'publisher', 'pubDate', 'cover', 'isbn13']) {
      assert.equal(typeof book[field], 'string', `${book.id}의 ${field}가 문자열이 아니다`);
      assert.ok(book[field].length > 0, `${book.id}의 ${field}가 비어 있다`);
    }
    // pubDate는 카드에서 substring(0, 7)로 잘라 쓰므로 최소 YYYY-MM 형태여야 한다
    assert.match(book.pubDate, /^\d{4}-\d{2}/, `${book.id}의 pubDate 형식이 다르다`);
  }
});

test('재고 배지 개수 분포가 목표와 일치한다 (0개 3 / 1개 5 / 2~3개 6 / 4~5개 4 / 6개 2)', () => {
  const counts = demo.books.map(badgeCount);

  const zero = counts.filter(n => n === 0).length;
  const one = counts.filter(n => n === 1).length;
  const twoThree = counts.filter(n => n === 2 || n === 3).length;
  const fourFive = counts.filter(n => n === 4 || n === 5).length;
  const six = counts.filter(n => n === 6).length;

  assert.equal(zero, 3, `배지 0개 도서가 ${zero}권이다`);
  assert.equal(one, 5, `배지 1개 도서가 ${one}권이다`);
  assert.equal(twoThree, 6, `배지 2~3개 도서가 ${twoThree}권이다`);
  assert.equal(fourFive, 4, `배지 4~5개 도서가 ${fourFive}권이다`);
  assert.equal(six, 2, `배지 6개 도서가 ${six}권이다`);
});

test('6개 재고 배지 각각에 대해 total > 0인 도서가 최소 1권 있다', () => {
  for (const column of STOCK_TOTAL_COLUMNS) {
    const count = demo.books.filter(book => (book[column] ?? 0) > 0).length;
    assert.ok(count >= 1, `${column}이(가) 0보다 큰 도서가 없다`);
  }
});

test('대출중(total > 0, available = 0) 상태인 도서가 3권 이상 있다', () => {
  const loanedBooks = demo.books.filter(book =>
    STOCK_TOTAL_COLUMNS.some(totalColumn => {
      const availableColumn = totalColumn.replace(/_total$/, '_available');
      return (book[totalColumn] ?? 0) > 0 && (book[availableColumn] ?? 0) === 0;
    })
  );

  assert.ok(loanedBooks.length >= 3, `대출중 도서가 ${loanedBooks.length}권뿐이다`);
});

test('재고 available은 total을 넘지 않는다', () => {
  for (const book of demo.books) {
    for (const totalColumn of STOCK_TOTAL_COLUMNS) {
      const availableColumn = totalColumn.replace(/_total$/, '_available');
      const total = book[totalColumn] ?? 0;
      const available = book[availableColumn] ?? 0;
      assert.ok(available <= total, `${book.id}의 ${availableColumn}이 ${totalColumn}보다 크다`);
    }
  }
});

test('읽음상태 3종이 모두 존재하고 별점·좋아요가 고르게 분포한다', () => {
  const statuses = new Set(demo.books.map(book => book.readStatus));
  for (const status of ['완독', '읽는 중', '읽지 않음']) {
    assert.ok(statuses.has(status), `읽음상태 '${status}'인 도서가 없다`);
  }

  const zeroRating = demo.books.filter(book => book.rating === 0).length;
  assert.ok(zeroRating >= 5, `별점 0점 도서가 ${zeroRating}권뿐이다`);

  const favorites = demo.books.filter(book => book.isFavorite === true).length;
  assert.ok(favorites >= 4 && favorites <= 6, `좋아요 도서가 ${favorites}권이다`);
});

test('데모 태그 6종이 정의되고 모든 도서가 정의된 태그를 1개 이상 갖는다', () => {
  assert.equal(demo.tags.length, 6);

  const definedTagIds = new Set(demo.tags.map(tag => tag.id));
  const usedTagIds = new Set();

  for (const book of demo.books) {
    const tagIds = book.customTags ?? [];
    assert.ok(tagIds.length >= 1, `${book.id}에 태그가 없다`);
    for (const tagId of tagIds) {
      assert.ok(definedTagIds.has(tagId), `${book.id}의 태그 ${tagId} 정의가 없다`);
      usedTagIds.add(tagId);
    }
  }

  for (const tagId of definedTagIds) {
    assert.ok(usedTagIds.has(tagId), `태그 ${tagId}를 가진 도서가 없다`);
  }
});

test('스냅샷에 개인정보 필드가 없다', () => {
  for (const book of demo.books) {
    for (const key of FORBIDDEN_KEYS) {
      assert.ok(!(key in book), `${book.id}에 ${key}가 남아 있다`);
    }
  }
});

test('스냅샷 기준일이 YYYY-MM-DD 형식이다', () => {
  assert.match(demo.snapshotDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('데모가 재사용하는 컴포넌트는 스토어를 직접 호출하지 않는다 (읽기 전용의 전제)', () => {
  for (const file of ['components/MyLibraryListItem.tsx', 'components/MyLibraryToolbar.tsx']) {
    const source = readFileSync(`${REPO_ROOT}${file}`, 'utf8');
    assert.ok(!source.includes('useBookStore'), `${file}이 useBookStore를 직접 참조한다`);
    assert.ok(!source.includes('useUIStore'), `${file}이 useUIStore를 직접 참조한다`);
  }
});

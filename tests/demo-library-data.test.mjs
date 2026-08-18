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

test('데모 스냅샷은 도서 10권을 담고 id가 서로 다른 음수다', () => {
  assert.equal(demo.books.length, 10);

  const ids = demo.books.map(book => book.id);
  assert.equal(new Set(ids).size, 10, 'id가 중복된다');
  for (const id of ids) {
    assert.ok(Number.isInteger(id) && id < 0, `실제 user_library.id와 충돌할 수 있는 id: ${id}`);
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

test('6개 재고 배지 각각에 대해 total > 0인 도서가 최소 1권 있다', () => {
  for (const column of STOCK_TOTAL_COLUMNS) {
    const count = demo.books.filter(book => (book[column] ?? 0) > 0).length;
    assert.ok(count >= 1, `${column}이(가) 0보다 큰 도서가 없다`);
  }
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

test('스냅샷에 개인정보 필드가 없다', () => {
  for (const book of demo.books) {
    for (const key of FORBIDDEN_KEYS) {
      assert.ok(!(key in book), `${book.id}에 ${key}가 남아 있다`);
    }
  }
});

test('데모 태그 정의가 도서의 customTags를 모두 커버한다', () => {
  const definedTagIds = new Set(demo.tags.map(tag => tag.id));
  for (const book of demo.books) {
    for (const tagId of book.customTags ?? []) {
      assert.ok(definedTagIds.has(tagId), `${book.id}의 태그 ${tagId} 정의가 없다`);
    }
  }
});

test('스냅샷 기준일이 YYYY-MM-DD 형식이다', () => {
  assert.match(demo.snapshotDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('MyLibraryListItem은 스토어를 직접 호출하지 않는다 (데모 읽기 전용의 전제)', () => {
  const source = readFileSync(`${REPO_ROOT}components/MyLibraryListItem.tsx`, 'utf8');

  assert.ok(!source.includes('useBookStore'), 'useBookStore를 직접 참조하면 데모 콜백이 실 데이터에 닿을 수 있다');
  assert.ok(!source.includes('useUIStore'), 'useUIStore를 직접 참조하면 데모 콜백이 실 데이터에 닿을 수 있다');
});

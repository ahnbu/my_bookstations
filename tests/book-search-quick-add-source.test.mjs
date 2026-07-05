import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const storeSource = readFileSync(new URL('../stores/useBookStore.ts', import.meta.url), 'utf8');
const modalSource = readFileSync(new URL('../components/BookSearchListModal.tsx', import.meta.url), 'utf8');
const bulkSource = readFileSync(new URL('../components/BulkBookSearchContent.tsx', import.meta.url), 'utf8');

test('book store exposes direct addToLibrary(book) without breaking existing calls', () => {
  assert.match(
    storeSource,
    /addToLibrary:\s*\(bookToAdd\?:\s*AladdinBookItem\s*\|\s*SelectedBook\)\s*=>\s*Promise<SelectedBook\s*\|\s*null>/,
  );
  assert.match(storeSource, /const targetBook = bookToAdd \?\? selectedBook;/);
  assert.match(storeSource, /if \(!bookToAdd\) \{\s*set\(\{ selectedBook: null \}\);\s*\}/s);
  assert.match(storeSource, /return newBookWithId;/);
  assert.match(storeSource, /return null;/);
});

test('book search modal separates card detail click from transparent cover quick-add button', () => {
  assert.match(modalSource, /import \{ CloseIcon, PlusIcon, CheckIcon \} from '\.\/Icons';/);
  assert.match(modalSource, /import \{ useAuthStore \} from '\.\.\/stores\/useAuthStore';/);
  assert.match(modalSource, /const \{ session \} = useAuthStore\(\);/);
  assert.match(modalSource, /handleQuickAddClick/);
  assert.match(modalSource, /event\.stopPropagation\(\);/);
  assert.match(modalSource, /await addToLibrary\(\{ \.\.\.book, isbn13: normalizedIsbn \}\);/);
  assert.match(modalSource, /w-11 h-11/);
  assert.match(modalSource, /<CheckIcon className="w-5 h-5 drop-shadow-md" \/>/);
  assert.match(modalSource, /<PlusIcon className="w-5 h-5 drop-shadow-md" \/>/);
  assert.doesNotMatch(modalSource, /bg-yellow-500 text-black text-xs px-2 py-1 rounded-full/);
});

test('bulk add no longer changes selectedBook temporarily', () => {
  assert.match(bulkSource, /const addedBook = await addToLibrary\(searchResult\.selectedBook\);/);
  assert.match(bulkSource, /let skippedCount = 0;/);
  assert.match(bulkSource, /skippedCount\+\+;/);
  assert.doesNotMatch(bulkSource, /selectBook\(searchResult\.selectedBook/);
  assert.doesNotMatch(bulkSource, /임시로 selectedBook/);
});

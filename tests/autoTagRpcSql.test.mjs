import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/20260705_auto_tags_rpc.sql', 'utf8');

const countFunction = sql.match(
  /create or replace function public\.get_tag_counts_for_user\(\)[\s\S]*?\$\$;/i,
)?.[0];
const filterFunction = sql.match(
  /create or replace function public\.get_books_by_tags\([\s\S]*?filter_by_favorites[\s\S]*?\$\$;/i,
)?.[0];

assert.ok(countFunction, 'get_tag_counts_for_user() definition must exist');
assert.ok(filterFunction, 'get_books_by_tags(text[], boolean) definition must exist');

assert.match(countFunction, /book_data->'customTags'/);
assert.match(countFunction, /book_data->'autoTags'/);
assert.match(countFunction, /select distinct ul\.id, tag_id/i);

assert.match(filterFunction, /book_data->'customTags'/);
assert.match(filterFunction, /book_data->'autoTags'/);
assert.match(filterFunction, /tags_to_filter\s*<@/i);
assert.match(filterFunction, /filter_by_favorites\s+is\s+not\s+true/i);
assert.doesNotMatch(filterFunction, /filter_by_favorites\s+boolean\s+default/i);
assert.match(filterFunction, /\bstable\b/i);
assert.match(filterFunction, /security\s+invoker/i);
assert.doesNotMatch(filterFunction, /security\s+definer/i);

console.log('auto-tag RPC SQL tests passed');

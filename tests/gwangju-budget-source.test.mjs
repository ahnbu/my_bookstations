import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('library-checker/src/index.ts', 'utf8');
const stockPayloadBody = source.match(/async function getStockUpdatePayload[\s\S]*?\n}\n\n\n\/\/ ================================================/)?.[0] ?? '';
const manualPostBody = source.match(/Request received - ISBN:[\s\S]*?const responsePayload: LibraryApiResponse/)?.[0] ?? '';

assert.match(source, /function buildSiripEbookResult\(/);
assert.match(source, /async function searchGwangjuLibrary\(isbn: string, timeoutMs = DEFAULT_TIMEOUT\)/);
assert.match(source, /async function searchSiripEbookOwned\(searchTitle: string, timeoutMs = DEFAULT_TIMEOUT\)/);
assert.match(source, /searchGwangjuLibrary\(isbn13, GWANGJU_ENDPOINT_TIMEOUT_MS\)/);
assert.match(source, /searchGwangjuLibrary\(isbn, GWANGJU_ENDPOINT_TIMEOUT_MS\)/);
assert.match(source, /searchSiripEbookIntegratedAfterGwangju\(/);
assert.doesNotMatch(stockPayloadBody, /searchSiripEbookIntegrated\(siripTitle\)/);
assert.doesNotMatch(manualPostBody, /siripEbookPromise\s*=\s*searchSiripEbookIntegrated\(siripTitle\)/);
assert.match(source, /getRemainingBudgetMs\(groupStartedAtMs\)/);
assert.match(source, /getEndpointTimeoutMs\(remainingBudgetMs\)/);
assert.match(source, /createSiripOwnedSkippedResult\(searchTitle\)/);

console.log('gwangju-budget-source.test.mjs passed');

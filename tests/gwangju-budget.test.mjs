import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync('library-checker/src/gwangjuBudget.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const encoded = Buffer.from(output, 'utf8').toString('base64');
const budget = await import(`data:text/javascript;base64,${encoded}`);

assert.equal(budget.GWANGJU_GROUP_BUDGET_MS, 15000);
assert.equal(budget.GWANGJU_ENDPOINT_TIMEOUT_MS, 10000);
assert.equal(budget.MIN_GWANGJU_OWNED_ATTEMPT_MS, 1000);

assert.equal(budget.getRemainingBudgetMs(1000, 5000), 11000);
assert.equal(budget.getRemainingBudgetMs(1000, 20000), 0);
assert.equal(budget.getEndpointTimeoutMs(14000), 10000);
assert.equal(budget.getEndpointTimeoutMs(4500), 4500);
assert.equal(budget.getEndpointTimeoutMs(0), 0);
assert.equal(budget.shouldAttemptOwnedLookup(1000), true);
assert.equal(budget.shouldAttemptOwnedLookup(999), false);

const skipped = budget.createSiripOwnedSkippedResult('테스트 도서');
assert.equal(skipped.libraryName, '시립도서관 소장형 전자책');
assert.equal(skipped.totalCount, 0);
assert.equal(skipped.availableCount, 0);
assert.deepEqual(skipped.bookList, []);
assert.match(skipped.error, /총 예산 부족/);

console.log('gwangju-budget.test.mjs passed');

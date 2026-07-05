import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const source = readFileSync('utils/autoTagRules.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const tempDir = mkdtempSync(join(tmpdir(), 'auto-tag-rules-'));
const modulePath = join(tempDir, 'autoTagRules.mjs');
writeFileSync(modulePath, output.outputText);

const {
  normalizeAutoTagRules,
  calculateAutoTagIds,
  getMergedTagIds,
  parseKeywordInput,
} = await import(pathToFileURL(modulePath).href);

const tags = [
  { id: 'tag_ai', name: 'AI', color: 'primary', createdAt: 1, updatedAt: 1 },
  { id: 'tag_ppt', name: 'PPT', color: 'secondary', createdAt: 1, updatedAt: 1 },
];

const rules = normalizeAutoTagRules(tags, undefined);
assert.equal(rules.length, 2);
assert.deepEqual(rules.map(rule => rule.keywords), [['AI'], ['PPT']]);

const emptyKeywordRules = normalizeAutoTagRules(tags, [
  { tagId: 'tag_ai', enabled: true, keywords: [], matchFields: ['title'], updatedAt: 1 },
]);
assert.deepEqual(emptyKeywordRules.find(rule => rule.tagId === 'tag_ai')?.keywords, []);

assert.deepEqual(
  calculateAutoTagIds({ title: '챗GPT와 AI 업무 자동화' }, [
    { tagId: 'tag_ai', enabled: true, keywords: ['AI', '챗GPT'], matchFields: ['title'], updatedAt: 1 },
    { tagId: 'tag_ppt', enabled: true, keywords: ['PPT'], matchFields: ['title'], updatedAt: 1 },
  ]),
  ['tag_ai'],
);

assert.deepEqual(getMergedTagIds({ customTags: ['tag_ai'], autoTags: ['tag_ai', 'tag_ppt'] }), ['tag_ai', 'tag_ppt']);
assert.deepEqual(parseKeywordInput('AI, 챗GPT, ai,  '), ['AI', '챗GPT']);

console.log('autoTagRules tests passed');

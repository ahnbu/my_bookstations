import type { AutoTagRule, CustomTag, SelectedBook } from '../types';

const normalizeText = (value: string): string =>
  value
    .toLocaleLowerCase('ko-KR')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeKeyword = (keyword: string): string => normalizeText(keyword);

const dedupeKeywords = (keywords: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  keywords.forEach(keyword => {
    const trimmed = keyword.trim();
    const normalized = normalizeKeyword(trimmed);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(trimmed);
  });

  return result;
};

export const normalizeAutoTagRules = (
  tags: CustomTag[],
  rules: AutoTagRule[] | undefined,
): AutoTagRule[] => {
  const now = Date.now();
  const tagIds = new Set(tags.map(tag => tag.id));
  const ruleMap = new Map(
    (rules ?? [])
      .filter(rule => tagIds.has(rule.tagId))
      .map(rule => [rule.tagId, rule]),
  );

  return tags.map(tag => {
    const existing = ruleMap.get(tag.id);
    if (existing) {
      const keywords = dedupeKeywords(existing.keywords);
      return {
        ...existing,
        enabled: existing.enabled,
        keywords,
        matchFields: ['title'],
      };
    }

    return {
      tagId: tag.id,
      enabled: true,
      keywords: [tag.name],
      matchFields: ['title'],
      updatedAt: now,
    };
  });
};

export const getMergedTagIds = (book: Pick<SelectedBook, 'customTags' | 'autoTags'>): string[] =>
  Array.from(new Set([...(book.customTags ?? []), ...(book.autoTags ?? [])]));

export const calculateAutoTagIds = (
  book: Pick<SelectedBook, 'title'>,
  rules: AutoTagRule[],
): string[] => {
  const normalizedTitle = normalizeText(book.title ?? '');

  return rules
    .filter(rule => rule.enabled)
    .filter(rule => rule.keywords.some(keyword => normalizedTitle.includes(normalizeKeyword(keyword))))
    .map(rule => rule.tagId);
};

export const parseKeywordInput = (value: string): string[] =>
  dedupeKeywords(value.split(','));

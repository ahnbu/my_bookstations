import { AladdinAPIResponseEnvelopeSchema, AladdinBookItemSchema, AladdinBookItem } from '../types';

// Book catalog search. Aladin OpenAPI was shut down on 2026-10-30; /api/search now
// proxies Kakao book search and returns items in the Aladin-shaped format the app stores.
// In `vite dev` the same path is served by the local API plugin in vite.config.ts.
const BOOK_SEARCH_URL = '/api/search';

export const searchBookCatalog = async (
  query: string,
  searchType: string,
  startIndex: number = 1,
  maxResults: number = 40
): Promise<AladdinBookItem[]> => {
  const params = new URLSearchParams({
    Query: query,
    QueryType: searchType,
    MaxResults: maxResults.toString(),
    start: startIndex.toString(),
  });

  try {
    const response = await fetch(`${BOOK_SEARCH_URL}?${params.toString()}`);
    const rawData = await response.json().catch(() => null);

    if (!rawData) {
      throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
    }

    const validationResult = AladdinAPIResponseEnvelopeSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error('Book search response validation failed:', validationResult.error.flatten());
      throw new Error('도서 검색 결과 형식이 올바르지 않습니다.');
    }
    const data = validationResult.data;

    if (!response.ok || data.errorCode) {
      throw new Error(`도서 검색 오류: ${data.errorMessage || response.statusText} (코드: ${data.errorCode ?? response.status})`);
    }

    if (data.item) {
      return data.item.flatMap((rawBook, index) => {
        const bookValidationResult = AladdinBookItemSchema.safeParse(rawBook);

        if (!bookValidationResult.success) {
          console.warn('Invalid book search item skipped:', {
            index,
            issues: bookValidationResult.error.issues.map(issue => ({
              path: issue.path,
              message: issue.message,
            })),
          });
          return [];
        }

        return [bookValidationResult.data];
      }).filter(book =>
        !book.title.startsWith('[큰글자도서]') &&
        !book.title.startsWith('[큰글자책]') &&
        !book.title.startsWith('[세트]')
      );
    }

    return [];
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('Failed to fetch')) {
        throw new Error('네트워크 요청에 실패했습니다. 서버에 연결할 수 없습니다.');
      }
      throw err;
    }
    throw new Error('알 수 없는 오류가 발생했습니다.');
  }
};

import { AladdinBookItem, BulkSearchResult } from '../types';
import { searchAladinBooks } from './aladin.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * 입력된 텍스트를 책 제목 목록으로 파싱합니다.
 * 줄바꿈을 구분자로 사용합니다.
 */
export const parseBookTitles = (input: string): string[] => {
  return input
    .split(/\n/) // 줄바꿈으로만 분리
    .map(title => title.trim()) // 공백 제거
    .filter(title => title.length > 0); // 빈 문자열 제거
};

/**
 * 책 제목에서 검색용 쿼리를 생성합니다.
 * 띄어쓰기 기준으로 앞 2개 단어를 추출합니다.
 */
export const generateSearchQuery = (title: string): string => {
  const words = title.split(/\s+/); // 띄어쓰기로 분리
  return words.slice(0, 2).join(' '); // 앞 2개 단어만 사용
};

/**
 * 검색 결과가 입력된 제목과 매칭되는지 확인합니다.
 * 검색 쿼리의 모든 단어가 결과 제목에 포함되어 있는지 확인합니다.
 */
export const isBookMatching = (searchQuery: string, title: string): boolean => {
  const queryWords = searchQuery.toLowerCase().split(/\s+/);
  const titleLower = title.toLowerCase();

  return queryWords.every(word => titleLower.includes(word));
};

/**
 * 단일 책 제목에 대해 검색을 수행합니다.
 */
export const searchSingleBook = async (inputTitle: string): Promise<BulkSearchResult> => {
  const id = uuidv4();
  const searchQuery = generateSearchQuery(inputTitle);

  try {
    const searchResults = await searchAladinBooks(searchQuery, 'Keyword');

    // 검색 쿼리와 매칭되는 결과만 필터링
    const matchedResults = searchResults.filter(book =>
      isBookMatching(searchQuery, book.title)
    );

    let status: BulkSearchResult['status'];
    let selectedBook: AladdinBookItem | null = null;

    if (matchedResults.length === 0) {
      status = 'none';
    } else if (matchedResults.length === 1) {
      status = 'found';
      selectedBook = matchedResults[0];
    } else {
      status = 'multiple';
    }

    return {
      id,
      inputTitle,
      searchQuery,
      searchResults: matchedResults,
      selectedBook,
      status
    };
  } catch (error) {
    console.error(`Search failed for "${inputTitle}":`, error);
    return {
      id,
      inputTitle,
      searchQuery,
      searchResults: [],
      selectedBook: null,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : '검색 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 여러 책 제목에 대해 병렬 검색을 수행합니다.
 */
export const searchBulkBooks = async (
  inputTitles: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<BulkSearchResult[]> => {
  const total = inputTitles.length;
  let completed = 0;

  // 병렬 처리를 위해 Promise.allSettled 사용
  // 개별 검색 실패가 전체에 영향을 주지 않도록 함
  const searchPromises = inputTitles.map(async (title) => {
    const result = await searchSingleBook(title);
    completed++;
    if (onProgress) {
      onProgress(completed, total);
    }
    return result;
  });

  const results = await Promise.allSettled(searchPromises);

  // Promise.allSettled 결과를 BulkSearchResult로 변환
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Promise 자체가 reject된 경우
      const inputTitle = inputTitles[index];
      return {
        id: uuidv4(),
        inputTitle,
        searchQuery: generateSearchQuery(inputTitle),
        searchResults: [],
        selectedBook: null,
        status: 'error' as const,
        errorMessage: result.reason instanceof Error ? result.reason.message : '검색 중 오류가 발생했습니다.'
      };
    }
  });
};

/**
 * 5개 단위로 배치 처리하여 대량 검색을 수행합니다.
 * API 제한을 피하기 위해 배치 간 0.5초 딜레이를 둡니다.
 */
export const searchBulkBooksWithBatch = async (
  inputTitles: string[],
  onProgress?: (completed: number, total: number, currentBatch?: number, totalBatches?: number) => void
): Promise<BulkSearchResult[]> => {
  const batchSize = 5;
  const total = inputTitles.length;
  const totalBatches = Math.ceil(total / batchSize);
  let completed = 0;
  const allResults: BulkSearchResult[] = [];

  // 5개씩 배치로 나누어 처리
  for (let i = 0; i < totalBatches; i++) {
    const batchStart = i * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, total);
    const batch = inputTitles.slice(batchStart, batchEnd);
    const currentBatch = i + 1;

    // 각 배치를 병렬로 처리
    const batchPromises = batch.map(async (title) => {
      try {
        const result = await searchSingleBook(title);
        completed++;
        if (onProgress) {
          onProgress(completed, total, currentBatch, totalBatches);
        }
        return result;
      } catch (error) {
        completed++;
        if (onProgress) {
          onProgress(completed, total, currentBatch, totalBatches);
        }
        return {
          id: uuidv4(),
          inputTitle: title,
          searchQuery: generateSearchQuery(title),
          searchResults: [],
          selectedBook: null,
          status: 'error' as const,
          errorMessage: error instanceof Error ? error.message : '검색 중 오류가 발생했습니다.'
        };
      }
    });

    // 현재 배치의 결과 대기
    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);

    // 마지막 배치가 아니면 0.5초 대기
    if (i < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return allResults;
};

/**
 * CSV 형태의 데이터를 생성합니다.
 */
export const generateBulkSearchCSV = (results: BulkSearchResult[]): string => {
  const headers = ['입력제목', '검색쿼리', '찾은책제목', 'ISBN', '저자', '출판사', '출간일', '정가', '판매가', '상태'];

  const rows = results.map(result => {
    const book = result.selectedBook;
    return [
      `"${result.inputTitle}"`,
      `"${result.searchQuery}"`,
      book ? `"${book.title}"` : '',
      book ? book.isbn13 : '',
      book ? `"${book.author}"` : '',
      book ? `"${book.publisher}"` : '',
      book ? book.pubDate.split(' ')[0] : '',
      book ? book.priceStandard.toString() : '',
      book ? book.priceSales.toString() : '',
      getStatusText(result.status)
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

/**
 * 상태를 한글로 변환합니다.
 */
export const getStatusText = (status: BulkSearchResult['status']): string => {
  switch (status) {
    case 'pending': return '대기중';
    case 'searching': return '검색중';
    case 'found': return '찾음';
    case 'multiple': return '여러개';
    case 'none': return '없음';
    case 'error': return '오류';
    default: return '알수없음';
  }
};

/**
 * 특정 검색 결과의 입력 제목을 업데이트하고 재검색을 수행합니다.
 */
export const updateSearchResultTitle = async (
  result: BulkSearchResult,
  newTitle: string
): Promise<BulkSearchResult> => {
  // 제목이 변경되지 않았다면 원래 결과 반환
  if (result.inputTitle === newTitle.trim()) {
    return { ...result, isEditing: false };
  }

  // 새로운 제목으로 검색 수행
  const updatedResult = await searchSingleBook(newTitle.trim());

  // 기존 ID와 편집 관련 상태 유지
  return {
    ...updatedResult,
    id: result.id,
    originalInputTitle: result.originalInputTitle || result.inputTitle,
    isEditing: false
  };
};

/**
 * 편집된 제목의 유효성을 검사합니다.
 */
export const validateTitleInput = (title: string): { isValid: boolean; errorMessage?: string } => {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    return { isValid: false, errorMessage: '책 제목을 입력해주세요.' };
  }

  if (trimmedTitle.length < 2) {
    return { isValid: false, errorMessage: '책 제목은 최소 2글자 이상이어야 합니다.' };
  }

  if (trimmedTitle.length > 200) {
    return { isValid: false, errorMessage: '책 제목이 너무 깁니다. (최대 200자)' };
  }

  return { isValid: true };
};

/**
 * CSV 파일을 다운로드합니다.
 */
export const downloadBulkSearchCSV = (results: BulkSearchResult[], filename?: string): void => {
  const csvContent = "\uFEFF" + generateBulkSearchCSV(results); // BOM 추가로 한글 깨짐 방지
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
    const defaultFilename = `bulk_search_${dateString}.csv`;

    link.setAttribute('download', filename || defaultFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
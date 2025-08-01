import { LibraryStockResponse, LibraryStockResponseSchema } from '../types';

const LIBRARY_CHECKER_URL = 'https://library-checker.byungwook-an.workers.dev';

export const fetchLibraryStock = async (isbn: string): Promise<LibraryStockResponse> => {
  try {
    const response = await fetch(LIBRARY_CHECKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbn })
    });
    
    if (!response.ok) {
       throw new Error(`도서관 재고 정보 API 요청에 실패했습니다: ${response.status} ${response.statusText}`);
    }

    const rawResult = await response.json();
    const validationResult = LibraryStockResponseSchema.safeParse(rawResult);

    if (!validationResult.success) {
      console.error("Library stock API response validation failed:", validationResult.error.flatten());
      throw new Error('도서관 재고 정보 API로부터 받은 데이터 형식이 올바르지 않습니다.');
    }
    
    const result: LibraryStockResponse = validationResult.data;

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('알 수 없는 재고 조회 오류가 발생했습니다.');
  }
};
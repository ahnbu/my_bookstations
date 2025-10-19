import { AladdinAPIResponseSchema, AladdinAPIResponse, AladdinBookItem } from '../types';

const TTB_KEY = import.meta.env.VITE_ALADIN_TTB_KEY;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// 로컬에서는 Vite 프록시를 통해 직접 알라딘 API를 호출하고,
// 프로덕션에서는 Vercel의 서버리스 함수를 사용합니다.
const ALADIN_API_URL = IS_PRODUCTION ? '/api/search' : '/ttb/api/ItemSearch.aspx';

export const searchAladinBooks = async (
  query: string, 
  searchType: string, 
  startIndex: number = 1,
  maxResults: number = 40 // 새로운 매개변수 추가
  ): Promise<AladdinBookItem[]> => {

  const isEbookSearch = searchType === 'eBook';

  const params = new URLSearchParams({
    Query: query,
    QueryType: isEbookSearch ? 'Keyword' : searchType, 
    // 전체(Keyword), 제목, 저자, 출판사, 전자책도 Keyword 방식으로
    MaxResults: maxResults.toString(),
    SearchTarget: isEbookSearch ? 'eBook' : 'Book',
    output: 'js',
    Version: '20131101',
    OptResult: 'ebookList',
    start: startIndex.toString(),
  });

  // 로컬 환경(Vite 프록시)에서는 TTBKey를 파라미터에 추가해야 합니다.
  // 프로덕션 환경(Vercel 함수)에서는 서버에서 키를 추가하므로 보낼 필요가 없습니다.
  if (!IS_PRODUCTION) {
    params.append('ttbkey', TTB_KEY);
  }

  const fetchUrl = `${ALADIN_API_URL}?${params.toString()}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
    }

    // Vercel 프록시와 알라딘 API 모두 JSONP 형식을 반환하므로 파싱 로직은 동일합니다.
    const jsonpText = await response.text();
    if (!jsonpText || !jsonpText.includes('{')) {
      throw new Error('API로부터 유효하지 않은 응답을 받았습니다.');
    }
    
    const jsonStartIndex = jsonpText.indexOf('{');
    const jsonEndIndex = jsonpText.lastIndexOf('}');
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      throw new Error('API 응답에서 유효한 JSON 데이터를 찾을 수 없습니다.');
    }

    const jsonString = jsonpText.substring(jsonStartIndex, jsonEndIndex + 1);
    const rawData = JSON.parse(jsonString);

    const validationResult = AladdinAPIResponseSchema.safeParse(rawData);

    if (!validationResult.success) {
      console.error("Aladdin API response validation failed:", validationResult.error.flatten());
      throw new Error('알라딘 API로부터 받은 데이터 형식이 올바르지 않습니다.');
    }
    const data: AladdinAPIResponse = validationResult.data;

    if (data.errorCode) {
      if (data.errorCode === 4) { // "검색 결과 없음" 코드
        return [];
      } else {
        throw new Error(`알라딘 API 오류: ${data.errorMessage} (코드: ${data.errorCode})`);
      }
    }
    
    if (data.item) {
      return data.item.filter(book =>
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
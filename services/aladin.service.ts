import { AladdinAPIResponseSchema, AladdinAPIResponse, AladdinBookItem } from '../types';

const TTB_KEY = 'ttbbyungwook.an1357001';
const ALADIN_API_BASE_URL = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const searchAladinBooks = async (query: string, searchType: string): Promise<AladdinBookItem[]> => {
  const params = new URLSearchParams({
    ttbkey: TTB_KEY,
    Query: query,
    QueryType: searchType,
    MaxResults: '20',
    SearchTarget: 'Book',
    output: 'js',
    Version: '20131101',
    OptResult: 'ebookList',
  });

  const aladinApiUrl = `${ALADIN_API_BASE_URL}?${params.toString()}`;

  // In production, we assume a self-hosted proxy is set up at /api/search
  // In development, we use a third-party CORS proxy.
  const fetchUrl = IS_PRODUCTION 
    ? `/api/search?${params.toString()}` // This would be the endpoint of our own backend proxy
    : `https://corsproxy.io/?${encodeURIComponent(aladinApiUrl)}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
    }

    const jsonpText = await response.text();
    if (!jsonpText || !jsonpText.includes('{')) {
      throw new Error('API로부터 유효하지 않은 응답을 받았습니다.');
    }
    
    // JSONP 응답에서 JSON 데이터만 파싱
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
      return data.item.filter(book => !book.title.startsWith('[큰글자도서]') && !book.title.startsWith('[큰글자책]'));
    }

    return [];
  } catch (err) {
    if (err instanceof Error) {
        if (err.message.includes('Failed to fetch')) {
          throw new Error('네트워크 요청에 실패했습니다. CORS 프록시 서버에 문제가 있거나 인터넷 연결을 확인해주세요.');
        }
        throw err;
    }
    throw new Error('알 수 없는 오류가 발생했습니다.');
  }
};
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchKakaoCatalog } from '../lib/kakaoBook';

// Book search proxy. Aladin OpenAPI was shut down on 2026-10-30, so this now calls
// Kakao book search and returns items in the app's existing Aladin-shaped format.
export default async function (request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return response.status(405).send('Method Not Allowed');
  }

  try {
    const { Query, QueryType, MaxResults, start } = request.query;
    const result = await searchKakaoCatalog(process.env.KAKAO_REST_API_KEY || '', {
      query: String(Query || ''),
      searchType: String(QueryType || 'Keyword'),
      maxResults: Number(MaxResults) || 20,
      page: Number(start) || 1,
    });
    if ('errorMessage' in result.body) console.error('Kakao book search failed:', result.status, result.body.errorMessage);
    return response.status(result.status).json(result.body);
  } catch (error) {
    console.error('Book search proxy error:', error);
    return response.status(500).json({ errorCode: 500, errorMessage: '도서 검색 서버 오류가 발생했습니다.' });
  }
}

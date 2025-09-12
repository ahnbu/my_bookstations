import type { VercelRequest, VercelResponse } from '@vercel/node';
import { URLSearchParams } from 'url';

const ALADIN_API_BASE_URL = 'http://www.aladin.co.kr/ttb/api/ItemSearch.aspx';
const TTB_KEY = process.env.ALADIN_TTB_KEY; // Vercel 환경 변수에서 TTB_KEY를 가져옵니다.

export default async function (request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return response.status(405).send('Method Not Allowed');
  }

  if (!TTB_KEY) {
    console.error('ALADIN_TTB_KEY is not set in environment variables.');
    return response.status(500).json({ error: 'Server configuration error: TTB_KEY is missing.' });
  }

  try {
    const { Query, QueryType, MaxResults, SearchTarget, output, Version, OptResult } = request.query;

    const params = new URLSearchParams({
      ttbkey: TTB_KEY,
      Query: Query as string,
      QueryType: QueryType as string,
      MaxResults: (MaxResults as string) || '20',
      SearchTarget: (SearchTarget as string) || 'Book',
      output: (output as string) || 'js',
      Version: (Version as string) || '20131101',
      OptResult: (OptResult as string) || 'ebookList',
    });

    const aladinApiUrl = `${ALADIN_API_BASE_URL}?${params.toString()}`;

    const aladinResponse = await fetch(aladinApiUrl);

    if (!aladinResponse.ok) {
      console.error(`Aladin API request failed: ${aladinResponse.status} ${aladinResponse.statusText}`);
      return response.status(aladinResponse.status).json({ error: `Aladin API 요청 실패: ${aladinResponse.statusText}` });
    }

    const jsonpText = await aladinResponse.text();
    
    // JSONP 응답에서 JSON 데이터만 파싱
    const jsonStartIndex = jsonpText.indexOf('{');
    const jsonEndIndex = jsonpText.lastIndexOf('}');
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      console.error('Aladin API 응답에서 유효한 JSON 데이터를 찾을 수 없습니다.');
      return response.status(500).json({ error: 'API 응답에서 유효한 JSON 데이터를 찾을 수 없습니다.' });
    }

    const jsonString = jsonpText.substring(jsonStartIndex, jsonEndIndex + 1);
    const rawData = JSON.parse(jsonString);

    return response.status(200).json(rawData);

  } catch (error) {
    console.error('Proxy server error:', error);
    return response.status(500).json({ error: '프록시 서버 오류가 발생했습니다.' });
  }
}

// 경기도 전자도서관 API 테스트 스크립트
import fetch from 'node-fetch';

async function testGyeonggiAPI() {
  const searchText = "내 손으로";
  
  // 정확한 API URL 구성
  const apiUrl = 'https://ebook.library.kr/api/service/search-engine';
  const detailQuery = `TITLE:${searchText}:true`;
  const encodedDetailQuery = encodeURIComponent(detailQuery);
  
  const url = `${apiUrl}?contentType=EB&searchType=all&detailQuery=${encodedDetailQuery}&sort=relevance&asc=desc&loanable=false&withFacet=true&page=1&size=6`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    'Referer': 'https://ebook.library.kr/search'
  };

  try {
    console.log('테스트 URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    console.log('응답 상태:', response.status, response.statusText);
    console.log('응답 헤더:', JSON.stringify([...response.headers.entries()], null, 2));

    const text = await response.text();
    console.log('응답 내용 (첫 1000자):', text.substring(0, 1000));
    
    // JSON 파싱 시도
    try {
      const jsonData = JSON.parse(text);
      console.log('JSON 파싱 성공:', JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('JSON 파싱 실패, HTML 응답일 수 있음');
    }

  } catch (error) {
    console.error('API 호출 실패:', error.message);
  }
}

testGyeonggiAPI();
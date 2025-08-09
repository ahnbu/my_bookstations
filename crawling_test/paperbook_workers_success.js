// CloudFlare Workers - 3-Way 통합 도서관 재고 확인 API (전자책 파싱 로직 업데이트)

// =================================================================
// 메인 핸들러: API 요청을 받고, 3가지 크롤링을 오케스트레이션(조율)합니다.
// =================================================================
export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: "ok",
          message: "3-Way 통합 도서관 재고 확인 API",
          usage: "POST 요청으로 {\"isbn\": \"...\", \"title\": \"...\"} 전송",
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const { isbn, title } = body;

        if (!isbn || !title) {
          return new Response(JSON.stringify({ error: 'isbn과 title 파라미터가 모두 필요합니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const promises = [
          searchGwangjuLibrary(isbn),
          searchSingleGyeonggiEbook(title, '10000004'),
          searchSingleGyeonggiEbook(title, '10000009'),
        ];

        console.log("3가지 크롤링 동시 요청 시작...");
        const results = await Promise.allSettled(promises);
        console.log("모든 크롤링 요청 완료.");

        const finalResult = {
          gwangju_paper: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason.message },
          gyeonggi_ebooks: []
        };
        
        if (results[1].status === 'fulfilled' && results[1].value?.availability) {
          finalResult.gyeonggi_ebooks.push(...results[1].value.availability);
        }
        if (results[2].status === 'fulfilled' && results[2].value?.availability) {
          finalResult.gyeonggi_ebooks.push(...results[2].value.availability);
        }

        if (finalResult.gyeonggi_ebooks.length === 0) {
            if(results[1].status === 'rejected') finalResult.gyeonggi_ebooks.push({ error: `성남 전자도서관 검색 실패: ${results[1].reason.message}` });
            if(results[2].status === 'rejected') finalResult.gyeonggi_ebooks.push({ error: `통합 전자도서관 검색 실패: ${results[2].reason.message}` });
        }

        return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (error) {
        console.error('API 메인 핸들러 오류:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response('Method not allowed', { status: 405 });
  }
};


// =================================================================
// 크롤링 함수들
// =================================================================

// [수정 안함] 빌딩 블록 1: 경기광주 도서관 (종이책)
async function searchGwangjuLibrary(isbn) {
  const url = "https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do";
  const payload = new URLSearchParams({'searchType': 'DETAIL','searchKey5': 'ISBN','searchKeyword5': isbn,'searchLibrary': 'ALL','searchSort': 'SIMILAR','searchRecordCount': '30'});
  const headers = {'User-Agent': 'Mozilla/5.0','Content-Type': 'application/x-www-form-urlencoded','Referer': 'https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchDetail.do'};
  const response = await fetch(url, { method: 'POST', headers: headers, body: payload.toString(), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`경기광주 HTTP ${response.status}`);
  const htmlContent = await response.text();
  return parseGwangjuHTML(htmlContent);
}

// [수정 안함] 빌딩 블록 2: 경기도교육청 전자도서관 (전자책)
async function searchSingleGyeonggiEbook(searchText, libraryCode) {
  const url = new URL("https://lib.goe.go.kr/elib/module/elib/search/index.do");
  url.searchParams.set("menu_idx", "94");
  url.searchParams.set("search_text", searchText);
  url.searchParams.set("library_code", libraryCode);
  url.searchParams.set("libraryCode", libraryCode);
  url.searchParams.set("sortField", "book_pubdt");
  url.searchParams.set("sortType", "desc");
  url.searchParams.set("rowCount", "50");

  const headers = {'User-Agent': 'Mozilla/5.0'};
  const response = await fetch(url.toString(), { method: 'GET', headers: headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`경기도교육청(${libraryCode}) HTTP ${response.status}`);
  const htmlContent = await response.text();
  return parseGyeonggiHTML(htmlContent, libraryCode);
}


// =================================================================
// 파싱 함수들
// =================================================================

// [수정 안함] 파싱 함수 1: 경기광주 도서관
function parseGwangjuHTML(html) {
  try {
    const bookListMatch = html.match(/<ul[^>]*class[^>]*resultList[^>]*imageType[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) return null;
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    const bookItems = [...bookListMatch[1].matchAll(liPattern)];
    if (bookItems.length === 0) return null;
    const firstBookHtml = bookItems[0][1];
    const titleMatch = firstBookHtml.match(/<dt[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    let title = titleMatch ? titleMatch[1].trim().replace(/^\d+\.\s*/, '') : "제목 정보 없음";
    
    const results = bookItems.map(item => {
        const bookHtml = item[1];
        const library = bookHtml.match(/<dd[^>]*class[^>]*site[^>]*>[\s\S]*?<span[^>]*>도서관:\s*([^<]+)<\/span>/i)?.[1].trim() || "정보 없음";
        const callNo = bookHtml.match(/청구기호:\s*([^\n<]+?)(?:\s*<|$)/i)?.[1].trim() || "정보 없음";
        const baseCallNo = callNo.split('=')[0];
        let status = "알 수 없음";
        let dueDate = "-";
        const statusSectionMatch = bookHtml.match(/<div[^>]*class[^>]*bookStateBar[^>]*>[\s\S]*?<p[^>]*class[^>]*txt[^>]*>([\s\S]*?)<\/p>/i);
        if (statusSectionMatch) {
            const statusContent = statusSectionMatch[1];
            const statusText = statusContent.match(/<b[^>]*>([^<]+)<\/b>/i)?.[1].trim() || "";
            if (statusText.includes('대출가능')) status = '대출가능';
            else if (statusText.includes('대출불가') || statusText.includes('대출중')) {
                status = '대출불가';
                dueDate = statusContent.match(/반납예정일:\s*([0-9.-]+)/i)?.[1].trim() || "-";
            }
        }
        return { '소장도서관': library, '청구기호': callNo, '기본청구기호': baseCallNo, '대출상태': status, '반납예정일': dueDate };
    });

    return { book_title: title, availability: results };
  } catch (error) { throw new Error(`광주 파싱 오류: ${error.message}`); }
}

// [수정됨] 파싱 함수 2: 경기도교육청 전자도서관 (새로운 로직)
function parseGyeonggiHTML(html, libraryCode) {
  try {
    const libraryNameMap = { '10000004': '성남도서관', '10000009': '통합도서관' };
    const branchName = libraryNameMap[libraryCode] || `코드(${libraryCode})`;

    // 도서 목록 전체가 담긴 div를 먼저 찾습니다.
    const searchResultsMatch = html.match(/<div id="search-results" class="search-results">([\s\S]*?)<\/div>/i);
    if (!searchResultsMatch) {
      console.log(`경기도교육청(${branchName}): 검색 결과 영역(search-results)을 찾을 수 없습니다.`);
      return null;
    }
    const searchResultsHtml = searchResultsMatch[1];
    
    // 각 도서 항목(<div class="row">)을 모두 찾습니다.
    const bookItemsPattern = /<div class="row">([\s\S]*?)(?:<div class="btnarea"|<div class="row">|$)/gi;
    const bookItems = [...searchResultsHtml.matchAll(bookItemsPattern)];
    
    if (bookItems.length === 0) {
      console.log(`경기도교육청(${branchName}): 도서 항목(.row)을 찾을 수 없습니다.`);
      return null;
    }

    // 각 도서 항목을 순회하며 정보를 추출합니다.
    const availability = bookItems.map(item => {
      const bookHtml = item[1];
      
      // 제목 추출 후, 검색어 하이라이팅 태그(<span...>) 제거
      let title = bookHtml.match(/<a[^>]+class="name goDetail"[^>]*>([\s\S]*?)<\/a>/i)?.[1].trim() || "정보 없음";
      title = title.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');

      // 저자, 출판사, 발행일 정보가 담긴 영역을 통째로 가져옵니다.
      const infoBlock = bookHtml.match(/<div class="bif">([\s\S]*?)<\/div>/i)?.[1] || "";
      
      // 정규식을 사용해 각 정보를 추출합니다.
      const author = infoBlock.match(/저자 : (.*?)(?:<span|<br|\s*│)/i)?.[1].trim() || "정보 없음";
      const publisher = infoBlock.match(/출판사 : (.*?)(?:<span|<br|\s*│)/i)?.[1].trim() || "정보 없음";
      const pubDate = infoBlock.match(/발행일자 : (.*?)(?:<span|<br|\s*│)/i)?.[1].trim() || "정보 없음";

      // 대출 상태 텍스트를 추출합니다.
      const statusText = infoBlock.match(/대출 가능 여부 : (.*?)(?:<br|\s*│)/i)?.[1].trim() || "정보 없음";
      let status = "알 수 없음";
      if (statusText.includes("대출 가능")) {
        status = "대출가능";
      } else if (statusText.includes("대출중") || statusText.includes("대출 불가")) {
        status = "대출불가";
      }
      
      return { 
        '소장도서관': branchName, 
        '도서명': title, 
        '저자': author, 
        '출판사': publisher,
        '발행일': pubDate,
        '대출상태': status
       };
    });
    
    return { library_name: `경기도교육청-${branchName}`, availability };
  } catch (error) { 
    console.error(`경기도교육청(${libraryCode}) 파싱 오류:`, error);
    throw new Error(`경기도교육청 파싱 오류: ${error.message}`); 
  }
}
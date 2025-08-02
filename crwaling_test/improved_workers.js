// CloudFlare Workers - 3-Way 통합 도서관 재고 확인 API (개선된 전자책 크롤링)

// 22:53 claude 제안으로 e북 크롤링 함수 수정

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
          version: "2.0 - 개선된 전자책 크롤링"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const { isbn, title } = body;

        // --- ❗️ 핵심 수정사항: 요청 파라미터 로깅 ❗️ ---
        console.log(`\n\n========================================`);
        console.log(`[${new Date().toISOString()}] 신규 요청 수신`);
        console.log(`- ISBN: ${isbn}`);
        console.log(`- Title: ${title}`);
        console.log(`========================================`);

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

        console.log(`최종 결과: 종이책 ${finalResult.gwangju_paper.availability?.length || 0}권, 전자책 ${finalResult.gyeonggi_ebooks.length}권`);
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
// 크롤링 함수들 (변경 없음)
// =================================================================
async function searchGwangjuLibrary(isbn) {
  const url = "https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do";
  const payload = new URLSearchParams({'searchType': 'DETAIL','searchKey5': 'ISBN','searchKeyword5': isbn,'searchLibrary': 'ALL','searchSort': 'SIMILAR','searchRecordCount': '30'});
  const headers = {'User-Agent': 'Mozilla/5.0','Content-Type': 'application/x-www-form-urlencoded','Referer': 'https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchDetail.do'};
  const response = await fetch(url, { method: 'POST', headers: headers, body: payload.toString(), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`경기광주 HTTP ${response.status}`);
  const htmlContent = await response.text();
  return parseGwangjuHTML(htmlContent);
}

async function searchSingleGyeonggiEbook(searchText, libraryCode) {
  const url = new URL("https://lib.goe.go.kr/elib/module/elib/search/index.do");
  url.searchParams.set("menu_idx", "94");
  url.searchParams.set("search_text", searchText);
  url.searchParams.set("library_code", libraryCode);
  url.searchParams.set("libraryCode", libraryCode);
  url.searchParams.set("sortField", "book_pubdt");
  url.searchParams.set("sortType", "desc");
  url.searchParams.set("rowCount", "50");

  console.log(`경기도교육청 전자도서관 크롤링 시작 - 라이브러리 코드: ${libraryCode}, 검색어: ${searchText}`);
  console.log(`요청 URL: ${url.toString()}`);

  const headers = {'User-Agent': 'Mozilla/5.0'};
  const response = await fetch(url.toString(), { method: 'GET', headers: headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`경기도교육청(${libraryCode}) HTTP ${response.status}`);
  const htmlContent = await response.text();
  
  console.log(`경기도교육청(${libraryCode}) HTML 응답 길이: ${htmlContent.length}`);
  
  return parseGyeonggiHTML(htmlContent, libraryCode);
}


// =================================================================
// 파싱 함수들
// =================================================================

// [변경 없음] 파싱 함수 1: 경기광주 도서관
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

// [변경] 파싱 함수 2: 경기도교육청 전자도서관
function parseGyeonggiHTML(html, libraryCode) {
  try {
    const libraryNameMap = { '10000004': '성남도서관', '10000009': '통합도서관' };
    const branchName = libraryNameMap[libraryCode] || `코드(${libraryCode})`;

    if (html.includes("찾으시는 자료가 없습니다")) {
      console.log(`경기도교육청(${branchName}): '찾으시는 자료가 없습니다' 메시지 확인. 빈 결과를 반환합니다.`);
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }

    const searchResultsMatch = html.match(/<div id="search-results" class="search-results">([\s\S]*?)<\/div>/i);
    if (!searchResultsMatch) {
      console.log(`경기도교육청(${branchName}): 검색 결과 영역(search-results)을 찾을 수 없습니다.`);
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }
    const searchResultsHtml = searchResultsMatch[1];
    
    // 개선된 정규식 패턴: 실제 HTML 구조에 맞게 수정
    const bookItemsPattern = /<div class="row">\s*<div class="thumb">[\s\S]*?<\/div>\s*<div class="box">[\s\S]*?<\/div>(?:\s*<div class="btnarea"[\s\S]*?<\/div>)?\s*<\/div>/gi;
    const bookItems = [...searchResultsHtml.matchAll(bookItemsPattern)];
    
    console.log(`경기도교육청(${branchName}): 정규식으로 ${bookItems.length}개 도서 항목 발견`);
    
    if (bookItems.length === 0) {
      console.log(`경기도교육청(${branchName}): 도서 항목(.row)을 찾을 수 없습니다.`);
      console.log(`검색결과 영역 시작 500자: ${searchResultsHtml.substring(0, 500)}`);
      
      // 대안 패턴 시도
      const alternativePattern = /<div class="row"[\s\S]*?<\/div>(?=\s*<div class="row"|$)/gi;
      const alternativeItems = [...searchResultsHtml.matchAll(alternativePattern)];
      console.log(`대안 패턴으로 ${alternativeItems.length}개 항목 발견`);
      
      if (alternativeItems.length > 0) {
        console.log(`대안 패턴 첫 번째 항목 일부: ${alternativeItems[0][0].substring(0, 200)}`);
      }
      
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }

    const availability = bookItems.map((item, index) => {
      const bookHtml = item[0]; // Full match, not just capture group
      console.log(`${branchName} - 도서 ${index + 1} 파싱 중... (HTML 길이: ${bookHtml.length})`);
      
      // IMPROVED: More robust title extraction
      let title = "정보 없음";
      const titleMatch = bookHtml.match(/<a[^>]+class="name goDetail"[^>]*>([\s\S]*?)<\/a>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
        // Remove any HTML tags (especially spans with highlighting)
        title = title.replace(/<[^>]*>/g, '').trim();
      }
      
      // IMPROVED: More robust info extraction from the bif div
      const bifMatch = bookHtml.match(/<div class="bif">([\s\S]*?)<\/div>/i);
      const infoBlock = bifMatch ? bifMatch[1] : "";
      
      const author = infoBlock.match(/저자\s*:\s*([^<│]+?)(?:<|│|$)/i)?.[1]?.trim() || "정보 없음";
      const publisher = infoBlock.match(/출판사\s*:\s*([^<│]+?)(?:<|│|$)/i)?.[1]?.trim() || "정보 없음";
      const pubDate = infoBlock.match(/발행일자\s*:\s*([^<│]+?)(?:<|│|$)/i)?.[1]?.trim() || "정보 없음";
      const statusText = infoBlock.match(/대출\s*가능\s*여부\s*:\s*([^<│]+?)(?:<|│|$)/i)?.[1]?.trim() || "정보 없음";
      
      let status = "알 수 없음";
      if (statusText.includes("대출 가능") || statusText.includes("대출가능")) {
        status = "대출가능";
      } else if (statusText.includes("대출중") || statusText.includes("대출 불가") || statusText.includes("대출불가")) {
        status = "대출불가";
      }
      
      console.log(`${branchName} - 도서명: "${title}", 상태: ${status}, 저자: ${author}`);
      
      return { 
        '소장도서관': branchName, 
        '도서명': title, 
        '저자': author, 
        '출판사': publisher, 
        '발행일': pubDate, 
        '대출상태': status 
      };
    });
    
    console.log(`경기도교육청(${branchName}): ${availability.length}권 파싱 완료`);
    return { library_name: `경기도교육청-${branchName}`, availability };
  } catch (error) { 
    console.error(`경기도교육청(${libraryCode}) 파싱 오류:`, error);
    throw new Error(`경기도교육청 파싱 오류: ${error.message}`); 
  }
}
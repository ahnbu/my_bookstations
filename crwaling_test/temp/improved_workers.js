// CloudFlare Workers - 3-Way 통합 도서관 재고 확인 API (개선된 전자책 크롤링)
// 최종 수정: 2025-08-02 - 정규식 기반 파싱에서 문자열 분할 방식으로 변경하여 안정성 확보

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
          version: "2.1 - 안정화된 전자책 크롤링"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const { isbn, title } = body;

        console.log(`\n\n========================================`);
        console.log(`[${new Date().toISOString()}] 신규 요청 수신`);
        console.log(`- ISBN: ${isbn}`);
        console.log(`- Title: ${title}`);
        console.log(`========================================`);

        if (!isbn || !title) {
          return new Response(JSON.stringify({ error: 'isbn과 title 파라미터가 모두 필요합니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const promises = [
          searchGwangjuLibrary(isbn, title), // title을 넘겨주어 정확도 향상
          searchSingleGyeonggiEbook(title, '10000004'), // 성남
          searchSingleGyeonggiEbook(title, '10000009'), // 통합
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
// 크롤링 함수들
// =================================================================
async function searchGwangjuLibrary(isbn, title) {
  const url = "https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do";
  const payload = new URLSearchParams({'searchType': 'DETAIL','searchKey5': 'ISBN','searchKeyword5': isbn,'searchLibrary': 'ALL','searchSort': 'SIMILAR','searchRecordCount': '30'});
  const headers = {'User-Agent': 'Mozilla/5.0','Content-Type': 'application/x-www-form-urlencoded','Referer': 'https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchDetail.do'};
  const response = await fetch(url, { method: 'POST', headers: headers, body: payload.toString(), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`경기광주 HTTP ${response.status}`);
  const htmlContent = await response.text();
  return parseGwangjuHTML(htmlContent, title); // title을 파서로 전달
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
  const headers = {'User-Agent': 'Mozilla/5.0'};
  const response = await fetch(url.toString(), { method: 'GET', headers: headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`경기도교육청(${libraryCode}) HTTP ${response.status}`);
  const htmlContent = await response.text();
  return parseGyeonggiHTML(htmlContent, libraryCode);
}


// =================================================================
// 파싱 함수들
// =================================================================

// [수정] 파싱 함수 1: 경기광주 도서관 - 제목 유사도 체크 추가
function parseGwangjuHTML(html, referenceTitle) {
  try {
    const bookListMatch = html.match(/<ul[^>]*class[^>]*resultList[^>]*imageType[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) return { book_title: "결과 없음", availability: [] };
    
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    const bookItems = [...bookListMatch[1].matchAll(liPattern)];
    if (bookItems.length === 0) return { book_title: "결과 없음", availability: [] };

    // 제목 유사도 계산 함수
    const getSimilarity = (t1, t2) => {
        const set1 = new Set(t1.replace(/[:\s]/g, '').split(''));
        const set2 = new Set(t2.replace(/[:\s]/g, '').split(''));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        return intersection.size / Math.max(set1.size, set2.size);
    };

    let bestMatch = { score: -1, title: "제목 정보 없음", availability: [] };

    for (const item of bookItems) {
        const bookHtml = item[1];
        const titleMatch = bookHtml.match(/<dt[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
        const currentTitle = titleMatch ? titleMatch[1].trim().replace(/^\d+\.\s*/, '') : "";
        
        if (!currentTitle) continue;

        const score = getSimilarity(referenceTitle, currentTitle);

        if (score > bestMatch.score) {
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
            const availability = [{ '소장도서관': library, '청구기호': callNo, '기본청구기호': baseCallNo, '대출상태': status, '반납예정일': dueDate }];
            
            bestMatch = { score, title: currentTitle, availability };
        }
    }
    
    // 만약 가장 유사한 책의 재고 정보가 여러 도서관에 있다면, 모두 취합해야 함.
    // 이 로직은 현재 첫번째 매칭된 도서관의 정보만 가져오므로, 추후 확장 필요.
    // 지금은 가장 유사한 제목의 첫번째 재고정보를 반환.

    return { book_title: bestMatch.title, availability: bestMatch.availability };
  } catch (error) { throw new Error(`광주 파싱 오류: ${error.message}`); }
}

// [수정] 파싱 함수 2: 경기도교육청 전자도서관 - 문자열 분할 방식으로 안정성 확보
function parseGyeonggiHTML(html, libraryCode) {
  try {
    const libraryNameMap = { '10000004': '성남도서관', '10000009': '통합도서관' };
    const branchName = libraryNameMap[libraryCode] || `코드(${libraryCode})`;

    if (html.includes("찾으시는 자료가 없습니다")) {
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }

    const searchResultsMatch = html.match(/<div id=\"search-results\" class=\"search-results\">([\s\S]*?)<div class=\"pagination\">/i);
    if (!searchResultsMatch) {
      console.log(`경기도교육청(${branchName}): 검색 결과 영역(search-results)을 찾을 수 없습니다.`);
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }
    const searchResultsHtml = searchResultsMatch[1];

    // '<div class="row">'를 기준으로 HTML을 분할하여 각 도서 항목을 배열로 만듭니다.
    const bookBlocks = searchResultsHtml.split('<div class="row">').slice(1);
    
    console.log(`경기도교육청(${branchName}): 문자열 분할로 ${bookBlocks.length}개 도서 블록 발견`);
    
    if (bookBlocks.length === 0) {
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }

    const availability = bookBlocks.map((bookHtml, index) => {
      const titleMatch = bookHtml.match(/<a[^>]+class=\"name goDetail\"[^>]*>([\s\S]*?)<\/a>/i);
      let title = "정보 없음";
      if (titleMatch) {
        title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
      }
      
      const bifMatch = bookHtml.match(/<div class=\"bif\">([\s\S]*?)<\/div>/i);
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
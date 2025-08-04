// CloudFlare Workers - 3-Way 통합 도서관 재고 확인 API (정규식 수정 및 원문 로깅 추가)
// 최종 수정: 2025-08-03 - 전자책 파싱 정규식 정교화 및 디버깅을 위한 원문 HTML 로깅 기능 추가

// =================================================================
// 메인 핸들러
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
          version: "2.5 - 파서 정교화 및 원문 로깅"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        // title이 없는 경우를 대비해 기본값 ''를 할당
        const { isbn, title = '' } = body;

        console.log(`\n\n========================================`);
        console.log(`[${new Date().toISOString()}] 신규 요청 수신`);
        console.log(`- ISBN: ${isbn}`);
        console.log(`- Title: ${title}`);
        console.log(`========================================`);

        if (!isbn) {
          return new Response(JSON.stringify({ error: 'isbn 파라미터가 필요합니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (!title) {
            console.warn("경고: title 파라미터가 없어 전자책 검색을 건너뜁니다.");
        }

        const promises = [
          searchGwangjuLibrary(isbn),
        ];

        // title이 있을 때만 전자책 검색을 수행
        if (title) {
            promises.push(
                searchSingleGyeonggiEbook(title, '10000004'), // 성남
                searchSingleGyeonggiEbook(title, '10000009')  // 통합
            );
        }

        console.log(`--> ${promises.length}가지 크롤링 동시 요청 시작...`);
        const results = await Promise.allSettled(promises);
        console.log("<-- 모든 크롤링 요청 완료.");

        const finalResult = {
          gwangju_paper: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason.message },
          gyeonggi_ebooks: []
        };
        
        if (title && results.length > 1) {
            if (results[1].status === 'fulfilled' && results[1].value?.availability) {
              finalResult.gyeonggi_ebooks.push(...results[1].value.availability);
            }
            if (results[2].status === 'fulfilled' && results[2].value?.availability) {
              finalResult.gyeonggi_ebooks.push(...results[2].value.availability);
            }

            if (finalResult.gyeonggi_ebooks.length === 0) {
                if(results[1]?.status === 'rejected') finalResult.gyeonggi_ebooks.push({ library: '성남도서관', error: `검색 실패: ${results[1].reason.message}` });
                if(results[2]?.status === 'rejected') finalResult.gyeonggi_ebooks.push({ library: '통합도서관', error: `검색 실패: ${results[2].reason.message}` });
            }
        }

        const paperBookCount = finalResult.gwangju_paper?.availability?.length || 0;
        const ebookCount = finalResult.gyeonggi_ebooks.filter(b => !b.error).length;
        console.log(`==> 최종 결과: 종이책(${finalResult.gwangju_paper?.book_title || '정보없음'}) ${paperBookCount}권, 전자책 ${ebookCount}권`);
        
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
async function searchGwangjuLibrary(isbn) {
  console.log(`[시작] 종이책 검색 (ISBN: ${isbn})`);
  // (기존 코드와 동일)
  const url = "https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do";
  const payload = new URLSearchParams({'searchType': 'DETAIL','searchKey5': 'ISBN','searchKeyword5': isbn,'searchLibrary': 'ALL','searchSort': 'SIMILAR','searchRecordCount': '30'});
  const headers = {'User-Agent': 'Mozilla/5.0','Content-Type': 'application/x-www-form-urlencoded','Referer': 'https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchDetail.do'};
  const response = await fetch(url, { method: 'POST', headers: headers, body: payload.toString(), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`경기광주 HTTP ${response.status}`);
  const htmlContent = await response.text();
  const result = parseGwangjuHTML(htmlContent);
  console.log(`[완료] 종이책 검색 결과: "${result.book_title || '제목 없음'}" (${result.availability.length}개 소장처)`);
  return result;
}

async function searchSingleGyeonggiEbook(searchText, libraryCode) {
  const libraryNameMap = { '10000004': '성남도서관', '10000009': '통합도서관' };
  const libraryName = libraryNameMap[libraryCode];
  console.log(`[시작] 전자책 검색 (${libraryName}, Title: ${searchText})`);
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
  
  // [디버그 로그 추가] 파싱 전 원문 HTML을 그대로 출력합니다.
  console.log(`\n--- [디버그] ${libraryName} 원문 HTML 시작 ---\n${htmlContent}\n--- [디버그] ${libraryName} 원문 HTML 종료 ---\n`);

  const result = parseGyeonggiHTML(htmlContent, libraryCode);
  console.log(`[완료] 전자책 검색 결과 (${libraryName}): ${result.availability.length}권 파싱`);
  return result;
}


// =================================================================
// 파싱 함수들
// =================================================================
function parseGwangjuHTML(html) {
  // (기존 코드와 동일)
  try {
    const bookListMatch = html.match(/<ul[^>]*class[^>]*resultList[^>]*imageType[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) return { book_title: "결과 없음", availability: [] };
    
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    const bookItems = [...bookListMatch[1].matchAll(liPattern)];
    if (bookItems.length === 0) return { book_title: "결과 없음", availability: [] };

    const firstBookHtml = bookItems[0][1];
    const titleMatch = firstBookHtml.match(/<dt[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    let title = titleMatch ? titleMatch[1].trim().replace(/^\d+\.\s*/, '') : "제목 정보 없음";
    
    const availability = bookItems.map(item => {
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

    return { book_title: title, availability: availability };
  } catch (error) { throw new Error(`광주 파싱 오류: ${error.message}`); }
}


// [수정됨] 실제 HTML 구조에 맞게 정규식이 수정된 파싱 함수
function parseGyeonggiHTML(html, libraryCode) {
  try {
    const libraryNameMap = { '10000004': '성남도서관', '10000009': '통합도서관' };
    const branchName = libraryNameMap[libraryCode] || `코드(${libraryCode})`;

    if (html.includes("찾으시는 자료가 없습니다")) {
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }

    const searchResultsMatch = html.match(/<div id="search-results" class="search-results">([\s\S]*?)<div id="cms_paging"/i);
    if (!searchResultsMatch) {
      console.log(`경기도교육청(${branchName}): 검색 결과 영역(search-results)을 찾을 수 없습니다.`);
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }
    const searchResultsHtml = searchResultsMatch[1];
    
    // [핵심 수정] 각 도서 항목(<div class="row">...</div>) 전체를 하나의 그룹으로 찾습니다.
    // 이 패턴은 <div class="row">로 시작해서 짝이 맞는 </div>로 끝나는 모든 블록을 찾습니다.
    const bookItemsPattern = /<div class="row">[\s\S]*?<\/div>\s*(?=<div class="row">|$)/gi;
    const bookItems = [...searchResultsHtml.matchAll(bookItemsPattern)];
    
    if (bookItems.length === 0) {
      console.log(`경기도교육청(${branchName}): 도서 항목(.row)을 찾지 못했습니다. 원문 HTML을 확인해주세요.`);
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }

    const availability = bookItems.map(match => {
      const bookHtml = match[0]; // 정규식에 매칭된 전체 문자열
      
      let title = bookHtml.match(/<a[^>]+class="name goDetail"[^>]*>([\s\S]*?)<\/a>/i)?.[1].trim() || "정보 없음";
      title = title.replace(/<[^>]*>/g, '').trim(); // 모든 HTML 태그(<span> 등)를 제거

      const infoBlock = bookHtml.match(/<div class="bif">([\s\S]*?)<\/div>/i)?.[1] || "";
      
      const author = infoBlock.match(/저자\s*:\s*(.*?)(?:<span|<br|\s*│)/i)?.[1].trim() || "정보 없음";
      const publisher = infoBlock.match(/출판사\s*:\s*(.*?)(?:<span|<br|\s*│)/i)?.[1].trim() || "정보 없음";
      const pubDate = infoBlock.match(/발행일자\s*:\s*(.*?)(?:<span|<br|\s*│)/i)?.[1].trim() || "정보 없음";
      const statusText = infoBlock.match(/대출 가능 여부\s*:\s*(.*?)(?:<br|\s*│)/i)?.[1].trim() || "정보 없음";
      
      let status = "알 수 없음";
      if (statusText.includes("대출 가능") || statusText.includes("대출가능")) {
        status = "대출가능";
      } else if (statusText.includes("대출중") || statusText.includes("대출 불가") || statusText.includes("대출불가")) {
        status = "대출불가";
      }
      
      return { '소장도서관': branchName, '도서명': title, '저자': author, '출판사': publisher, '발행일': pubDate, '대출상태': status };
    });
    
    return { library_name: `경기도교육청-${branchName}`, availability };
  } catch (error) { 
    console.error(`경기도교육청(${libraryCode}) 파싱 오류:`, error);
    throw new Error(`경기도교육청 파싱 오류: ${error.message}`); 
  }
}
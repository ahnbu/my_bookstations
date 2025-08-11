// 최종 수정: 2025-08-09 - 경기도 전자도서관 재고 크롤링 기능 추가
// 수정: 2025-08-09 - 전자책 대출가능 여부 정확성 개선
// 수정: 2025-08-09 - supabase 무료요금 비활성화 방지 위해서 3일마다 ping 기능 추가
// 수정: 2025-08-03 - 디버깅 코드 최소화

// CloudFlare Workers - 4-Way 통합 도서관 재고 확인 API (경기도 전자도서관 포함 버전)
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
          message: "4-Way 통합 도서관 재고 확인 API + 경기도 전자도서관 + Supabase Keep-Alive",
          version: "3.0-production-gyeonggi-ebook"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const { isbn, title = '', gyeonggiTitle = '' } = body;

        // 필수 디버그 로그: 수신된 ISBN과 제목 기록
        console.log(`Request received - ISBN: ${isbn}, Title: "${title}", GyeonggiTitle: "${gyeonggiTitle}"`);

        if (!isbn) {
          return new Response(JSON.stringify({ error: 'isbn 파라미터가 필요합니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const promises = [
          searchGwangjuLibrary(isbn),
        ];

        let gyeonggiEbookPromise = null;
        if (title) {
            promises.push(
                searchGyeonggiEbookEducation(title, '10000004'), // 성남 (기존 title 사용)
                searchGyeonggiEbookEducation(title, '10000004'), // 성남 (기존 title 사용)
            );
        }
        
        // 경기도 전자도서관은 gyeonggiTitle 사용하여 별도 처리
        if (gyeonggiTitle) {
            console.log(`경기도 전자도서관 검색 시작: "${gyeonggiTitle}"`);
            gyeonggiEbookPromise = searchGyeonggiEbookLibrary(gyeonggiTitle);
        } else {
            console.log('gyeonggiTitle이 없어서 경기도 전자도서관 검색을 건너뜀');
        }

        const results = await Promise.allSettled(promises);
        
        // 경기도 전자도서관 결과 처리
        let gyeonggiEbookResult = null;
        if (gyeonggiEbookPromise) {
            try {
                console.log('경기도 전자도서관 Promise 대기 중...');
                gyeonggiEbookResult = await gyeonggiEbookPromise;
                console.log('경기도 전자도서관 결과 수신:', JSON.stringify(gyeonggiEbookResult, null, 2));
            } catch (error) {
                console.error('경기도 전자도서관 검색 오류:', error.message);
                gyeonggiEbookResult = { error: error.message };
            }
        } else {
            console.log('gyeonggiEbookPromise가 null이어서 검색하지 않음');
        }

        const finalResult = {
          gwangju_paper: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason.message },
          gyeonggi_ebooks: [],
          gyeonggi_ebook_library: gyeonggiEbookResult
        };
        
        if (title && results.length > 1) {
            // 기존 경기도교육청 전자책 결과 처리
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
        
        return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (error) {
        console.error(`API Error: ${error.message}`);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response('Method not allowed', { status: 405 });
  },

  // Supabase 무료요금제에서 7일 비활성화시 잠금 예방 위해서 3일에 1번씩 ping 보내는 Scheduled Events 처리
  async scheduled(event, env, ctx) {
    try {
      console.log('=== Supabase Keep-Alive Start ===');
      console.log('Triggered at:', new Date().toISOString());
      
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/keep_alive`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Supabase keep-alive SUCCESS:', result);
      } else {
        console.error('❌ Supabase keep-alive FAILED:', response.status);
      }
    } catch (error) {
      console.error('💥 Supabase keep-alive ERROR:', error.message);
    }
  }
};


// =================================================================
// 크롤링 함수들
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

async function searchGyeonggiEbookEducation(searchText, libraryCode) {
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

// 새로운 경기도 전자도서관 API 함수
async function searchGyeonggiEbookLibrary(searchText) {
  const encodedTitle = encodeURIComponent(searchText);
  const apiUrl = `https://ebook.library.kr/api/service/search-engine?contentType=EB&searchType=all&detailQuery=TITLE:${encodedTitle}:true&sort=relevance&asc=desc&loanable=false&withFacet=true&page=1&size=6`;

  console.log(`경기도 전자도서관 API 요청: ${searchText} -> ${apiUrl}`);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://ebook.library.kr/',
    'Origin': 'https://ebook.library.kr'
  };

  const response = await fetch(apiUrl, { 
    method: 'GET', 
    headers: headers, 
    signal: AbortSignal.timeout(25000) 
  });
  
  if (!response.ok) {
    throw new Error(`경기도 전자도서관 API HTTP ${response.status}`);
  }
  
  const jsonData = await response.json();
  console.log('경기도 전자도서관 API 응답:', JSON.stringify(jsonData, null, 2));
  
  return parseGyeonggiEbookApiResponseNew(jsonData, searchText);
}


// =================================================================
// 파싱 함수들
// =================================================================
function parseGwangjuHTML(html) {
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

function parseGyeonggiHTML(html, libraryCode) {
  try {
    const libraryNameMap = { '10000004': '성남도서관', '10000009': '통합도서관' };
    const branchName = libraryNameMap[libraryCode] || `코드(${libraryCode})`;

    if (html.includes("찾으시는 자료가 없습니다")) {
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }

    const searchResultsMatch = html.match(/<div id="search-results" class="search-results">([\s\S]*?)<div id="cms_paging"/i);
    if (!searchResultsMatch) {
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }
    const searchResultsHtml = searchResultsMatch[1];
    
    const bookItemsPattern = /<div class="row">[\s\S]*?<\/div>\s*(?=<div class="row">|$)/gi;
    const bookItems = [...searchResultsHtml.matchAll(bookItemsPattern)];
    
    if (bookItems.length === 0) {
      return { library_name: `경기도교육청-${branchName}`, availability: [] };
    }

    const availability = bookItems.map(match => {
      const bookHtml = match[0];
      
      let title = bookHtml.match(/<a[^>]+class="name goDetail"[^>]*>([\s\S]*?)<\/a>/i)?.[1].trim() || "정보 없음";
      title = title.replace(/<[^>]*>/g, '').trim();

      const infoBlock = bookHtml.match(/<div class="bif">([\s\S]*?)<\/div>/i)?.[1] || "";
      
      const author = infoBlock.match(/저자\s*:\s*(.*?)(?:<span|<br|\s*│)/i)?.[1]?.trim() || "정보 없음";
      const publisher = infoBlock.match(/출판사\s*:\s*(.*?)(?:<span|<br|\s*│)/i)?.[1]?.trim() || "정보 없음";
      const pubDate = infoBlock.match(/발행일자\s*:\s*(.*?)(?:<span|<br|\s*│)/i)?.[1]?.trim() || "정보 없음";
      
      // 대출 가능 여부 추출을 위한 더 유연한 패턴들
      let statusText = "정보 없음";
      const statusPatterns = [
        /대출\s*가능\s*여부\s*:\s*(.*?)(?:<br|<span|\s*│|$)/i,
        /대출\s*가능\s*여부\s*:\s*(.*?)(?:\n|<|$)/i,
        /대출\s*가능\s*여부\s*:\s*([^<\n]+)/i,
        /대출.*?가능.*?여부.*?:\s*(.*?)(?:<br|<span|\s*│|$)/i
      ];
      
      for (const pattern of statusPatterns) {
        const match = infoBlock.match(pattern);
        if (match && match[1]) {
          statusText = match[1].trim();
          break;
        }
      }
      
      // 디버깅을 위한 로그 (실제 HTML 내용 확인)
      if (statusText === "정보 없음") {
        console.log(`디버그 - 도서명: ${title}`);
        console.log(`디버그 - infoBlock 내용:`, infoBlock.substring(0, 500));
      }
      
      // 개선된 대출 상태 판단 로직
      let status = "알 수 없음";
      if (statusText.includes("대출 가능") || statusText.includes("대출가능")) {
        // 전자책은 동시 대출이 가능하므로 "대출 가능"이라고 표시되면 실제로 대출 가능
        status = "대출가능";
      } else if (statusText.includes("대출중") || statusText.includes("대출 불가") || statusText.includes("대출불가")) {
        status = "대출불가";
      }
      
      return { '소장도서관': branchName, '도서명': title, '저자': author, '출판사': publisher, '발행일': pubDate, '대출상태': status };
    });
    
    return { library_name: `경기도교육청-${branchName}`, availability };
  } catch (error) { 
    console.error(`경기도교육청(${libraryCode}) 파싱 오류: ${error.message}`);
    throw new Error(`경기도교육청 파싱 오류: ${error.message}`); 
  }
}

// 새로운 경기도 전자도서관 API 응답 파싱 함수
function parseGyeonggiEbookApiResponse(apiResponse, searchText) {
  try {
    console.log('경기도 전자도서관 API 응답 파싱 시작');
    
    // 더 포괄적인 검색 결과 없음 체크
    const noResultPatterns = [
      '검색 결과가 없습니다',
      '검색된 자료가 없습니다',
      '검색결과가 없습니다',
      'No results found',
      'class="noResult"'
    ];
    
    const hasNoResults = noResultPatterns.some(pattern => html.includes(pattern));
    if (hasNoResults) {
      console.log('검색 결과 없음 확인됨');
      return {
        library_name: '경기도 전자도서관',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        owned_count: 0,
        subscription_count: 0,
        books: []
      };
    }

    let ownedCount = 0;
    let subscriptionCount = 0;
    let availableCount = 0;
    const books = [];

    // HTML에서 주요 섹션들 확인
    console.log('HTML에서 searchResultList 찾기...');
    const allSections = html.match(/<div class="searchResultList"[^>]*>/g) || [];
    console.log('발견된 섹션들:', allSections);
    
    // data-type 값들 확인
    const dataTypes = allSections.map(section => {
      const match = section.match(/data-type="([^"]*)"/);
      return match ? match[1] : 'unknown';
    });
    console.log('data-type 값들:', dataTypes);
    
    // 소장형/구독형 텍스트 직접 검색
    const ebTextMatch = html.match(/소장형\s*\(\s*<span>\s*(\d+)\s*<\/span>\s*\)/i);
    const subsTextMatch = html.match(/구독형\s*\(\s*<span>\s*(\d+)\s*<\/span>\s*\)/i);
    console.log('소장형 텍스트 매치:', ebTextMatch);
    console.log('구독형 텍스트 매치:', subsTextMatch);
    
    // 직접 매칭이 성공했다면 카운트 설정
    if (ebTextMatch) {
      ownedCount = parseInt(ebTextMatch[1], 10);
      console.log(`직접 매칭으로 소장형 개수 발견: ${ownedCount}`);
    }
    if (subsTextMatch) {
      subscriptionCount = parseInt(subsTextMatch[1], 10);
      console.log(`직접 매칭으로 구독형 개수 발견: ${subscriptionCount}`);
    }

    // 소장형(EB) 섹션 파싱
    const ebSectionMatch = html.match(/<div class="searchResultList" data-type="EB">([\s\S]*?)(?=<div class="searchResultList" data-type="(?:SUBS|AB)"|$)/i);
    if (ebSectionMatch) {
      console.log('소장형(EB) 섹션 발견');
      console.log('EB 섹션 길이:', ebSectionMatch[1].length);
      
      // 여러 패턴으로 소장형 개수 추출 시도
      const ebCountPatterns = [
        /<em>소장형 \(<span>(\d+)<\/span>\)<\/em>/i,
        /<em>소장형.*?(\d+).*?<\/em>/i,
        /소장형.*?(\d+)/i
      ];
      
      for (const pattern of ebCountPatterns) {
        const match = ebSectionMatch[1].match(pattern);
        if (match) {
          ownedCount = parseInt(match[1], 10);
          console.log(`소장형 개수 발견: ${ownedCount} (패턴: ${pattern})`);
          break;
        }
      }

      // 소장형 책이 있다면 간단히 available_count를 ownedCount로 설정
      // (실제 HTML 구조를 모르므로 보수적 접근)
      if (ownedCount > 0) {
        // 기본적으로 모든 소장형 책이 대출가능하다고 가정
        // 실제로는 더 정밀한 파싱이 필요하지만, 일단 1권은 있다고 표시
        availableCount = ownedCount;
        console.log(`소장형 책 있음 - 대출가능으로 설정: ${availableCount}`);
        
        for (let i = 0; i < ownedCount; i++) {
          books.push({
            type: '소장형',
            title: '소장형 전자책',
            status: '대출가능',
            current_borrow: 0,
            total_capacity: 1
          });
        }
      }

      // 더 포괄적인 버튼 패턴 검색 시도
      const buttonPatterns = [
        /<button[^>]*class="[^"]*btn[^"]*"[^>]*>([^<]*)<small[^>]*>\((\d+)\/(\d+)\)<\/small><\/button>/gi,
        /<button[^>]*>([^<]*)<small[^>]*>\((\d+)\/(\d+)\)<\/small><\/button>/gi,
        /대출하기|예약하기|이용하기/gi
      ];
      
      console.log('버튼 패턴 검색 시작...');
      for (const pattern of buttonPatterns) {
        const matches = [...ebSectionMatch[1].matchAll(pattern)];
        console.log(`패턴 ${pattern} 매치 수: ${matches.length}`);
        if (matches.length > 0) {
          console.log('첫 번째 매치:', matches[0]);
        }
      }
    }

    // 구독형(SUBS) 섹션 파싱
    const subsSectionMatch = html.match(/<div class="searchResultList" data-type="SUBS">([\s\S]*?)(?=<div class="searchResultList" data-type="AB"|$)/i);
    if (subsSectionMatch) {
      console.log('구독형(SUBS) 섹션 발견');
      
      // 여러 패턴으로 구독형 개수 추출 시도
      const subsCountPatterns = [
        /<em>구독형 \(<span>(\d+)<\/span>\)<\/em>/i,
        /<em>구독형.*?(\d+).*?<\/em>/i,
        /구독형.*?(\d+)/i
      ];
      
      for (const pattern of subsCountPatterns) {
        const match = subsSectionMatch[1].match(pattern);
        if (match) {
          subscriptionCount = parseInt(match[1], 10);
          console.log(`구독형 개수 발견: ${subscriptionCount} (패턴: ${pattern})`);
          break;
        }
      }
      
      if (subscriptionCount > 0) {
        // 구독형은 모두 대출 가능으로 처리
        availableCount += subscriptionCount;
        console.log(`구독형 ${subscriptionCount}권을 대출가능으로 설정`);
        
        // 구독형 도서들 추가
        for (let i = 0; i < subscriptionCount; i++) {
          books.push({
            type: '구독형',
            title: '구독형 전자책',
            status: '대출가능'
          });
        }
      }
    }
    
    // 다른 섹션이나 일반적인 검색 결과도 확인
    if (ownedCount === 0 && subscriptionCount === 0) {
      console.log('EB/SUBS 섹션에서 찾지 못함. 일반 검색 결과 확인...');
      
      // 일반적인 책 목록 패턴 확인
      const generalBookPatterns = [
        /class="bookItem"/gi,
        /class="book"/gi,
        /<li[^>]*book/gi,
        /대출하기|예약하기|이용하기/gi
      ];
      
      let foundBooks = 0;
      generalBookPatterns.forEach((pattern, index) => {
        const matches = html.match(pattern) || [];
        console.log(`일반 패턴 ${index + 1}: ${matches.length}개 매치`);
        if (matches.length > foundBooks) {
          foundBooks = matches.length;
        }
      });
      
      if (foundBooks > 0) {
        console.log(`일반 검색으로 ${foundBooks}권 발견 - 임시로 1권 설정`);
        ownedCount = 1;
        availableCount = 1;
        books.push({
          type: '일반',
          title: '전자책',
          status: '대출가능'
        });
      }
    }

    // 대출가능 개수 계산 (소장형 + 구독형)
    availableCount = ownedCount + subscriptionCount;
    
    // 책 목록 생성
    books.length = 0; // 기존 배열 초기화
    
    // 소장형 책 추가
    for (let i = 0; i < ownedCount; i++) {
      books.push({
        type: '소장형',
        title: '소장형 전자책',
        status: '대출가능',
        current_borrow: 0,
        total_capacity: 1
      });
    }
    
    // 구독형 책 추가  
    for (let i = 0; i < subscriptionCount; i++) {
      books.push({
        type: '구독형',
        title: '구독형 전자책',
        status: '대출가능'
      });
    }

    const totalCount = ownedCount + subscriptionCount;
    const unavailableCount = 0; // 전자책은 기본적으로 모두 대출 가능

    console.log(`파싱 완료 - 총: ${totalCount}, 소장형: ${ownedCount}, 구독형: ${subscriptionCount}, 대출가능: ${availableCount}`);

    return {
      library_name: '경기도 전자도서관',
      total_count: totalCount,
      available_count: availableCount,
      unavailable_count: unavailableCount,
      owned_count: ownedCount,
      subscription_count: subscriptionCount,
      books: books
    };

  } catch (error) {
    console.error(`경기도 전자도서관 파싱 오류: ${error.message}`);
    throw new Error(`경기도 전자도서관 파싱 오류: ${error.message}`);
  }
}

// 새로운 API 기반 파싱 함수 (실제 사용)
function parseGyeonggiEbookApiResponseNew(apiResponse, searchText) {
  try {
    console.log('경기도 전자도서관 API 응답 파싱 시작');
    
    // API 응답 구조 확인
    if (!apiResponse || apiResponse.httpStatus !== 'OK' || !apiResponse.data) {
      console.log('API 응답이 올바르지 않음:', apiResponse);
      return {
        library_name: '경기도 전자도서관',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        owned_count: 0,
        subscription_count: 0,
        books: []
      };
    }

    const contents = apiResponse.data.contents || [];
    console.log(`검색 결과: ${contents.length}권 발견`);
    
    if (contents.length === 0) {
      console.log('검색 결과 없음');
      return {
        library_name: '경기도 전자도서관',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        owned_count: 0,
        subscription_count: 0,
        books: []
      };
    }

    let totalOwned = 0;
    let totalSubscription = 0;
    let totalAvailable = 0;
    const books = [];

    // 각 책의 정보를 파싱
    contents.forEach((book, index) => {
      console.log(`책 ${index + 1}: ${book.TITLE}`);
      console.log(`  - 콘텐츠 타입: ${book.CONTENT_TYPE_DESC || 'N/A'}`);
      console.log(`  - 총 권수(COPYS): ${book.COPYS || 'N/A'}`);
      console.log(`  - 대출중(LOAN_CNT): ${book.LOAN_CNT || 'N/A'}`);
      console.log(`  - 대출가능(LOANABLE): ${book.LOANABLE || 'N/A'}`);
      
      const totalCopies = parseInt(book.COPYS || 0, 10);
      const loanCount = parseInt(book.LOAN_CNT || 0, 10);
      const loanable = parseInt(book.LOANABLE || 0, 10);
      const contentTypeDesc = book.CONTENT_TYPE_DESC || '소장형';
      
      // 대출 가능한 권수 계산: 총 권수 - 대출중인 권수
      // LOANABLE은 현재 대출 가능 여부이므로, 총 보유량은 항상 계산해야 함
      const availableCopies = Math.max(0, totalCopies - loanCount);
      
      console.log(`  계산된 대출가능: ${availableCopies}권`);
      
      // 타입별로 분류 (총 권수는 항상 추가, 대출가능 권수는 따로)
      if (contentTypeDesc.includes('소장형') || contentTypeDesc === '소장형') {
        totalOwned += totalCopies;
      } else if (contentTypeDesc.includes('구독형')) {
        totalSubscription += totalCopies;
      } else {
        // 기본적으로 소장형으로 처리
        totalOwned += totalCopies;
      }
      
      // 대출 가능한 권수는 별도로 계산
      totalAvailable += availableCopies;

      books.push({
        type: contentTypeDesc,
        title: book.TITLE || book.TITLE_N || '전자책',
        author: book.AUTHOR || book.AUTHOR_N || '',
        publisher: book.PUBLISHER || book.PUBLISHER_N || '',
        isbn: book.ISBN || '',
        status: loanable === 1 ? '대출가능' : '대출불가',
        total_copies: totalCopies,
        loan_count: loanCount,
        available_copies: availableCopies,
        loanable: loanable === 1
      });
    });

    const totalCount = totalOwned + totalSubscription;
    const unavailableCount = totalCount - totalAvailable;

    console.log(`파싱 완료:`);
    console.log(`  총 권수: ${totalCount}`);
    console.log(`  소장형: ${totalOwned}`);
    console.log(`  구독형: ${totalSubscription}`);
    console.log(`  대출가능: ${totalAvailable}`);
    console.log(`  대출불가: ${unavailableCount}`);

    return {
      library_name: '경기도 전자도서관',
      total_count: totalCount,
      available_count: totalAvailable,
      unavailable_count: unavailableCount,
      owned_count: totalOwned,
      subscription_count: totalSubscription,
      books: books
    };

  } catch (error) {
    console.error(`경기도 전자도서관 API 파싱 오류: ${error.message}`);
    throw new Error(`경기도 전자도서관 API 파싱 오류: ${error.message}`);
  }
}
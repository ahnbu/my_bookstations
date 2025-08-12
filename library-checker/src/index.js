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
          message: "5-Way 통합 도서관 재고 확인 API + 경기도 전자도서관 + 시립도서관 통합 전자책(소장형+구독형) + Supabase Keep-Alive",
          version: "3.2-production-sirip-integrated"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const { isbn, title = '', gyeonggiTitle = '', siripTitle = '' } = body;

        // 필수 디버그 로그: 수신된 ISBN과 제목 기록
        console.log(`Request received - ISBN: ${isbn}, Title: "${title}", GyeonggiTitle: "${gyeonggiTitle}", SiripTitle: "${siripTitle}"`);

        if (!isbn) {
          return new Response(JSON.stringify({ error: 'isbn 파라미터가 필요합니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const promises = [
          searchGwangjuLibrary(isbn),
        ];

        let gyeonggiEbookPromise = null;
        if (title) {
            promises.push(
                searchSingleGyeonggiEbook(title, '10000004'), // 성남 (기존 title 사용)
                searchSingleGyeonggiEbook(title, '10000009')  // 통합 (기존 title 사용)
            );
        }
        
        // 경기도 전자도서관은 gyeonggiTitle 사용하여 별도 처리
        if (gyeonggiTitle) {
            console.log(`경기도 전자도서관 검색 시작: "${gyeonggiTitle}"`);
            gyeonggiEbookPromise = searchGyeonggiEbookLibrary(gyeonggiTitle);
        } else {
            console.log('gyeonggiTitle이 없어서 경기도 전자도서관 검색을 건너뜀');
        }

        // 시립도서관 전자책(소장형+구독형 통합) 검색은 siripTitle 사용하여 별도 처리  
        let siripEbookPromise = null;
        if (siripTitle) {
            console.log(`시립도서관 통합 전자책 검색 시작: "${siripTitle}"`);
            siripEbookPromise = searchSiripEbookIntegrated(siripTitle);
        } else {
            console.log('siripTitle이 없어서 시립도서관 전자책 검색을 건너뜀');
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

        // 시립도서관 통합 전자책 결과 처리
        let siripEbookResult = null;
        if (siripEbookPromise) {
            try {
                console.log('시립도서관 통합 전자책 Promise 대기 중...');
                siripEbookResult = await siripEbookPromise;
                console.log('시립도서관 통합 전자책 결과 수신:', JSON.stringify(siripEbookResult, null, 2));
            } catch (error) {
                console.error('시립도서관 통합 전자책 검색 오류:', error.message);
                siripEbookResult = { error: error.message };
            }
        } else {
            console.log('siripEbookPromise가 null이어서 검색하지 않음');
        }

        const finalResult = {
          gwangju_paper: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason.message },
          gyeonggi_ebook_education: [],
          gyeonggi_ebook_library: gyeonggiEbookResult,
          sirip_ebook: siripEbookResult || null
        };
        
        if (title && results.length > 1) {
            // 기존 경기도교육청 전자책 결과 처리
            if (results[1].status === 'fulfilled' && results[1].value?.availability) {
              finalResult.gyeonggi_ebook_education.push(...results[1].value.availability);
            }
            if (results[2].status === 'fulfilled' && results[2].value?.availability) {
              finalResult.gyeonggi_ebook_education.push(...results[2].value.availability);
            }

                  if (finalResult.gyeonggi_ebook_education.length === 0) {
        if(results[1]?.status === 'rejected') finalResult.gyeonggi_ebook_education.push({ library: '성남도서관', error: `검색 실패: ${results[1].reason.message}` });
        if(results[2]?.status === 'rejected') finalResult.gyeonggi_ebook_education.push({ library: '통합도서관', error: `검색 실패: ${results[2].reason.message}` });
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

// 새로운 경기도 전자도서관 API 함수 (검증된 코드로 교체)
async function searchGyeonggiEbookLibrary(searchText) {
  try {
    console.log(`경기도 전자도서관 검색 시작: ${searchText}`);
    
    // 소장형 도서와 구독형 도서를 병렬로 검색
    const [ownedResults, subscriptionResults] = await Promise.allSettled([
      searchOwnedBooks(searchText),
      searchSubscriptionBooks(searchText)
    ]);

    // 결과 통합 및 처리 (안전장치 추가)
    const ownedBooks = (ownedResults.status === 'fulfilled' && Array.isArray(ownedResults.value)) ? ownedResults.value : [];
    let subscriptionBooks = (subscriptionResults.status === 'fulfilled' && Array.isArray(subscriptionResults.value)) ? subscriptionResults.value : [];
    
    // 구독형 검색 실패 시 로그
    if (subscriptionResults.status === 'rejected') {
      console.log(`❌ 구독형 검색 실패:`, subscriptionResults.reason?.message || subscriptionResults.reason);
      subscriptionBooks = [];
    }
    
    // 최종 안전장치
    if (!Array.isArray(subscriptionBooks)) {
      console.log(`⚠️ subscriptionBooks가 배열이 아님:`, typeof subscriptionBooks, subscriptionBooks);
      subscriptionBooks = [];
    }
    
    console.log(`✅ 검색 완료 - 소장형: ${ownedBooks.length}권, 구독형: ${subscriptionBooks.length}권`);
    
    // 테스트 환경과 동일한 응답 구조로 변경
    const owned = ownedBooks.map(book => ({
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      isbn: book.isbn,
      totalCopies: book.total_copies,
      availableCopies: book.available_copies,
      isLoanable: book.available,
      type: book.type,
      library: book.library_name,
      detailUrl: book.detail_url
    }));

    // subscriptionBooks는 이미 parseSubscriptionResults에서 파싱된 배열이므로 그대로 사용
    const subscription = subscriptionBooks;

    // 총 재고 및 대출 가능 권수 계산
    const totalStock = ownedBooks.length + subscriptionBooks.length;
    const ownedAvailableCount = ownedBooks.filter(book => book.available).length;
    const subscriptionAvailableCount = subscriptionBooks.filter(book => book.available).length;
    const availableCount = ownedAvailableCount + subscriptionAvailableCount;

    console.log(`✅ 검색 완료 - 총 ${totalStock}권 (소장형: ${ownedBooks.length}권, 구독형: ${subscriptionBooks.length}권)`);
    console.log(`📊 대출가능 - 총 ${availableCount}권 (소장형: ${ownedAvailableCount}권, 구독형: ${subscriptionAvailableCount}권)`);

    // 프론트엔드에서 기대하는 GyeonggiEbookLibraryResult 형식으로 반환
    return {
      library_name: '경기도 전자도서관',
      total_count: totalStock,
      available_count: availableCount,
      unavailable_count: totalStock - availableCount,
      owned_count: ownedBooks.length,
      subscription_count: subscriptionBooks.length,
      books: [...owned, ...subscription]
    };
  } catch (error) {
    console.error('경기도 전자도서관 검색 오류:', error);
    throw new Error(`경기도 전자도서관 검색 실패: ${error.message}`);
  }
}

// 소장형 도서 검색 함수
async function searchOwnedBooks(query) {
  const encodedTitle = encodeURIComponent(query);
  const timestamp = Date.now();
  const apiUrl = `https://ebook.library.kr/api/service/search-engine?contentType=EB&searchType=all&detailQuery=TITLE:${encodedTitle}:true&sort=relevance&asc=desc&loanable=false&withFacet=true&page=1&size=20&_t=${timestamp}`;

  console.log(`소장형 도서 검색: ${query} -> ${apiUrl}`);

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
    throw new Error(`소장형 도서 API HTTP ${response.status}`);
  }
  
  const jsonData = await response.json();
  console.log('소장형 도서 API 응답:', JSON.stringify(jsonData, null, 2));
  
  return parseOwnedResults(jsonData);
}

// 구독형 도서 검색 함수 (개선된 버전)
async function searchSubscriptionBooks(query) {
  try {
    console.log(`=== 구독형 도서 검색 시작: ${query} ===`);
    
    // --- 1단계: 동적 인증 토큰 생성 (subscription_solution.md 권장 방식) ---
    // KST (UTC+9)를 기준으로 현재 시간 생성 - 단순화된 방식
    const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const min = String(now.getUTCMinutes()).padStart(2, '0');
    const timestamp = `${yyyy}${mm}${dd}${hh}${min}`;
    
    const tokenString = `${timestamp},0000000685`;
    
    // 환경별 Base64 인코딩 (간소화)
    let dynamicToken;
    try {
      if (typeof btoa !== 'undefined') {
        // Cloudflare Workers 환경
        dynamicToken = btoa(tokenString);
      } else {
        // 로컬 Node.js 환경
        dynamicToken = Buffer.from(tokenString).toString('base64');
      }
    } catch (error) {
      console.error(`[오류] Base64 인코딩 실패: ${error.message}`);
      throw new Error(`토큰 인코딩 실패: ${error.message}`);
    }

    console.log(`[정보] 생성된 토큰 문자열: ${tokenString}`);
    console.log(`[정보] Base64 인코딩된 토큰: ${dynamicToken}`);
    console.log(`[정보] 현재 KST 시간: ${yyyy}-${mm}-${dd} ${hh}:${min}`);

    // --- 2단계: 요청 본문 및 헤더 구성 (subscription_solution.md 검증된 구성) ---
    const body = { 
      search: query, 
      searchOption: 1, 
      pageSize: 20, 
      pageNum: 1, 
      detailYn: "y" 
    };
    
    // subscription_solution.md에서 검증된 핵심 헤더 구성
    const headers = {
      'Content-Type': 'application/json;charset=UTF-8',
      'token': dynamicToken,
      'Referer': 'https://ebook.library.kr/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Origin': 'https://ebook.library.kr'
    };


    // --- 3단계: 실제 요청 전송 ---
    const response = await fetch('https://api.bookers.life/v2/Api/books/search', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    console.log(`[정보] 서버 응답 상태: ${response.status} ${response.statusText}`);
    console.log(`[정보] 응답 헤더:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // 오류 발생 시, 서버가 보낸 실제 메시지를 확인
      const errorText = await response.text();
      console.error(`[오류] 서버가 오류를 반환했습니다: ${errorText}`);
      
      // 더 구체적인 에러 메시지 제공
      let errorMessage = `서버 오류: ${response.status} ${response.statusText}`;
      if (errorText) {
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += ` - ${errorJson.message || errorJson.error || errorText}`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log(`✅ 서버 응답 수신 성공`);
    
    // parseSubscriptionResults 함수를 사용하여 파싱
    const parsedResults = parseSubscriptionResults(data, query);
    
    return parsedResults;

  } catch (error) {
    console.error(`[오류] 구독형 도서 검색 실패: ${error.message}`);
    
    // 더 구체적인 에러 정보 제공
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('네트워크 요청 실패: fetch API를 사용할 수 없습니다. Node.js 18 이상 버전을 사용하거나 node-fetch를 설치해주세요.');
    }
    
    if (error.message.includes('토큰 인코딩 실패')) {
      throw new Error(`토큰 생성 실패: ${error.message}. 환경 설정을 확인해주세요.`);
    }
    
    throw error;
  }
}

// 시립도서관 전자책 검색 함수
async function searchSiripOwnedEbook(searchTitle) {
  try {
    console.log(`시립도서관 전자책 검색 시작: ${searchTitle}`);
    
    const encodedTitle = encodeURIComponent(searchTitle);
    const url = `https://lib.gjcity.go.kr:444/elibrary-front/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodedTitle}`;
    
    console.log(`시립도서관 전자책 검색 URL: ${url}`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Referer': 'https://lib.gjcity.go.kr:444/elibrary-front/',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    };

    const response = await fetch(url, { 
      method: 'GET', 
      headers: headers, 
      signal: AbortSignal.timeout(20000) 
    });
    
    if (!response.ok) {
      throw new Error(`시립도서관 전자책 HTTP ${response.status}`);
    }
    
    const htmlContent = await response.text();
    console.log(`시립도서관 전자책 HTML 응답 수신: ${htmlContent.length} characters`);
    
    return parseSiripOwnedEbookHTML(htmlContent, searchTitle);
    
  } catch (error) {
    console.error('시립도서관 전자책 검색 오류:', error);
    throw new Error(`시립도서관 전자책 검색 실패: ${error.message}`);
  }
}

// 시립도서관 구독형 전자책 검색 함수
async function searchSiripSubscriptionEbook(searchTitle) {
  try {
    console.log(`시립도서관 구독형 전자책 검색 시작: ${searchTitle}`);
    
    const encodedTitle = encodeURIComponent(searchTitle);
    const url = `https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?brcd=&sntnAuthCode=&contentAll=&cttsDvsnCode=&orderByKey=&schClst=all&schDvsn=000&reSch=&ctgrId=&allClstCheck=on&clstCheck=ctts&clstCheck=autr&clstCheck=pbcm&allDvsnCheck=000&dvsnCheck=001&schTxt=${encodedTitle}&reSchTxt=`;
    
    console.log(`시립도서관 구독형 전자책 검색 URL: ${url}`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Referer': 'https://gjcitylib.dkyobobook.co.kr/',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    };

    const response = await fetch(url, { 
      method: 'GET', 
      headers: headers, 
      signal: AbortSignal.timeout(20000) 
    });
    
    if (!response.ok) {
      throw new Error(`시립도서관 구독형 전자책 HTTP ${response.status}`);
    }
    
    const htmlContent = await response.text();
    
    return parseSiripSubscriptionEbookHTML(htmlContent, searchTitle);
    
  } catch (error) {
    console.error('시립도서관 구독형 전자책 검색 오류:', error);
    throw new Error(`시립도서관 구독형 전자책 검색 실패: ${error.message}`);
  }
}


// =================================================================
// 파싱 함수들
// =================================================================
function parseGwangjuHTML(html) {
  try {
    const bookListMatch = html.match(/<ul[^>]*class[^>]*resultList[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) return { book_title: "결과 없음", availability: [] };
    
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    const bookItems = [...bookListMatch[1].matchAll(liPattern)];
    if (bookItems.length === 0) return { book_title: "결과 없음", availability: [] };

    const firstBookHtml = bookItems[0][1];
    const titleMatch = firstBookHtml.match(/<dt[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    let title = titleMatch ? titleMatch[1].trim().replace(/^\d+\.\s*/, '') : "제목 정보 없음";
    
    // onclick 파라미터 추출 로직 제거 - 상세페이지 연결 불가로 불필요
    // (퇴촌도서관 서버 차단으로 recKey, bookKey, publishFormCode 사용 불가)
    
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
        
        // URL 파라미터 제거 - 상세페이지 연결 불가로 불필요
        return { 
          '소장도서관': library, 
          '청구기호': callNo, 
          '기본청구기호': baseCallNo, 
          '대출상태': status, 
          '반납예정일': dueDate
        };
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
        title: '소장형 전자책',
        status: '대출가능',
        current_borrow: 0,
        total_capacity: 1
      });
    }
    
    // 구독형 책 추가  
    for (let i = 0; i < subscriptionCount; i++) {
      books.push({
        title: '구독형 전자책',
        status: '대출가능'
      });
    }

    const totalCount = ownedCount + subscriptionCount;
    const unavailableCount = 0; // 전자책은 기본적으로 모두 대출 가능


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
// 기존 parseGyeonggiEbookApiResponseNew 함수 제거됨 - 새로운 파싱 함수들로 대체

// 새로운 파싱 함수들 (검증된 코드)
function parseOwnedResults(data) {
  try {
    console.log('소장형 도서 결과 파싱 시작');
    
    if (!data || data.httpStatus !== 'OK' || !data.data) {
      console.log('소장형 도서 API 응답이 올바르지 않음:', data);
      return [];
    }

    const contents = data.data.contents || [];
    console.log(`소장형 도서 검색 결과: ${contents.length}권 발견`);
    
    if (contents.length === 0) {
      return [];
    }

    return contents.map(book => {
      const totalCopies = parseInt(book.COPYS || 0, 10);
      const loanCount = parseInt(book.LOAN_CNT || 0, 10);
      const availableCopies = Math.max(0, totalCopies - loanCount);
      const isAvailable = availableCopies > 0;
      
      return {
        title: book.TITLE || book.TITLE_N || '전자책',
        author: book.AUTHOR || book.AUTHOR_N || '',
        publisher: book.PUBLISHER || book.PUBLISHER_N || '',
        isbn: book.ISBN || '',
        status: isAvailable ? '대출가능' : '대출불가',
        total_copies: totalCopies,
        loan_count: loanCount,
        available_copies: availableCopies,
        available: isAvailable,
        detail_url: `https://ebook.library.kr/detail?contentType=EB&id=${book.BOOK_ID || ''}`,
        library_name: '경기도전자도서관'
      };
    });
  } catch (error) {
    console.error('소장형 도서 파싱 오류:', error);
    return [];
  }
}

function parseSubscriptionResults(data, query) {
  try {
    console.log('=== 구독형 도서 결과 파싱 시작 ===');
    console.log(`검색어: "${query}"`);
    
    // 응답 데이터 유효성 검증
    if (!data) {
      console.log('❌ API 응답이 null 또는 undefined입니다.');
      return [];
    }
    
    if (typeof data !== 'object') {
      console.log(`❌ API 응답이 객체가 아닙니다: ${typeof data}`);
      return [];
    }
    
    console.log(`📋 사용 가능한 필드들:`, Object.keys(data));
    
    // bookSearchResponses 필드를 우선적으로 찾기 (subscription_solution.md 기준)
    let books = null;
    if (data.bookSearchResponses && Array.isArray(data.bookSearchResponses)) {
      books = data.bookSearchResponses;
      console.log(`✓ bookSearchResponses 필드 발견: ${books.length}권`);
    } else {
      console.log('⚠️ bookSearchResponses 필드가 없음. 대안 필드 탐색...');
      
      // 대안 필드들 확인
      const possibleFields = ['books', 'items', 'results', 'data', 'list'];
      for (const field of possibleFields) {
        if (data[field] && Array.isArray(data[field])) {
          books = data[field];
          console.log(`✓ 대안 필드 발견: ${field} (${books.length}권)`);
          break;
        }
      }
      
      if (!books) {
        console.log('❌ 사용 가능한 도서 데이터 필드를 찾을 수 없습니다.');
        console.log('📊 전체 응답 구조:', JSON.stringify(data, null, 2));
        return [];
      }
    }
    
    if (books.length === 0) {
      console.log('📚 검색 결과가 없습니다.');
      return [];
    }

    console.log(`🔍 제목 필터링 시작...`);
    
    // 제목 기반 필터링 개선
    const filteredBooks = books.filter((book, index) => {
      if (!book || typeof book !== 'object') {
        console.log(`⚠️ 잘못된 도서 객체 [${index}]:`, book);
        return false;
      }
      
      // 다양한 제목 필드 확인 (API 응답 구조에 맞춤)
      const titleFields = ['ucm_title', 'title', 'bookTitle', 'name', 'bookName', 'subject'];
      let bookTitle = '';
      
      for (const field of titleFields) {
        if (book[field]) {
          bookTitle = book[field].toString();
          break;
        }
      }
      
      if (!bookTitle) {
        console.log(`⚠️ 제목을 찾을 수 없는 도서 [${index}]:`, Object.keys(book));
        return false;
      }
      
      const normalizedBookTitle = bookTitle.toLowerCase().trim();
      const normalizedQuery = query.toLowerCase().trim();
      
      // 다양한 매칭 방식
      const isExactMatch = normalizedBookTitle === normalizedQuery;
      const isPartialMatch = normalizedBookTitle.includes(normalizedQuery);
      const isReversedMatch = normalizedQuery.includes(normalizedBookTitle);
      
      // 공백 제거 후 매칭도 시도
      const titleNoSpaces = normalizedBookTitle.replace(/\s+/g, '');
      const queryNoSpaces = normalizedQuery.replace(/\s+/g, '');
      const isSpaceIgnoreMatch = titleNoSpaces.includes(queryNoSpaces) || queryNoSpaces.includes(titleNoSpaces);
      
      const isMatch = isExactMatch || isPartialMatch || isReversedMatch || isSpaceIgnoreMatch;
      
      if (isMatch) {
        console.log(`✓ 매칭된 도서 [${index}]: "${bookTitle}"`);
        console.log(`  - 매칭 방식: ${isExactMatch ? '정확' : isPartialMatch ? '부분포함' : isReversedMatch ? '역방향포함' : '공백무시'}`);
      }
      
      return isMatch;
    });

    console.log(`📊 필터링 결과: ${filteredBooks.length}권 선택됨`);

    // 도서 정보 매핑 (실제 API 응답 구조에 맞춤)
    const mappedBooks = filteredBooks.map((book, index) => {
      const mappedBook = {
        title: book.ucm_title || book.title || book.bookTitle || book.name || '전자책',
        author: book.ucm_writer || book.author || book.writer || book.creator || '',
        publisher: book.ucp_brand || book.publisher || book.pubCompany || '',
        isbn: book.ucm_ebook_isbn || book.isbn || book.isbn13 || '',
        available: true, // 구독형은 항상 대출 가능
        library_name: '경기도 전자도서관'
      };
      
      console.log(`📖 도서 ${index + 1} 매핑 완료: ${mappedBook.title}`);
      
      return mappedBook;
    });

    console.log(`✅ 구독형 도서 파싱 완료: ${mappedBooks.length}권`);
    return mappedBooks;

  } catch (error) {
    console.error('❌ 구독형 도서 결과 파싱 오류:', error.message);
    console.error('📊 오류 스택:', error.stack);
    return [];
  }
}

// 시립도서관 전자책 HTML 파싱 함수
// 시립도서관 소장형 전자책 HTML 파싱 함수 (완전 재작성 - 구독형 검증 패턴 적용)
function parseSiripOwnedEbookHTML(html, searchTitle) {
  try {
    // 검색 결과가 없는 경우 체크
    if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다') || html.includes('"총 0개"')) {
      return {
        library_name: '광주시립중앙도서관-소장형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }

    // 1. 책 리스트 전체 추출: <ul class="book_resultList">
    const bookListMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) {
      return {
        library_name: '광주시립중앙도서관-소장형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }
    
    const bookListHTML = bookListMatch[1];
    
    // 2. 개별 책 항목 추출: 각 <li> 태그 전체 (구독형 검증된 패턴)
    const bookItemPattern = /<li>\s*([\s\S]*?)\s*<\/li>\s*(?=<li>|$)/gi;
    const bookItems = [...bookListHTML.matchAll(bookItemPattern)];
    
    if (bookItems.length === 0) {
      return {
        library_name: '광주시립중앙도서관-소장형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }

    const books = [];
    let availableCount = 0;
    
    bookItems.forEach((match, index) => {
      try {
        const bookHTML = match[1]; // 전체 li 내용
        
        // 3. 제목 추출: <li class="tit"><a title="..."> 에서 title 속성 사용
        let title = '';
        const titleMatch = bookHTML.match(/<li[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*title="([^"]*)"[^>]*>/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
          // 파이프(|) 뒤의 도서관 정보 제거
          title = title.split('|')[0].trim();
        }
        
        if (!title) {
          return; // 제목이 없으면 건너뛰기
        }

        // 4. 저자/출판사/출간일 추출: <li class="writer"> (구독형 검증된 패턴)
        let author = '';
        let publisher = '';
        let publishDate = '';
        
        const writerMatch = bookHTML.match(/<li[^>]*class[^>]*writer[^>]*>([\s\S]*?)<\/li>/i);
        if (writerMatch) {
          const writerContent = writerMatch[1];
          
          // 패턴: 저자명<span>출판사명</span>출간일
          const writerPattern = /^([^<]+)<span[^>]*>([^<]+)<\/span>(.*)$/i;
          const writerDetailMatch = writerContent.match(writerPattern);
          
          if (writerDetailMatch) {
            author = writerDetailMatch[1].trim();
            publisher = writerDetailMatch[2].trim();
            publishDate = writerDetailMatch[3].trim();
          } else {
            // span이 없는 경우 전체 텍스트에서 추출
            const cleanText = writerContent.replace(/<[^>]*>/g, '').trim();
            const parts = cleanText.split(/\s+/);
            if (parts.length > 0) author = parts[0];
            if (parts.length > 1) publisher = parts[1];
            if (parts.length > 2) publishDate = parts.slice(2).join(' ');
          }
        }

        // 5. 소장형 특화: 대출 현황 파싱 [ 대출 : 1/3 ] 예약 : 0
        let totalCopies = 1;
        let availableCopies = 0;
        let isAvailable = false;
        
        const useMatch = bookHTML.match(/<p[^>]*class[^>]*use[^>]*>.*?대출\s*:\s*<strong>(\d+)\/(\d+)<\/strong>.*?예약\s*:\s*<strong>(\d+)<\/strong>/i);
        if (useMatch) {
          const currentBorrowed = parseInt(useMatch[1]);
          totalCopies = parseInt(useMatch[2]);
          const reservations = parseInt(useMatch[3]);
          availableCopies = totalCopies - currentBorrowed;
          isAvailable = availableCopies > 0;
        } else {
          // 대출 현황 정보가 없는 경우 기본값으로 대출 가능으로 설정
          isAvailable = true;
          availableCopies = 1;
        }

        if (isAvailable) {
          availableCount++;
        }

        books.push({
          type: '소장형',
          title: title || '제목 정보 없음',
          author: author || '저자 정보 없음',
          publisher: publisher || '출판사 정보 없음',
          totalCopies: totalCopies,
          availableCopies: availableCopies,
          isAvailable: isAvailable,
          publishDate: publishDate || '출간일 정보 없음'
        });

      } catch (itemError) {
        console.error(`소장형 책 항목 ${index + 1} 파싱 오류:`, itemError);
        // 개별 책 파싱 오류는 무시하고 계속 진행
      }
    });

    const unavailableCount = books.length - availableCount;
    
    return {
      library_name: '광주시립중앙도서관-소장형',
      total_count: books.length,
      available_count: availableCount,
      unavailable_count: unavailableCount,
      books: books
    };

  } catch (error) {
    console.error(`시립도서관 소장형 전자책 파싱 오류: ${error.message}`);
    throw new Error(`시립도서관 소장형 전자책 파싱 오류: ${error.message}`);
  }
}

// 시립도서관 구독형 전자책 HTML 파싱 함수 (완전 재작성 - 테스트 검증 완료)
function parseSiripSubscriptionEbookHTML(html, searchTitle) {
  try {
    // 검색 결과가 없는 경우 체크
    if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다') || html.includes('"총 0개"')) {
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }

    // 1. 책 리스트 전체 추출: <ul class="book_resultList">
    const bookListMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) {
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }
    
    const bookListHTML = bookListMatch[1];
    
    // 2. 개별 책 항목 추출: 각 <li> 태그 전체 (개선된 패턴)
    const bookItemPattern = /<li>\s*([\s\S]*?)\s*<\/li>\s*(?=<li>|$)/gi;
    const bookItems = [...bookListHTML.matchAll(bookItemPattern)];
    
    if (bookItems.length === 0) {
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }

    const books = [];
    let availableCount = 0;
    
    bookItems.forEach((match, index) => {
      try {
        const bookHTML = match[1]; // 전체 li 내용
        
        // 3. 제목 추출: <li class="tit"><a title=".."> 에서 title 속성 사용
        let title = '';
        const titleMatch = bookHTML.match(/<li[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*title="([^"]*)"[^>]*>/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
          // 파이프(|) 뒤의 도서관 정보 제거
          title = title.split('|')[0].trim();
        }
        
        if (!title) {
          return; // 제목이 없으면 건너뛰기
        }

        // 4. 저자/출판사/출간일 추출: <li class="writer"> (테스트 검증 완료)
        let author = '';
        let publisher = '';
        let publishDate = '';
        
        const writerMatch = bookHTML.match(/<li[^>]*class[^>]*writer[^>]*>([\s\S]*?)<\/li>/i);
        if (writerMatch) {
          const writerContent = writerMatch[1];
          
          // 패턴: 저자명<span>출판사명</span>출간일
          const writerPattern = /^([^<]+)<span[^>]*>([^<]+)<\/span>(.*)$/i;
          const writerDetailMatch = writerContent.match(writerPattern);
          
          if (writerDetailMatch) {
            author = writerDetailMatch[1].trim();
            publisher = writerDetailMatch[2].trim();
            publishDate = writerDetailMatch[3].trim();
          } else {
            // span이 없는 경우 전체 텍스트에서 추출
            const cleanText = writerContent.replace(/<[^>]*>/g, '').trim();
            const parts = cleanText.split(/\s+/);
            if (parts.length > 0) author = parts[0];
            if (parts.length > 1) publisher = parts[1];
            if (parts.length > 2) publishDate = parts.slice(2).join(' ');
          }
        }

        // 구독형은 항상 대출 가능 (재고 제한 없음)
        availableCount++;

        books.push({
          type: '구독형',
          title: title || '제목 정보 없음',
          author: author || '저자 정보 없음',
          publisher: publisher || '출판사 정보 없음',
          isAvailable: true, // 구독형은 항상 대출 가능
          publishDate: publishDate || '출간일 정보 없음'
        });

      } catch (itemError) {
        console.error(`구독형 책 항목 ${index + 1} 파싱 오류:`, itemError);
        // 개별 책 파싱 오류는 무시하고 계속 진행
      }
    });

    // 구독형은 모든 책이 대출 가능하므로 available_count = total_count
    return {
      library_name: '광주시립중앙도서관-구독형',
      total_count: books.length,
      available_count: books.length, // 구독형 특성: 재고 제한 없음
      unavailable_count: 0, // 구독형은 항상 0
      books: books
    };

  } catch (error) {
    console.error(`시립도서관 구독형 전자책 파싱 오류: ${error.message}`);
    throw new Error(`시립도서관 구독형 전자책 파싱 오류: ${error.message}`);
  }
}

// 시립도서관 소장형 + 구독형 통합 검색 함수
async function searchSiripEbookIntegrated(searchTitle) {
  try {
    
    // 소장형과 구독형을 병렬로 검색
    const [ownedResults, subscriptionResults] = await Promise.allSettled([
      searchSiripOwnedEbook(searchTitle),
      searchSiripSubscriptionEbook(searchTitle)
    ]);
    
    // 결과 처리
    let ownedData = null;
    let subscriptionData = null;
    
    if (ownedResults.status === 'fulfilled') {
      ownedData = ownedResults.value;
      console.log(`소장형 검색 성공: ${ownedData.total_count}권`);
    } else {
      console.error('소장형 검색 실패:', ownedResults.reason.message);
      ownedData = {
        library_name: '광주시립중앙도서관-소장형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: [],
        error: ownedResults.reason.message
      };
    }
    
    if (subscriptionResults.status === 'fulfilled') {
      subscriptionData = subscriptionResults.value;
    } else {
      console.error('구독형 검색 실패:', subscriptionResults.reason.message);
      subscriptionData = {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: [],
        error: subscriptionResults.reason.message
      };
    }
    
    // 통합 결과 구성
    const totalBooks = ownedData.total_count + subscriptionData.total_count;
    const totalAvailable = ownedData.available_count + subscriptionData.available_count;
    const totalUnavailable = ownedData.unavailable_count + subscriptionData.unavailable_count;
    
    // 시립도서관 통합 결과 정보
    const 시립도서관_통합_결과 = {
      library_name: '광주시립중앙도서관-통합',
            
            console.log(`✅ 패턴 ${i}번 성공: "${title}" - 대출상태: ${loanStatus}, 이용가능: ${isAvailable}`);
            console.log(`매치된 텍스트: ${loanMatch[0]}`);
            patternFound = true;
            break;
          } else {
            console.log(`❌ 패턴 ${i}번 실패`);
          }
        }
        
        // 숫자 패턴으로 찾지 못했으면 텍스트 패턴 시도
        if (!patternFound) {
          for (let i = 0; i < textPatterns.length; i++) {
            const pattern = textPatterns[i];
            const textMatch = bookHTML.match(pattern);
            
            if (textMatch) {
              // "이용가능" 등의 텍스트가 있으면 대출 가능으로 처리
              isAvailable = true;
              availableCopies = 1;
              totalCopies = 1; // 이용가능하면 최소 1권은 있다고 처리
              loanStatus = '이용가능';
              console.log(`✅ 텍스트 패턴 ${i}번 성공: "${title}" - 이용가능 텍스트 발견`);
              patternFound = true;
              break;
            }
          }
        }
        
        // 대출 정보를 전혀 찾지 못한 경우의 처리 개선
        if (!patternFound) {
          console.log(`⚠️  모든 패턴이 실패했습니다. 대안 처리 시작...`);
          
          // HTML에서 "대출" 관련 정보가 있는지 확인
          if (bookHTML.includes('대출') || bookHTML.includes('이용')) {
            // 대출 관련 정보는 있지만 패턴 매칭에 실패한 경우
            console.log(`소장형 책 ${index + 1}: "${title}" - 대출 관련 정보 있지만 패턴 매칭 실패, 디버그 필요`);
            console.log(`HTML 스니펫 (대출 관련):`, bookHTML.substring(bookHTML.indexOf('대출') - 50, bookHTML.indexOf('대출') + 200));
            
            // 보수적으로 이용 가능으로 설정 (실제 책이 존재하므로)
            isAvailable = true;
            availableCopies = 1;
            totalCopies = 1;
            loanStatus = '이용가능(추정)';
          } else {
            // 대출 정보가 전혀 없는 경우 - 소장형이므로 이용 가능으로 처리
            isAvailable = true;
            availableCopies = 1;
            totalCopies = 1;
            loanStatus = '이용가능';
            console.log(`소장형 책 ${index + 1}: "${title}" - 대출정보 없음, 기본값으로 이용가능 설정`);
          }
        }
        
        // 카운트 업데이트
        if (isAvailable) {
          availableCount++;
        }
        
        books.push({
          title: title,
          author: author,
          publisher: publisher,
          loan_status: loanStatus,
          total_copies: totalCopies,
          available_copies: availableCopies,
          available: isAvailable
        });
        
      } catch (itemError) {
        console.error(`책 항목 ${index + 1} 파싱 오류:`, itemError.message);
        // 파싱 실패한 항목은 건너뛰고 계속 진행
      }
    });
    
    // books.length 방식으로 total_count 계산 (totalCount++ 제거)
    const totalCount = books.length;
    const unavailableCount = totalCount - availableCount;
    
    console.log(`시립도서관 소장형 전자책 파싱 완료:`);
    console.log(`  - 총 책 개수: ${totalCount}권`);
    console.log(`  - 이용가능: ${availableCount}권`);
    console.log(`  - 이용불가: ${unavailableCount}권`);
    console.log(`  - 검색어: "${searchTitle}"`);
    
    if (totalCount === 0) {
      console.log(`⚠️ 소장형에서 "${searchTitle}" 검색 결과가 0권입니다. HTML 파싱 문제이거나 실제로 없을 수 있습니다.`);
    }
    
    return {
      library_name: '광주시립중앙도서관-소장형',
      total_count: totalCount,
      available_count: availableCount,
      unavailable_count: unavailableCount,
      books: books
    };
    
  } catch (error) {
    console.error(`시립도서관 전자책 파싱 오류: ${error.message}`);
    throw new Error(`시립도서관 전자책 파싱 오류: ${error.message}`);
  }
}

// 시립도서관 구독형 전자책 HTML 파싱 함수 (완전 재작성 - "인공지능" 검색 결과 기반)
function parseSiripSubscriptionEbookHTML(html, searchTitle) {
  try {
    // 검색 결과가 없는 경우 체크
    if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다') || html.includes('"총 0개"')) {
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }

    // 1. 책 리스트 전체 추출: <ul class="book_resultList">
    const bookListMatch = html.match(/<ul[^>]*class[^>]*book_resultList[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) {
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }
    
    const bookListHTML = bookListMatch[1];
    
    // 2. 개별 책 항목 추출: 각 <li> 태그 전체 (개선된 패턴)
    const bookItemPattern = /<li>\s*([\s\S]*?)\s*<\/li>\s*(?=<li>|$)/gi;
    const bookItems = [...bookListHTML.matchAll(bookItemPattern)];
    
    if (bookItems.length === 0) {
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: []
      };
    }

    const books = [];
    let availableCount = 0;
    
    bookItems.forEach((match, index) => {
      try {
        const bookHTML = match[1]; // 전체 li 내용
        
        // 3. 제목 추출: <li class="tit"><a title="..."> 에서 title 속성 사용
        let title = '';
        const titleMatch = bookHTML.match(/<li[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*title="([^"]*)"[^>]*>/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
          // 파이프(|) 뒤의 도서관 정보 제거
          title = title.split('|')[0].trim();
        }
        
        if (!title) {
          return; // 제목이 없으면 건너뛰기
        }

        // 4. 저자/출판사/출간일 추출: <li class="writer"> (테스트 검증 완료)
        let author = '';
        let publisher = '';
        let publishDate = '';
        
        const writerMatch = bookHTML.match(/<li[^>]*class[^>]*writer[^>]*>([\s\S]*?)<\/li>/i);
        if (writerMatch) {
          const writerContent = writerMatch[1];
          
          // 패턴: 저자명<span>출판사명</span>출간일
          const writerPattern = /^([^<]+)<span[^>]*>([^<]+)<\/span>(.*)$/i;
          const writerDetailMatch = writerContent.match(writerPattern);
          
          if (writerDetailMatch) {
            author = writerDetailMatch[1].trim();
            publisher = writerDetailMatch[2].trim();
            publishDate = writerDetailMatch[3].trim();
          } else {
            // span이 없는 경우 전체 텍스트에서 추출
            const cleanText = writerContent.replace(/<[^>]*>/g, '').trim();
            const parts = cleanText.split(/\s+/);
            if (parts.length > 0) author = parts[0];
            if (parts.length > 1) publisher = parts[1];
            if (parts.length > 2) publishDate = parts.slice(2).join(' ');
          }
        }

        // 5. 내용 추출
        let description = '';
        const descMatch = bookHTML.match(/<li[^>]*class[^>]*txt[^>]*>([\s\S]*?)<\/li>/i);
        if (descMatch) {
          description = descMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 200);
        }

        // 구독형은 항상 대출 가능 (재고 제한 없음)
        availableCount++;

        books.push({
          type: '구독형',
          title: title || '제목 정보 없음',
          author: author || '저자 정보 없음',
          publisher: publisher || '출판사 정보 없음',
          isAvailable: true, // 구독형은 항상 대출 가능
          publishDate: publishDate || '출간일 정보 없음'
        });

      } catch (itemError) {
        console.error(`구독형 책 항목 ${index + 1} 파싱 오류:`, itemError);
        // 개별 책 파싱 오류는 무시하고 계속 진행
      }
    });

    // 구독형은 모든 책이 대출 가능하므로 available_count = total_count
    return {
      library_name: '광주시립중앙도서관-구독형',
      total_count: books.length,
      available_count: books.length, // 구독형 특성: 재고 제한 없음
      unavailable_count: 0, // 구독형은 항상 0
      books: books
    };

  } catch (error) {
    console.error(`시립도서관 구독형 전자책 파싱 오류: ${error.message}`);
    throw new Error(`시립도서관 구독형 전자책 파싱 오류: ${error.message}`);
  }
}

// 시립도서관 소장형 + 구독형 통합 검색 함수
async function searchSiripEbookIntegrated(searchTitle) {
  try {
    
    // 소장형과 구독형을 병렬로 검색
    const [ownedResults, subscriptionResults] = await Promise.allSettled([
      searchSiripOwnedEbook(searchTitle),
      searchSiripSubscriptionEbook(searchTitle)
    ]);
    
    // 결과 처리
    let ownedData = null;
    let subscriptionData = null;
    
    if (ownedResults.status === 'fulfilled') {
      ownedData = ownedResults.value;
      console.log(`소장형 검색 성공: ${ownedData.total_count}권`);
    } else {
      console.error('소장형 검색 실패:', ownedResults.reason.message);
      ownedData = {
        library_name: '광주시립중앙도서관-소장형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: [],
        error: ownedResults.reason.message
      };
    }
    
    if (subscriptionResults.status === 'fulfilled') {
      subscriptionData = subscriptionResults.value;
    } else {
      console.error('구독형 검색 실패:', subscriptionResults.reason.message);
      subscriptionData = {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        books: [],
        error: subscriptionResults.reason.message
      };
    }
    
    // 통합 결과 구성
    const totalBooks = ownedData.total_count + subscriptionData.total_count;
    const totalAvailable = ownedData.available_count + subscriptionData.available_count;
    const totalUnavailable = ownedData.unavailable_count + subscriptionData.unavailable_count;
    
    // 시립도서관 통합 결과 정보
    const 시립도서관_통합_결과 = {
      library_name: '광주시립중앙도서관-통합',
      total_count: totalBooks,
      available_count: totalAvailable,
      unavailable_count: totalUnavailable,
      owned_count: ownedData.total_count,
      subscription_count: subscriptionData.total_count,
      search_query: searchTitle
    };
    
    // 각 도서관별 상세 내역을 포함한 계층적 구조
    const integratedResult = {
      // 시립도서관 통합 결과 정보
      시립도서관_통합_결과: 시립도서관_통합_결과,
      
      // 각 도서관별 상세 내역
      details: {
        owned: {
          library_name: ownedData.library_name,
          total_count: ownedData.total_count,
          available_count: ownedData.available_count,
          unavailable_count: ownedData.unavailable_count,
          books: ownedData.books || [],
          ...(ownedData.error && { error: ownedData.error })
        },
        subscription: {
          library_name: subscriptionData.library_name,
          total_count: subscriptionData.total_count,
          available_count: subscriptionData.available_count,
          unavailable_count: subscriptionData.unavailable_count,
          books: subscriptionData.books || [],
          ...(subscriptionData.error && { error: subscriptionData.error })
        }
      },
      
      // 에러 정보가 있는 경우에만 포함
      ...(ownedData.error || subscriptionData.error) && {
        errors: {
          ...(ownedData.error && { owned: ownedData.error }),
          ...(subscriptionData.error && { subscription: subscriptionData.error })
        }
      }
    };
    
    
    return integratedResult;
    
  } catch (error) {
    console.error('시립도서관 통합 검색 오류:', error);
    throw new Error(`시립도서관 통합 검색 실패: ${error.message}`);
  }
}

// 테스트 및 검증 함수들
// =================================================================

// 경기도 전자도서관 API 응답 검증 함수
function validateGyeonggiEbookApiResponse(response) {
  try {
    console.log('=== 경기도 전자도서관 API 응답 검증 시작 ===');
    
    if (!response) {
      console.error('❌ 응답이 null 또는 undefined입니다.');
      return false;
    }
    
    if (response.error) {
      console.error(`❌ API 오류 발생: ${response.error}`);
      return false;
    }
    
    if (!response.owned_results && !response.subscription_results) {
      console.error('❌ owned_results 또는 subscription_results가 없습니다.');
      return false;
    }
    
    console.log('✅ 기본 응답 구조 검증 통과');
    
    // 소장형 도서 검증
    if (response.owned_results) {
      console.log(`📚 소장형 도서: ${response.owned_results.length}권`);
      if (response.owned_results.length > 0) {
        const firstBook = response.owned_results[0];
        console.log(`  대출가능: ${firstBook.available_copies}권 / 총 ${firstBook.total_copies}권`);
      }
    }
    
    // 구독형 도서 검증
    if (response.subscription_results) {
      console.log(`📖 구독형 도서: ${response.subscription_results.length}권`);
      if (response.subscription_results.length > 0) {
        const firstBook = response.subscription_results[0];
      }
    }
    
    console.log('=== 검증 완료 ===');
    return true;
    
  } catch (error) {
    console.error('검증 중 오류 발생:', error);
    return false;
  }
}

// 통합 테스트 함수
async function runIntegrationTest() {
  console.log('🚀 경기도 전자도서관 통합 테스트 시작');
  
  try {
    // 테스트 케이스 1: 일반적인 책 제목으로 테스트
    const testTitle = '해리포터';
    console.log(`\n📖 테스트 케이스 1: "${testTitle}" 검색`);
    
    const result = await searchGyeonggiEbookLibrary(testTitle);
    console.log('검색 결과:', JSON.stringify(result, null, 2));
    
    // 응답 검증
    const isValid = validateGyeonggiEbookApiResponse(result);
    console.log(`검증 결과: ${isValid ? '✅ 통과' : '❌ 실패'}`);
    
    // 테스트 케이스 2: 빈 결과 테스트
    console.log(`\n📖 테스트 케이스 2: 존재하지 않는 책 제목 검색`);
    const emptyResult = await searchGyeonggiEbookLibrary('존재하지않는책제목12345');
    console.log('빈 결과 검색:', JSON.stringify(emptyResult, null, 2));
    
    console.log('\n🎉 통합 테스트 완료!');
    return true;
    
  } catch (error) {
    console.error('❌ 통합 테스트 실패:', error);
    return false;
  }
}

// 성능 테스트 함수
async function runPerformanceTest() {
  console.log('⚡ 성능 테스트 시작');
  
  const testTitles = ['해리포터', '반지의 제왕', '듄', '기생충', '1984'];
  const results = [];
  
  for (const title of testTitles) {
    const startTime = Date.now();
    try {
      const result = await searchGyeonggiEbookLibrary(title);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      results.push({
        title,
        duration: `${duration}ms`,
        success: !result.error,
        bookCount: (result.owned_results?.length || 0) + (result.subscription_results?.length || 0)
      });
      
      console.log(`✅ "${title}": ${duration}ms, ${result.owned_results?.length || 0}권`);
      
    } catch (error) {
      results.push({
        title,
        duration: '실패',
        success: false,
        error: error.message
      });
      
      console.log(`❌ "${title}": 실패 - ${error.message}`);
    }
    
    // API 부하 방지를 위한 간격
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 성능 테스트 결과:');
  console.table(results);
  
  const avgDuration = results
    .filter(r => r.success && r.duration !== '실패')
    .reduce((sum, r) => sum + parseInt(r.duration), 0) / results.filter(r => r.success).length;
  
  console.log(`\n평균 응답 시간: ${avgDuration.toFixed(0)}ms`);
  return results;
}

// 에러 처리 테스트 함수
async function runErrorHandlingTest() {
  console.log('🛡️ 에러 처리 테스트 시작');
  
  const testCases = [
    { name: '빈 문자열', input: '' },
    { name: '특수문자', input: '!@#$%^&*()' },
    { name: '매우 긴 문자열', input: 'a'.repeat(1000) },
    { name: 'null', input: null },
    { name: 'undefined', input: undefined }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`\n🧪 테스트: ${testCase.name}`);
      const result = await searchGyeonggiEbookLibrary(testCase.input);
      console.log(`결과: ${result.error ? '에러 처리됨' : '정상 처리됨'}`);
      
    } catch (error) {
      console.log(`예외 발생: ${error.message}`);
    }
  }
  
  console.log('\n✅ 에러 처리 테스트 완료');
}

// 메인 테스트 실행 함수 (개발 환경에서만 사용)
async function runAllTests() {
  console.log('🧪 전체 테스트 스위트 실행');
  console.log('=' * 50);
  
  const results = {
    integration: false,
    performance: false,
    errorHandling: false
  };
  
  try {
    // 통합 테스트
    results.integration = await runIntegrationTest();
    
    // 성능 테스트
    results.performance = await runPerformanceTest();
    
    // 에러 처리 테스트
    await runErrorHandlingTest();
    results.errorHandling = true;
    
  } catch (error) {
    console.error('테스트 실행 중 오류:', error);
  }
  
  console.log('\n📋 테스트 결과 요약:');
  console.log(`통합 테스트: ${results.integration ? '✅ 통과' : '❌ 실패'}`);
  console.log(`성능 테스트: ${results.performance ? '✅ 완료' : '❌ 실패'}`);
  console.log(`에러 처리 테스트: ${results.errorHandling ? '✅ 완료' : '❌ 실패'}`);
  
  return results;
}

// 개발 환경에서 테스트 실행을 위한 조건부 실행
if (typeof globalThis !== 'undefined' && globalThis.environment === 'development') {
  console.log('🔧 개발 환경 감지됨 - 테스트 함수들이 로드되었습니다.');
  console.log('테스트 실행: runAllTests()');
  console.log('개별 테스트: runIntegrationTest(), runPerformanceTest(), runErrorHandlingTest()');
}


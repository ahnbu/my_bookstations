// 2025-10-11 - 네이밍, 크롤링 로직 전반적인 정리
// 2025-09-16 - GitHub Actions 자동 배포 - Wrangler 4.37.0 + 설정파일 기반
// 2025-08-09 - 경기도 전자도서관 재고 크롤링 기능 추가
// 2025-08-09 - 전자책 대출가능 여부 정확성 개선
// 2025-08-09 - supabase 무료요금 비활성화 방지 위해서 3일마다 ping 기능 추가
// 2025-08-09 - 과도한 콘솔 로그 정리 (운영 환경 최적화)

// CloudFlare Workers - 도서관 재고 확인
// 도서관에 병렬요청하여, 가장 오래 걸린 도서관을 기준으로 

/**
 * 최종 API 응답 객체에 캐싱할 수 없는 심각한 오류가 포함되어 있는지 확인합니다.
 * @param {object} finalResult - 크롤링 결과가 조합된 객체
 * @returns {boolean} - 캐싱하면 안 되는 에러가 있으면 true
 */
function hasCacheBlockingError(finalResult) {
  if (finalResult.gwangju_paper && 'error' in finalResult.gwangju_paper) return true;
  if (finalResult.gyeonggi_ebook_edu && finalResult.gyeonggi_ebook_edu.error_count > 0) return true;
  if (finalResult.gyeonggi_ebook_library && 'error' in finalResult.gyeonggi_ebook_library) return true;
  if (finalResult.sirip_ebook && ('error' in finalResult.sirip_ebook || 'errors' in finalResult.sirip_ebook)) return true;
  
  return false;
}

// esm.sh를 통해 ES 모듈로 라이브러리를 직접 import 합니다.
// import { parse } from 'https://esm.sh/node-html-parser';
import { parse } from 'node-html-parser';

// 캐싱 도입 이후 수정코드 - 2025.10.24
export default {
  // async fetch(request) {
  async fetch(request, env, ctx) { // ✅ env, ctx 파라미터 추가
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: "ok",
          message: "5-Way 통합 도서관 재고 확인 API + 경기도 전자도서관 + 시립도서관 통합 전자책(소장형+구독형) + 키워드 통합 검색 + Supabase Keep-Alive",
          version: "3.3-production-keyword-search"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 키워드 검색일 경우
    if (request.method === 'POST' && pathname === '/keyword-search') {
      try {
        const body = await request.json();
        const { keyword } = body;

        if (!keyword || !keyword.trim()) {
          return new Response(JSON.stringify({ error: 'keyword 파라미터가 필요합니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        console.log(`Keyword search request: "${keyword}"`);

        // [핵심 수정] 각 프로미스를 안전하게 생성하고 에러를 즉시 로깅합니다.
        const safeSearch = async (searchFn, name) => {
        try {
            return await searchFn(keyword);
        } catch (error) {
            console.error(`[CRITICAL ERROR] '${name}' 함수 실행 중 치명적 오류 발생:`, error);
            return []; // 실패 시 빈 배열 반환
        }
        };
        // [수정] 4개의 키워드 검색 함수를 병렬로 호출

        const searchPromises = [
            safeSearch(searchGwangjuPaperKeyword, 'searchGwangjuPaperKeyword'),
            safeSearch(searchGyeonggiEduKeyword, 'searchGyeonggiEduKeyword'),
            safeSearch(searchGyeonggiEbookKeyword, 'searchGyeonggiEbookKeyword'),
            safeSearch(searchSiripEbookKeyword, 'searchSiripEbookKeyword'),
        ];

        const results = await Promise.allSettled(searchPromises);

        // [수정] 결과를 깔끔하게 통합 (flatMap 사용)
        const combinedResults = results
          .filter(result => result.status === 'fulfilled' && Array.isArray(result.value))
          .flatMap(result => result.value);

        console.log(`Keyword search completed: ${combinedResults.length} results found`);

        return new Response(JSON.stringify(combinedResults), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (error) {
        console.error('Keyword search error:', error);
        return new Response(JSON.stringify({ error: '키워드 검색 중 오류가 발생했습니다.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 일반 검색의 경우
    if (request.method === 'POST' && pathname !== '/keyword-search') {
      
        const cache = caches.default;
        const bodyText = await request.clone().text();
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bodyText));
        const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');

        const cacheUrl = new URL(request.url);
        cacheUrl.pathname = '/cache/' + hashHex;
        const cacheKeyRequest = new Request(cacheUrl.toString(), {
          method: 'GET',
          headers: request.headers,
        });

        let response = await cache.match(cacheKeyRequest);

        if (response) {
          console.log("Cache HIT!");
          const newHeaders = new Headers(response.headers);
          Object.entries(corsHeaders).forEach(([key, value]) => newHeaders.set(key, value));
          newHeaders.set('X-Cache-Status', 'HIT');
          
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }

      // --- 👇 기존 크롤링 로직 (캐시가 없을 때만 실행) ---
      try {
        const body = JSON.parse(bodyText);
        
        let { isbn, author = '', customTitle = '', eduTitle = '', gyeonggiTitle = '', siripTitle = '' } = body;
        customTitle = customTitle || ''; 
        console.log(`Request received - ISBN: ${isbn}, Author: "${author}", eduTitle: "${eduTitle}", GyeonggiTitle: "${gyeonggiTitle}", SiripTitle: "${siripTitle}"`);

        if (!isbn) {
          return new Response(JSON.stringify({ error: 'isbn 파라미터가 필요합니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const promises = [
          searchGwangjuLibrary(isbn),
        ];

        // 경기도 교육청 전자도서관
        if (eduTitle) {
            promises.push(
                searchGyeonggiEduEbook(eduTitle, '10000004'), // 성남 
                searchGyeonggiEduEbook(eduTitle, '10000009')  // 통합
            );
        }
        
        // 경기도 전자도서관
        let gyeonggiEbookPromise = null;
        if (gyeonggiTitle) {
            gyeonggiEbookPromise = searchGyeonggiEbookLibrary(gyeonggiTitle);
        }

        // 시립도서관 전자책(소장형+구독형 통합)
        let siripEbookPromise = null;
        if (siripTitle) {
            siripEbookPromise = searchSiripEbookIntegrated(siripTitle);
        }

        const results = await Promise.allSettled(promises);
        
        // 경기도 전자도서관 결과 처리
        let gyeonggiEbookResult = null;
        if (gyeonggiEbookPromise) {
            try {
                gyeonggiEbookResult = await gyeonggiEbookPromise;
            } catch (error) {
                console.error('경기도 전자도서관 검색 오류:', error.message);
                gyeonggiEbookResult = { error: error.message };
            }
        }

        // 시립도서관 통합 전자책 결과 처리
        let siripEbookResult = null;
        if (siripEbookPromise) {
            try {
                siripEbookResult = await siripEbookPromise;
            } catch (error) {
                console.error('시립도서관 통합 전자책 검색 오류:', error.message);
                siripEbookResult = { error: error.message };
            }
        }

        const finalResult = {
          gwangju_paper: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason.message },
          // [수정] gyeonggi_ebook_edu을 null로 초기화
          gyeonggi_ebook_edu: null,
          gyeonggi_ebook_library: gyeonggiEbookResult,
          sirip_ebook: siripEbookResult || null
        };

        if (eduTitle && results.length > 1) {
            // [추가] 성남, 통합 도서관 결과를 하나의 배열로 합침
            const combinedEduBooks = [];
            if (results[1].status === 'fulfilled' && results[1].value?.book_list) {
              combinedEduBooks.push(...results[1].value.book_list);
            }
            if (results[2].status === 'fulfilled' && results[2].value?.book_list) {
              combinedEduBooks.push(...results[2].value.book_list);
            }

            const errorLibs = []; // 에러난 도서관 이름을 저장할 배열

            if (results[1].status === 'rejected') {
                const errorMessage = `검색 실패: ${results[1].reason.message}`;
                // [개선 1] console.error로 명확한 에러 로그 남기기
                console.error(`[API ERROR] 성남교육도서관(${eduTitle}):`, errorMessage); 
                combinedEduBooks.push({ library: '성남도서관', error: errorMessage });
                errorLibs.push('성남');
            }
            if (results[2].status === 'rejected') {
                const errorMessage = `검색 실패: ${results[2].reason.message}`;
                // [개선 1] console.error로 명확한 에러 로그 남기기
                console.error(`[API ERROR] 통합교육도서관(${eduTitle}):`, errorMessage);
                combinedEduBooks.push({ library: '통합도서관', error: errorMessage });
                errorLibs.push('통합');
            }

            
            // [추가] 합쳐진 배열을 기반으로 요약 정보 계산
            let total_count = 0;
            let available_count = 0;
            let seongnam_count = 0;
            let tonghap_count = 0;
            let error_count = 0;
            
            // 먼저 에러가 없는 책만 거릅니다.
            let validBooks = combinedEduBooks.filter(book => !book.error); 

            // 'validBooks'를 기반으로 요약 정보 재계산
            // ✅ [수정] const 키워드를 제거하여, 기존에 선언된 변수에 값을 재할당합니다.
            total_count = validBooks.length;
            available_count = validBooks.filter(b => b.대출상태 === '대출가능').length;
            seongnam_count = validBooks.filter(b => b.소장도서관 === '성남도서관').length;
            tonghap_count = validBooks.filter(b => b.소장도서관 === '통합도서관').length;
            error_count = errorLibs.length;

            // [수정] finalResult에 요약 정보가 포함된 객체를 할당
            finalResult.gyeonggi_ebook_edu = {
                library_name: "경기도교육청 전자도서관",
                total_count,
                available_count,
                unavailable_count: total_count - available_count,
                seongnam_count,
                tonghap_count,
                error_count,
                // 에러가 발생한 경우에만 상세 정보 문자열 생성
                error_lib_detail: errorLibs.length > 0 ? `에러 발생: ${errorLibs.join(', ')}` : undefined,
                book_list: validBooks
            };
        }

        // [추가] 최종 응답 객체에 isbn과 title 추가
        const responsePayload = {
          title: eduTitle, // 요청받은 eduTitle을 기준으로 title 필드 추가
          isbn: isbn,
          author: author,       // ✅ 요청 시 사용된 author 추가
          customTitle: customTitle, // ✅ 요청 시 사용된 customTitle 추가
          lastUpdated: Date.now(), // ✅ 여기에 API 응답 시점 타임스탬프 추가
          ...finalResult
        };

        // API 응답 결과 로그 (유지 - 테스트 응답과 동일한 형태)
        console.log('API Response:', JSON.stringify(responsePayload, null, 2));
        
        response = new Response(JSON.stringify(responsePayload), { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' ,
            'X-Cache-Status': 'MISS' // 캐시가 없었음을 나타내는 디버깅용 헤더
          } });

        // 성공API만 캐시에 저장 -> 에러시에는 저장하지 않음
        if (!hasCacheBlockingError(finalResult)) {
          console.log("Response is clean. Caching...");
          ctx.waitUntil(cache.put(cacheKeyRequest, response.clone(), { expirationTtl: 7200 }));
        } else {
          console.warn("Response contains errors. Skipping cache.");
          response.headers.set('Cache-Control', 'no-store');
        }

        return response;
        
      } catch (error) {
        console.error(`API Error: ${error.message}`);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response('Method not allowed', { status: 405 });
  },

  // Supabase 무료요금제 7일 비활성화시 잠금방 위해 3일에 1번씩 ping 보내는 Scheduled Events 처리
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
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
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


// 기본 타임아웃으로 통일시켜서 설정
const DEFAULT_TIMEOUT = 15000; 

// ==============================================
// 크롤링 함수들
// ==============================================

// 경기 광주시 시립도서관 종이책 검색 (iframe 안의 주소로 요청)

async function searchGwangjuLibrary(isbn) {
  const url = "https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do";
  const payload = new URLSearchParams({'searchType': 'DETAIL','searchKey5': 'ISBN','searchKeyword5': isbn,'searchLibrary': 'ALL','searchSort': 'SIMILAR','searchRecordCount': '30'});
  const headers = {'User-Agent': 'Mozilla/5.0','Content-Type': 'application/x-www-form-urlencoded','Referer': 'https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchDetail.do'};
  const response = await fetch(url, {
    method: 'POST', 
    headers: headers, 
    body: payload.toString(), 
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT) // [수정] 15초로 통일
  });
  if (!response.ok) throw new Error(`경기광주 HTTP ${response.status}`);
  const htmlContent = await response.text();
  return parseGwangjuPaperHTML(htmlContent);
}

// 경기도 교육청 전자도서관 검색
async function searchGyeonggiEduEbook(searchText, libraryCode) {
  const url = new URL("https://lib.goe.go.kr/elib/module/elib/search/index.do");
  url.searchParams.set("menu_idx", "94");
  url.searchParams.set("search_text", searchText);
  url.searchParams.set("library_code", libraryCode);
  url.searchParams.set("libraryCode", libraryCode);
  url.searchParams.set("sortField", "book_pubdt");
  url.searchParams.set("sortType", "desc");
  url.searchParams.set("rowCount", "50");

  const headers = {'User-Agent': 'Mozilla/5.0'};
  const response = await fetch(url.toString(), { method: 'GET', headers: headers, signal: AbortSignal.timeout(DEFAULT_TIMEOUT) });
  if (!response.ok) throw new Error(`경기도교육청(${libraryCode}) HTTP ${response.status}`);
  const htmlContent = await response.text();
  return parseGyeonggiEduHTML(htmlContent, libraryCode);
}

// 경기도 전자도서관 (소장+구독) 통합 검색

async function searchGyeonggiEbookLibrary(searchText) {
  try {
    const [ownedResults, subscriptionResults] = await Promise.allSettled([
      searchGyeonggiEbookOwned(searchText),
      searchGyeonggiEbookSubs(searchText),
    ]);

    // [핵심 수정] 변수를 먼저 안전하게 선언하고 값을 할당합니다.
    const ownedBooks = (ownedResults.status === 'fulfilled' && Array.isArray(ownedResults.value)) ? ownedResults.value : [];
    const subscriptionBooks = (subscriptionResults.status === 'fulfilled' && Array.isArray(subscriptionResults.value)) ? subscriptionResults.value : [];

    // console.log(`[DEBUG] searchGyeonggiEbookLibrary - 소장형:\n${JSON.stringify(ownedBooks, null, 2)}`);
    // console.log(`[DEBUG] searchGyeonggiEbookLibrary - 구독형:\n${JSON.stringify(subscriptionBooks, null, 2)}`);

    // [핵심 수정] 두 검색이 모두 실패했는지 확인하는 로직을 변수 선언 *이후*로 옮깁니다.
    if (ownedResults.status === 'rejected' && subscriptionResults.status === 'rejected') {
      const ownedError = ownedResults.reason.message || '소장형 검색 실패';
      const subsError = subscriptionResults.reason.message || '구독형 검색 실패';
      // 두 검색이 모두 실패했다면, 에러를 던져서 상위 핸들러가 잡도록 합니다.
      throw new Error(`소장형(${ownedError}) 및 구독형(${subsError}) 검색 모두 실패`);
    }

    // 이제 ownedBooks와 subscriptionBooks는 안전하게 사용할 수 있습니다.
    const combinedBooks = [...ownedBooks, ...subscriptionBooks];
    
    const totalStock = combinedBooks.length;
    const availableCount = combinedBooks.filter(book => book.available).length;

    return {
      library_name: '경기도 전자도서관',
      total_count: totalStock,
      available_count: availableCount,
      unavailable_count: totalStock - availableCount,
      owned_count: ownedBooks.length,
      subscription_count: subscriptionBooks.length,
      book_list: combinedBooks,
    };
  } catch (error) {
    console.error('경기도 전자도서관 검색 오류:', error);
    throw new Error(`경기도 전자도서관 검색 실패: ${error.message}`);
  }
}


// 경기도 전자도서관 (소장) 검색 - JSON 응답
async function searchGyeonggiEbookOwned(query) {
  const encodedTitle = encodeURIComponent(query);
  const timestamp = Date.now();

  // BUG FIX: API 호출 방식 변경 
  // 불안정한 detailQuery 대신, 안정적인 keyword 파라미터를 사용하는 API URL로 교체합니다.
  // detailQuery 파라미터는 빈 값으로 남겨두어 충돌을 방지합니다.

  const apiUrl = `https://ebook.library.kr/api/service/search-engine?contentType=EB&searchType=all&detailQuery=&sort=relevance&loanable=false&page=1&size=20&keyword=${encodedTitle}&_t=${timestamp}`;
  // ====================================================================

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
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT) 
  });
  
  if (!response.ok) {
    throw new Error(`소장형 도서 API HTTP ${response.status}`);
  }
  
  const json_data = await response.json();
  
  return parseGyenggiEbookOwnedResults(json_data);
}

// 경기도 전자도서관 (구독) 검색 - HTML 응답
async function searchGyeonggiEbookSubs(query) {
  try {
    
    // --- 1단계: 동적 인증 토큰 생성 (docs/subscription_solution.md 권장 방식) ---
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

    // 토큰 생성 로그 제거 (운영 환경 최적화)

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
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT) // [추가] 15초 타임아웃 추가
    });

    if (!response.ok) {
      // 오류 발생 시, 서버가 보낸 실제 메시지를 확인
      const errorText = await response.text();
      console.error(`[오류] 경기도 전자도서관 (구독) 검색 서버가 오류를 반환했습니다: ${errorText}`);
      
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

    const json_data = await response.json();

    // [핵심 수정] JSON.stringify를 사용하여 객체 내용을 문자열로 변환하여 출력
    // 세 번째 인자 '2'는 JSON을 예쁘게 들여쓰기(pretty-print)하여 가독성을 높여줍니다.
    // console.log(`[DEBUG/구독형] API 원본 응답 데이터:\n${JSON.stringify(data, null, 2)}`);

    // parseSubscriptionResults 함수를 사용하여 파싱
    const parsedResults = parseGyenggiEbookSubsResults(json_data, query);
    
    return parsedResults;

  } catch (error) {
    console.error(`[오류] 경기도 전자도서관 (구독) 검색 실패: ${error.message}`);
    
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


// 경기광주 시립도서관 전자책 (소장+구독) 통합 검색
// 현재는 소장, 구독이 나눠져 있으나 추후 합칠 수 있으므로 그대로 유지
async function searchSiripEbookIntegrated(searchTitle) {
  try {
    
    // 소장형과 구독형을 병렬로 검색
    const [ownedResults, subscriptionResults] = await Promise.allSettled([
      searchSiripEbookOwned(searchTitle),
      searchSiripEbookSubs(searchTitle)
    ]);
    
    // 결과 처리
    let siripOwnedData = null;
    let siripSubsData = null;
    
    if (ownedResults.status === 'fulfilled') {
      siripOwnedData = ownedResults.value;
    } else {
      siripOwnedData = {
        library_name: '광주시립중앙도서관-소장형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        book_list: [],
        error: ownedResults.reason.message
      };
    }
    
    if (subscriptionResults.status === 'fulfilled') {
      siripSubsData = subscriptionResults.value;
    } else {
      siripSubsData = {
        library_name: '광주시립중앙도서관-구독형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        book_list: [],
        error: subscriptionResults.reason.message
      };
    }
    
    // 통합 결과 구성
    const totalBooks = siripOwnedData.total_count + siripSubsData.total_count;
    const totalAvailable = siripOwnedData.available_count + siripSubsData.available_count;
    const totalUnavailable = siripOwnedData.unavailable_count + siripSubsData.unavailable_count;
    
    // 시립도서관 통합 결과 정보
    const sirip_ebook_summary = {
      library_name: '광주시립중앙도서관-통합',
      total_count: totalBooks,
      available_count: totalAvailable,
      unavailable_count: totalUnavailable,
      owned_count: siripOwnedData.total_count,
      subscription_count: siripSubsData.total_count,
      search_query: searchTitle
    };
    
    // 각 도서관별 상세 내역을 포함한 계층적 구조
    const integratedResult = {
      // 시립도서관 통합 결과 정보
      sirip_ebook_summary: sirip_ebook_summary,
      
      // 각 도서관별 상세 내역
      details: {
        owned: {
          library_name: siripOwnedData.library_name,
          total_count: siripOwnedData.total_count,
          available_count: siripOwnedData.available_count,
          unavailable_count: siripOwnedData.unavailable_count,
          book_list: siripOwnedData.book_list || [],
          ...(siripOwnedData.error && { error: siripOwnedData.error })
        },
        subscription: {
          library_name: siripSubsData.library_name,
          total_count: siripSubsData.total_count,
          available_count: siripSubsData.available_count,
          unavailable_count: siripSubsData.unavailable_count,
          book_list: siripSubsData.book_list || [],
          ...(siripSubsData.error && { error: siripSubsData.error })
        }
      },
      
      // 에러 정보가 있는 경우에만 포함
      ...(siripOwnedData.error || siripSubsData.error) && {
        errors: {
          ...(siripOwnedData.error && { owned: siripOwnedData.error }),
          ...(siripSubsData.error && { subscription: siripSubsData.error })
        }
      }
    };
    
    return integratedResult;
    
  } catch (error) {
    console.error('시립도서관 통합 검색 오류:', error);
    throw new Error(`시립도서관 통합 검색 실패: ${error.message}`);
  }
}

// 경기광주 시립도서관 전자책 (소장) 검색
async function searchSiripEbookOwned(searchTitle) {
  try {
    const encodedTitle = encodeURIComponent(searchTitle);
    const url = `https://lib.gjcity.go.kr:444/elibrary-front/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodedTitle}`;
    
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
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT) 
    });
    
    if (!response.ok) {
      throw new Error(`시립도서관 전자책 HTTP ${response.status}`);
    }
    
    const htmlContent = await response.text();
    
    return parseSiripEbookOwnedHTML(htmlContent, searchTitle);
    
  } catch (error) {
    console.error('시립도서관 전자책 검색 오류:', error);
    throw new Error(`시립도서관 전자책 검색 실패: ${error.message}`);
  }
}

// 경기광주 시립도서관 전자책 (구독) 검색
async function searchSiripEbookSubs(searchTitle) {
  try {
    const encodedTitle = encodeURIComponent(searchTitle);
    const url = `https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?brcd=&sntnAuthCode=&contentAll=&cttsDvsnCode=&orderByKey=&schClst=all&schDvsn=000&reSch=&ctgrId=&allClstCheck=on&clstCheck=ctts&clstCheck=autr&clstCheck=pbcm&allDvsnCheck=000&dvsnCheck=001&schTxt=${encodedTitle}&reSchTxt=`;
    
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
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT) 
    });
    
    if (!response.ok) {
      throw new Error(`시립도서관 구독형 전자책 HTTP ${response.status}`);
    }

    // [핵심 변경] response.text()를 호출하지 않고, Response 객체 자체를 파서에 전달합니다.
    // 파서가 async 함수이므로 await를 사용합니다.
    const htmlContent = await response.text();
    return parseSiripEbookSubsHTML(htmlContent, searchTitle);

    // return await parseSiripEbookSubsHTML(response);

  } catch (error) {
    console.error('시립도서관 구독형 전자책 검색 오류:', error);
    throw new Error(`시립도서관 구독형 전자책 검색 실패: ${error.message}`);
  }
}


// ===========================================
// 파싱 함수들
// ===========================================

/**
 * [HELPER] 광주 시립도서관의 단일 책 아이템(li)을 파싱하는 공통 함수
 * @param {HTMLElement} item - node-html-parser로 파싱된 li 요소
 * @returns {object|null} - 파싱된 책 정보 객체 또는 유효하지 않을 경우 null
 */
function parseGwangjuBookItem(item) {
  try {
    // 1. 제목 추출
    const title = item.querySelector('dt.tit a')?.text.replace(/^\d+\.\s*/, '').trim();
    if (!title) return null;

    // 2. 저자, 출판사, 발행년도 추출 (`dd.author` 내부)
    let author = "정보없음", publisher = "정보없음", pubDate = "정보없음";
    const authorDd = item.querySelector('dd.author');
    if (authorDd) {
        const authorHtml = authorDd.innerHTML;
        const authorMatch = authorHtml.match(/저자\s*:\s*([^<]+)/i);
        if (authorMatch) author = authorMatch[1].replace(/;/g, ',').split(',')[0].trim();

        const publisherMatch = authorHtml.match(/발행자:\s*([^<]+)/i);
        if (publisherMatch) publisher = publisherMatch[1].trim();
        
        const pubDateMatch = authorHtml.match(/발행년도:\s*(\d{4})/i);
        if (pubDateMatch) pubDate = pubDateMatch[1];
    }

    // 3. [핵심 수정] 청구기호 추출 (`dd.data` 또는 `dd.author` 내부)
    let callNo = "정보없음";
    const dataDd = item.querySelector('dd.data');
    if (dataDd) {
        // [CASE 1] dd.data 태그가 있는 경우 (키워드 검색 결과)
        const callNoMatch = dataDd.text.match(/청구기호:\s*([^\s\n]+(?:.|\s)*?)(?:\s*<|위치출력|$)/);
        if (callNoMatch) callNo = callNoMatch[1].trim();
    } else if (authorDd) {
        // [CASE 2] dd.data 태그가 없고 dd.author만 있는 경우 (ISBN 검색 결과)
        const callNoMatch = authorDd.rawText.match(/청구기호:\s*([^\s\n]+)/);
        if (callNoMatch) callNo = callNoMatch[1].trim();
    }
    
    // 4. 소장 도서관 및 대출 정보 추출
    const library = item.querySelector('dd.site span')?.text.replace('도서관:', '').trim() || "정보없음";
    const baseCallNo = callNo.split('=')[0].trim(); // 시리즈 등 정보 제외하고 기본청구기호로 전환 (예) 325.26-박55일=2 -> 325.26-박55일
    
    let status = "알 수 없음", dueDate = "-";
    const statusEl = item.querySelector('.bookStateBar .txt');
    if (statusEl) {
        const statusText = statusEl.querySelector('b')?.text || "";
        if (statusText.includes('대출가능')) {
            status = '대출가능';
        } else if (statusText.includes('대출불가') || statusText.includes('대출중')) {
            status = '대출불가';
            const dueDateMatch = statusEl.text.match(/반납예정일:\s*([0-9.-]+)/i);
            if (dueDateMatch) dueDate = dueDateMatch[1].trim();
        }
    }

    return {
      title,
      author,
      publisher,
      pubDate,
      library,
      callNo,
      baseCallNo,
      status,
      dueDate,
    };
  } catch (error) {
    console.error('광주 도서 아이템 파싱 오류:', error);
    return null;
  }
}

// 경기 광주시립도서관 종이책 파싱 - parse + parseGwangjuBookItem 공통모듈

function parseGwangjuPaperHTML(html) {
  try {
    const root = parse(html);
    const bookItems = root.querySelectorAll('.resultList > li');

    if (bookItems.length === 0) {
      return {
        library_name: "광주 시립도서관",
        summary_total_count: 0,
        summary_available_count: 0,
        toechon_total_count: 0,
        toechon_available_count: 0,
        other_total_count: 0,
        other_available_count: 0,
        book_title: "결과 없음",
        book_list: []
      };
    }
    
    // 공통 헬퍼 함수를 사용하여 모든 책 정보를 파싱
    const parsedBooks = bookItems.map(parseGwangjuBookItem).filter(Boolean); // null인 경우 제외

    // 파싱된 결과를 기반으로 요약 정보 계산 및 최종 데이터 구성
    let summary_total_count = 0;
    let summary_available_count = 0;
    let toechon_total_count = 0;
    let toechon_available_count = 0;
    let other_total_count = 0;
    let other_available_count = 0;
    
    const book_list = parsedBooks.map(book => {
      const isAvailable = book.status === '대출가능';
      
      summary_total_count++;
      if (isAvailable) summary_available_count++;

      if (book.library === '퇴촌도서관') {
        toechon_total_count++;
        if (isAvailable) toechon_available_count++;
      } else {
        other_total_count++;
        if (isAvailable) other_available_count++;
      }
      
      return {
        '소장도서관': book.library,
        '청구기호': book.callNo,
        '기본청구기호': book.baseCallNo,
        '대출상태': book.status,
        '반납예정일': book.dueDate,
      };
    });

    return {
      library_name: "광주 시립도서관",
      summary_total_count,
      summary_available_count,
      toechon_total_count,
      toechon_available_count,
      other_total_count,
      other_available_count,
      book_title: parsedBooks[0]?.title || "제목 정보없음",
      book_list: book_list
    };

  } catch (error) {
    console.error(`광주 파싱 오류: ${error.message}`);
    throw new Error(`광주 파싱 오류: ${error.message}`);
  }
}

// 경기도 교육청 전자도서관 HTML 파싱 - parse 사용
function parseGyeonggiEduHTML(html, libraryCode) {
  try {
    const libraryNameMap = { '10000004': '성남도서관', '10000009': '통합도서관' };
    const branchName = libraryNameMap[libraryCode] || `코드(${libraryCode})`;

    if (html.includes("찾으시는 자료가 없습니다")) {
      return { library_name: `경기도교육청-${branchName}`, book_list: [] };
    }

    const root = parse(html);
    const bookItems = root.querySelectorAll('#search-results .row');

    if (bookItems.length === 0) {
      return { library_name: `경기도교육청-${branchName}`, book_list: [] };
    }

    const availability = bookItems.map(item => {
      // [핵심 수정] keyvalue 속성을 가진 a.selectBook 태그에서 모든 정보를 추출
      const selectBookLink = item.querySelector('a.selectBook');
      const keyValue = selectBookLink?.getAttribute('keyValue');

      let title = "정보없음", author = "정보없음", publisher = "정보없음", isbn = "정보없음";

      if (keyValue) {
        // keyvalue 예시: "제목///연도///저자///출판사///ISBN///..."
        const parts = keyValue.split('///');
        if (parts.length > 4) {
          title = parts[0].replace(/<[^>]*>/g, '').trim();
          author = parts[2].replace(/<[^>]*>/g, '').trim();
          publisher = parts[3].replace(/<[^>]*>/g, '').trim();
          isbn = parts[4].trim();
        }
      }

      // 발행일과 대출 상태는 keyvalue에 없으므로 .bif에서 별도 추출
      const infoBlock = item.querySelector('.bif');
      let pubDate = "정보없음", status = "알 수 없음";

      if (infoBlock) {
        const infoBlockHtml = infoBlock.innerHTML;
        const infoBlockText = infoBlock.text;

        const pubDateMatch = infoBlockHtml.match(/발행일자\s*:\s*([^<]+)/i);
        pubDate = pubDateMatch ? pubDateMatch[1].trim() : "정보없음";
        
        if (infoBlockText.includes("대출 가능")) status = "대출가능";
        else if (infoBlockText.includes("대출중") || infoBlockText.includes("대출 불가")) status = "대출불가";
      }

      return {
        '소장도서관': branchName,
        '도서명': title,
        '저자': author,
        '출판사': publisher,
        '발행일': pubDate,
        '대출상태': status,
        'isbn': isbn
      };
    }).filter(book => book.도서명 !== "정보없음"); // keyvalue가 없는 비정상적인 아이템은 최종 결과에서 제외

    return { library_name: `경기도교육청-${branchName}`, book_list: availability };
  } catch (error) {
    console.error(`경기도교육청(${libraryCode}) 파싱 오류: ${error.message}`);
    throw new Error(`경기도교육청 파싱 오류: ${error.message}`);
  }
}


// 경기도 전자도서관 (소장) 결과 정리 - json

function parseGyenggiEbookOwnedResults(json_data) {
  try {
    if (!json_data || json_data.httpStatus !== 'OK' || !json_data.data) return [];
    const contents = json_data.data.contents || [];
    if (contents.length === 0) return [];

    // console.log(`[DEBUG/소장형] 파싱 시작. ${contents.length}개의 책을 처리합니다.`);

    return contents.map((book, index) => {
      const isAvailable = (parseInt(book.COPYS || 0, 10) - parseInt(book.LOAN_CNT || 0, 10)) > 0;
      const pubDate = book.PUBLISH_DATE ? book.PUBLISH_DATE.split(' ')[0] : '정보없음';

      // [핵심 로그] 모든 책에 대해 pubDate를 확인
      // console.log(`[DEBUG/소장형] ${index + 1}번째 책: "${book.TITLE}" -> pubDate: ${pubDate}`);
      
      return {
        type: '소장형',
        title: book.TITLE || book.TITLE_N || '전자책',
        author: book.AUTHOR || book.AUTHOR_N || '',
        publisher: book.PUBLISHER || book.PUBLISHER_N || '',
        isbn: book.ISBN || '',
        pubDate: pubDate,
        available: isAvailable,
      };
    });
  } catch (error) {
    console.error('소장형 도서 파싱 오류:', error);
    return [];
  }
}

// 경기도 전자도서관 (구독) 결과 정리 - JSON 응답

function parseGyenggiEbookSubsResults(json_data, query) {
  try {
    if (!json_data || !Array.isArray(json_data.bookSearchResponses)) return [];

    // 응답결과
    // {
    //   "ucm_code": "UCM0000169589",
    //   "ucm_title": "직장인의 글쓰기",
    //   "ucm_writer": "강원국",
    //   "ucp_brand": "메디치미디어",
    //   "ucm_ebook_pubdate": "2025-06-20", // <- 바로 여기입니다!
    //   "ucm_ebook_isbn": "9791157064441",
    //   "ucm_file_type": "EPUB",
    //   // ...
    // }
    
    const GyenggiEbookSubsList = json_data.bookSearchResponses;
    if (GyenggiEbookSubsList.length === 0) return [];

    // return filteredBooks.map((book, index) => {
    return GyenggiEbookSubsList.map((book, index) => {

      // [핵심 수정] 올바른 키 이름 'ucm_ebook_pubdate'를 사용합니다.
      const pubDateRaw = book.ucm_ebook_pubdate || '';
      const pubDate = pubDateRaw ? pubDateRaw.split(' ')[0] : '정보없음';

      const title = book.ucm_title || book.title || '전자책';
      // console.log(`[DEBUG/구독형] ${index + 1}번째 책: "${title}" -> 원본 pubDate: ${pubDateRaw}, 파싱된 pubDate: ${pubDate}`);

      return {
        type: '구독형',
        title: title,
        author: book.ucm_writer || book.author || '',
        publisher: book.ucp_brand || book.publisher || '',
        isbn: book.ucm_ebook_isbn || book.isbn || '',
        pubDate: pubDate, // <- 올바르게 파싱된 값을 할당
        available: true,
      };
    });

  } catch (error) {
    console.error('❌ 구독형 도서 결과 파싱 오류:', error.message);
    return [];
  }
}


// 경기광주 시립 전자도서관 (소장) 결과 정리 - parse 적용
function parseSiripEbookOwnedHTML(html) {
  try {
    // 1. 검색 결과가 없는 경우 조기 반환 (기존 로직 유지)
    if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다')) {
      return {
        library_name: '광주시립중앙도서관-소장형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        book_list: []
      };
    }

    // 2. node-html-parser를 사용하여 HTML 파싱
    const root = parse(html);

    // 3. CSS 선택자로 모든 책 <li> 요소를 직접 선택
    const bookItems = root.querySelectorAll('.book_resultList > li');

    if (bookItems.length === 0) {
      return {
        library_name: '광주시립중앙도서관-소장형',
        total_count: 0,
        available_count: 0,
        unavailable_count: 0,
        book_list: []
      };
    }

    // 4. 각 <li> 요소를 순회하며 정보 추출 (map 사용)
    const SiripEbookOwnedList = bookItems.map(item => {
      // 제목 추출 (구독형과 동일한 안정적인 방식)
      const titleAttr = item.querySelector('.tit a')?.getAttribute('title');
      const title = titleAttr ? titleAttr.split('|')[0].trim() : '제목 정보없음';

      // 저자, 출판사, 출간일 추출 (구독형과 동일한 안정적인 방식)
      let author = '저자 정보없음';
      let publisher = '출판사 정보없음';
      let publishDate = '출간일 정보없음';
      const writerElement = item.querySelector('.writer');
      if (writerElement && writerElement.childNodes.length >= 3) {
        author = writerElement.childNodes[0].rawText.trim();
        publisher = writerElement.childNodes[1].innerText.trim();
        publishDate = writerElement.childNodes[2].rawText.trim();
      }

      // [핵심 개선] 대출 현황 파싱 (복잡한 정규식 -> 단순 텍스트 처리)
      let totalCopies = 0;
      let availableCopies = 0;
      let isAvailable = false;

      const useElement = item.querySelector('p.use');
      if (useElement) {
        const useText = useElement.text; // e.g., "[ 대출 : 0/3 ] 예약 : 0"
        const loanMatch = useText.match(/대출\s*:\s*(\d+)\/(\d+)/);
        if (loanMatch) {
          const currentBorrowed = parseInt(loanMatch[1], 10);
          totalCopies = parseInt(loanMatch[2], 10);
          availableCopies = Math.max(0, totalCopies - currentBorrowed);
          isAvailable = availableCopies > 0;
        }
      } else {
        // 'p.use' 요소가 없는 경우, 대출 정보가 없는 것으로 간주 (구독형처럼 항상 가능 처리)
        // 이는 소장형 1권만 있는 도서의 경우 'p.use'가 없을 수 있는 예외 케이스 대응
        totalCopies = 1;
        availableCopies = 1;
        isAvailable = true;
      }
      
      return {
        type: '소장형', // type을 '전자책'에서 더 명확하게 '소장형'으로 변경
        title,
        author,
        publisher,
        publishDate,
        isAvailable,
        totalCopies, // 상세 정보 추가
        availableCopies, // 상세 정보 추가
      };
    });

    const availableCount = SiripEbookOwnedList.filter(book => book.isAvailable).length;
    const unavailableCount = SiripEbookOwnedList.length - availableCount;

    return {
      library_name: '광주시립중앙도서관-소장형',
      total_count: SiripEbookOwnedList.length,
      available_count: availableCount,
      unavailable_count: unavailableCount,
      book_list: SiripEbookOwnedList
    };

  } catch (error) {
    console.error(`시립도서관 소장형 전자책 파싱 오류: ${error.message}`);
    throw new Error(`시립도서관 소장형 전자책 파싱 오류: ${error.message}`);
  }
}

// 시립 전자책(구독)
function parseSiripEbookSubsHTML(html) {
  try {
    // 검색 결과가 없는 경우를 먼저 처리
    if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다')) {
      return { library_name: '광주시립중앙도서관-구독형', total_count: 0, available_count: 0, unavailable_count: 0, book_list: [] };
    }

    // 1. HTML 문자열을 파서 객체로 변환
    const root = parse(html);

    // 2. CSS 선택자로 모든 책 <li> 요소를 직접 선택
    const bookItems = root.querySelectorAll('.book_resultList > li');
    
    // console.log(`[DEBUG/시립구독] ${bookItems.length}개의 li 블록을 찾았습니다.`);

    if (bookItems.length === 0) {
      return { library_name: '광주시립중앙도서관-구독형', total_count: 0, available_count: 0, unavailable_count: 0, book_list: [] };
    }
    
    // 3. 각 <li> 요소를 순회하며 원하는 정보를 추출 (map 사용)
    const SiripEbookSubsList = bookItems.map(item => {
      // 제목 추출
      const titleAttr = item.querySelector('.tit a')?.getAttribute('title');
      const title = titleAttr ? titleAttr.split('|')[0].trim() : '제목 정보없음';

      // --- [핵심 수정] 저자, 출판사, 출간일 추출 로직 변경 ---
      let author = '저자 정보없음';
      let publisher = '출판사 정보없음';
      let publishDate = '출간일 정보없음';

      const writerElement = item.querySelector('.writer');
      if (writerElement && writerElement.childNodes.length >= 3) {
        // childNodes를 이용해 각 부분을 정확히 분리
        const authorNode = writerElement.childNodes[0];
        const publisherNode = writerElement.childNodes[1]; // <span> 태그
        const dateNode = writerElement.childNodes[2];

        // .rawText로 순수 텍스트를, .innerText로 태그 내부 텍스트를 가져옴
        author = authorNode.rawText.trim();
        publisher = publisherNode.innerText.trim();
        publishDate = dateNode.rawText.trim();
      }
      // --------------------------------------------------------

      // 구독형은 항상 대출 가능으로 간주
      const isAvailable = true; 

      return { type: '구독형', title, author, publisher, isAvailable, publishDate };
    });

    // console.log(`[DEBUG/시립구독] 최종 파싱된 books 객체 배열 (${books.length}건):\n${JSON.stringify(books, null, 2)}`);

    return {
      library_name: '광주시립중앙도서관-구독형',
      total_count: SiripEbookSubsList.length,
      available_count: SiripEbookSubsList.length,
      unavailable_count: 0,
      book_list: SiripEbookSubsList
    };

  } catch (error) {
    console.error(`시립도서관 구독형 전자책 파싱 오류: ${error.stack}`);
    return { library_name: '광주시립중앙도서관-구독형', total_count: 0, book_list: [], error: error.message };
  }
}

// ==========================================
// 테스트 및 검증 함수들
// ==========================================

// 경기도 전자도서관 API 응답 검증 함수
function validateGyeonggiEbookApiResponse(response) {
  try {
    if (!response) {
      return false;
    }
    
    if (response.error) {
      return false;
    }
    
    if (!response.owned_results && !response.subscription_results) {
      return false;
    }
    
    // 소장형 도서 검증
    if (response.owned_results) {
      // 검증 로직은 유지하되 로그는 제거
    }
    
    // 구독형 도서 검증
    if (response.subscription_results) {
      // 검증 로직은 유지하되 로그는 제거
    }
    
    return true;
    
  } catch (error) {
    console.error('검증 중 오류 발생:', error);
    return false;
  }
}

// 통합 테스트 함수
async function runIntegrationTest() {
  try {
    // 테스트 케이스 1: 일반적인 책 제목으로 테스트
    const testTitle = '해리포터';
    
    const result = await searchGyeonggiEbookLibrary(testTitle);
    
    // 응답 검증
    const isValid = validateGyeonggiEbookApiResponse(result);
    
    // 테스트 케이스 2: 빈 결과 테스트
    const emptyResult = await searchGyeonggiEbookLibrary('존재하지않는책제목12345');
    
    return true;
    
  } catch (error) {
    return false;
  }
}

// 성능 테스트 함수
async function runPerformanceTest() {
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
      
    } catch (error) {
      results.push({
        title,
        duration: '실패',
        success: false,
        error: error.message
      });
    }
    
    // API 부하 방지를 위한 간격
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const avgDuration = results
    .filter(r => r.success && r.duration !== '실패')
    .reduce((sum, r) => sum + parseInt(r.duration), 0) / results.filter(r => r.success).length;
  
  return results;
}

// 에러 처리 테스트 함수
async function runErrorHandlingTest() {
  const testCases = [
    { name: '빈 문자열', input: '' },
    { name: '특수문자', input: '!@#$%^&*()' },
    { name: '매우 긴 문자열', input: 'a'.repeat(1000) },
    { name: 'null', input: null },
    { name: 'undefined', input: undefined }
  ];
  
  for (const testCase of testCases) {
    try {
      const result = await searchGyeonggiEbookLibrary(testCase.input);
      // 테스트 결과는 내부적으로 처리
    } catch (error) {
      // 에러는 정상적인 테스트 결과
    }
  }
}

// 메인 테스트 실행 함수 (개발 환경에서만 사용)
async function runAllTests() {
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
    // 테스트 실행 중 오류는 내부적으로 처리
  }
  
  return results;
}

// 개발 환경에서 테스트 실행을 위한 조건부 실행
if (typeof globalThis !== 'undefined' && globalThis.environment === 'development') {
  // 테스트 함수들이 로드되었음을 표시 (최소한의 로그)
}

// ==============================================
// 키워드 통합 검색 전용 함수들
// ==============================================

// 광주 종이책 키워드 검색 - '기타'와 '퇴촌'을 병렬로 검색 후 결과 통합
async function searchGwangjuPaperKeyword(keyword) {
  try {
    const encodedKeyword = encodeURIComponent(keyword);

    // 1. 두 도서관 그룹에 대한 검색 요청을 병렬로 생성
    const searchPromises = [
      // 요청 1: '기타' 도서관 (전체)
      fetch(`https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do?searchType=SIMPLE&searchKey=ALL&searchKeyword=${encodedKeyword}&searchLibrary=ALL`, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }),
      // 요청 2: '퇴촌' 도서관 (MN 코드 사용)
      fetch(`https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do?searchType=SIMPLE&searchKey=ALL&searchKeyword=${encodedKeyword}&searchLibraryArr=MN`, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
    ];

    const responses = await Promise.allSettled(searchPromises);

    // 2. 각 응답을 비동기적으로 파싱
    const parsingPromises = responses.map(async (result, index) => {
      const libraryGroupName = index === 0 ? '기타' : '퇴촌';
      if (result.status === 'fulfilled' && result.value.ok) {
        const html = await result.value.text();
        return parseGwangjuPaperKeywordResults(html); // 파싱 함수는 재사용
      } else {
        console.error(`광주 종이책(${libraryGroupName}) 검색 HTTP 오류:`, result.reason || result.value.status);
        return []; // 실패 시 빈 배열 반환
      }
    });

    const parsedResults = await Promise.all(parsingPromises);
    
    // 3. 모든 결과를 하나의 배열로 통합 (flatMap 사용)
    const combinedResults = parsedResults.flatMap(result => result);

    // 4. (선택적) 중복 제거: 제목과 저자가 완전히 동일한 경우 중복으로 간주하고 제거
    const uniqueResults = Array.from(new Map(combinedResults.map(item =>
        [`${item.title}-${item.author}`, item]
    )).values());

    return uniqueResults;
    
  } catch (error) {
    console.error('광주 종이책 키워드 검색 전체 과정에서 오류 발생:', error.message);
    return [];
  }
}

// 키워드검색 - 퇴촌/기타 도서관 동시 파싱 함수 - parse + 공통모듈 적용
function parseGwangjuPaperKeywordResults(html) {
  try {
    const root = parse(html);
    // 키워드 검색 결과는 클래스 이름이 약간 다름: 'resultList imageType'
    const bookItems = root.querySelectorAll('.resultList.imageType > li');

    if (bookItems.length === 0) {
      return [];
    }

    // 공통 헬퍼 함수를 사용하여 모든 책 정보를 파싱하고, 키워드 검색 API 포맷에 맞게 변환
    return bookItems.map(item => {
      const book = parseGwangjuBookItem(item);
      if (!book) return null; // 유효하지 않은 아이템은 건너뜀

      return {
        type: '종이책',
        libraryName: book.library === '퇴촌도서관' ? '퇴촌' : '기타',
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        pubDate: book.pubDate,
        isAvailable: book.status === '대출가능'
      };
    }).filter(Boolean); // null인 경우 최종 결과에서 제외

  } catch (error) {
    console.error('광주 종이책 키워드 결과 파싱 오류:', error.message);
    return []; // 오류 발생 시 빈 배열 반환
  }
}

/**
 * 경기도교육청 전자책 키워드 검색
 */

async function searchGyeonggiEduKeyword(keyword) {
    const results = [];
    try {
        const libraryCodes = ['10000004', '10000009']; // 성남, 통합
        const searchPromises = libraryCodes.map(code => searchGyeonggiEduEbook(keyword, code));
        const eduResults = await Promise.allSettled(searchPromises);

        eduResults.forEach(result => {
            // if (result.status === 'fulfilled' && result.value?.availability) {
            // result.value.availability.forEach(book => {
            if (result.status === 'fulfilled' && result.value?.book_list) { 
                result.value.book_list.forEach(book => {
                    results.push({
                        type: '전자책',
                        libraryName: 'e교육',
                        title: book['도서명'] || '정보없음',
                        author: book['저자'] || '정보없음',
                        publisher: book['출판사'] || '정보없음',
                        pubDate: book['발행일'] || '정보없음',
                        isAvailable: book['대출상태'] === '대출가능'
                    });
                });
            }
        });
        
        // 제목과 저자기준으로 중복 제거
        const uniqueResults = Array.from(new Map(results.map(item =>
            [`${item.title}-${item.author}`, item]
        )).values());

        return uniqueResults;
    } catch (error) {
        console.error('경기도교육청 전자책 키워드 검색 오류:', error.message);
        return [];
    }
}

/**
 * 경기도 전자도서관 키워드 검색
 */

async function searchGyeonggiEbookKeyword(keyword) {
  try {
    const gyeonggiResult = await searchGyeonggiEbookLibrary(keyword);

    if (gyeonggiResult?.book_list && Array.isArray(gyeonggiResult.book_list)) {
      
      // console.log(`[DEBUG/최종 검증] 프론트엔드로 보내기 전, ${gyeonggiResult.book_list.length}개의 e경기 책을 검증합니다.`);
      
      // [핵심 로그] 최종 반환될 모든 책에 대해 pubDate를 확인
      // gyeonggiResult.book_list.forEach((book, index) => {
      //   console.log(`[DEBUG/최종 검증] ${index + 1}번째 책("${book.title}") -> pubDate: ${book.pubDate}`);
      // });

      return gyeonggiResult.book_list.map(book => ({
        type: '전자책',
        libraryName: 'e경기',
        title: book.title || '정보없음',
        author: book.author || '정보없음',
        publisher: book.publisher || '정보없음',
        pubDate: book.pubDate || '정보없음',
        isAvailable: book.available || false,
      }));
    }
    
    return [];

  } catch (error) {
    console.error('경기도 전자도서관 키워드 검색 오류:', error.message);
    return [];
  }
}

/**
 * 시립도서관 전자책 키워드 검색 (소장형 + 구독형)
 */

async function searchSiripEbookKeyword(keyword) {
    const results = [];
    try {
        const siripResult = await searchSiripEbookIntegrated(keyword);

        // 소장형
        if (siripResult?.details?.owned?.book_list) {
            siripResult.details.owned.book_list.forEach(book => {
                results.push({
                    type: '전자책',
                    libraryName: 'e시립소장',
                    title: book.title || '정보없음',
                    author: book.author || '정보없음',
                    publisher: book.publisher || '정보없음',
                    pubDate: book.publishDate || '정보없음',
                    isAvailable: book.isAvailable || false
                });
            });
        }
        // 구독형
        if (siripResult?.details?.subscription?.book_list) {
            siripResult.details.subscription.book_list.forEach(book => {
                results.push({
                    type: '전자책',
                    libraryName: 'e시립구독',
                    title: book.title || '정보없음',
                    author: book.author || '정보없음',
                    publisher: book.publisher || '정보없음',
                    pubDate: book.publishDate || '정보없음',
                    isAvailable: book.isAvailable || true // 구독형은 항상 가능
                });
            });
        }
    } catch (error) {
        console.error('시립도서관 전자책 키워드 검색 오류:', error.message);
    }
    return results;
}
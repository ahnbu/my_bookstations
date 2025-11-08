// 2025-10-11 - 네이밍, 크롤링 로직 전반적인 정리
// ... (기존 주석) ...

import {
  Env,
  ApiRequest,
  KeywordSearchRequest,
  GwangjuPaperResult,
  GwangjuPaperBook,
  GyeonggiEduEbook,
  GyeonggiEduEbookResult,
  GyeonggiEbook,
  GyeonggiEbookResult,
  SiripEbookOwned,
  SiripEbookSubscription,
  SiripEbookResult,
  SiripEbookDetails, // ✅ 이 줄을 추가하세요.
  LibraryApiResponse,
  KeywordSearchResultItem
} from './types';
import { parse, HTMLElement } from 'node-html-parser';

const DEFAULT_TIMEOUT = 15000;

// ==============================================
// 헬퍼 함수들 (Helper Functions)
// ==============================================

function hasCacheBlockingError(finalResult: Partial<LibraryApiResponse>): boolean {
  if (finalResult.gwangju_paper && 'error' in finalResult.gwangju_paper) return true;
  if (finalResult.gyeonggi_ebook_edu && finalResult.gyeonggi_ebook_edu.error_count > 0) return true;
  if (finalResult.gyeonggi_ebook_library && 'error' in finalResult.gyeonggi_ebook_library) return true;
  if (finalResult.sirip_ebook && ('error' in finalResult.sirip_ebook || (finalResult.sirip_ebook && 'errors' in finalResult.sirip_ebook))) return true;
  
  return false;
}

// ==============================================
// 크롤링 함수들 (Crawling Functions)
// ==============================================

async function searchGwangjuLibrary(isbn: string): Promise<GwangjuPaperResult> {
    const url = "https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do";
    const payload = new URLSearchParams({'searchType': 'DETAIL','searchKey5': 'ISBN','searchKeyword5': isbn,'searchLibrary': 'ALL','searchSort': 'SIMILAR','searchRecordCount': '30'});
    const headers = {'User-Agent': 'Mozilla/5.0','Content-Type': 'application/x-www-form-urlencoded','Referer': 'https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchDetail.do'};
    const response = await fetch(url, {
      method: 'POST', 
      headers: headers, 
      body: payload.toString(), 
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
    });
    if (!response.ok) throw new Error(`경기광주 HTTP ${response.status}`);
    const htmlContent = await response.text();
    return parseGwangjuPaperHTML(htmlContent);
}

async function searchGyeonggiEduEbook(searchText: string, libraryCode: string): Promise<{ library_name: string; book_list: GyeonggiEduEbook[] }> {
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

async function searchGyeonggiEbookOwned(query: string): Promise<GyeonggiEbook[]> {
    const encodedTitle = encodeURIComponent(query);
    const timestamp = Date.now();
    const apiUrl = `https://ebook.library.kr/api/service/search-engine?contentType=EB&searchType=all&detailQuery=&sort=relevance&loanable=false&page=1&size=20&keyword=${encodedTitle}&_t=${timestamp}`;
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

async function searchGyeonggiEbookSubs(query: string): Promise<GyeonggiEbook[]> {
    try {
      const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const min = String(now.getUTCMinutes()).padStart(2, '0');
      const timestamp = `${yyyy}${mm}${dd}${hh}${min}`;
      const tokenString = `${timestamp},0000000685`;
      
      const dynamicToken = btoa(tokenString);
  
      const body = { 
        search: query, 
        searchOption: 1, 
        pageSize: 20, 
        pageNum: 1, 
        detailYn: "y" 
      };
      
      const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'token': dynamicToken,
        'Referer': 'https://ebook.library.kr/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Origin': 'https://ebook.library.kr'
      };
  
      const response = await fetch('https://api.bookers.life/v2/Api/books/search', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[오류] 경기도 전자도서관 (구독) 검색 서버가 오류를 반환했습니다: ${errorText}`);
        
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
      const parsedResults = parseGyenggiEbookSubsResults(json_data, query);
      return parsedResults;
  
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[오류] 경기도 전자도서관 (구독) 검색 실패: ${error.message}`);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error('네트워크 요청 실패: fetch API를 사용할 수 없습니다.');
        }
        if (error.message.includes('토큰 인코딩 실패')) {
          throw new Error(`토큰 생성 실패: ${error.message}.`);
        }
        throw error;
      }
      throw new Error('경기도 전자도서관 (구독) 검색 중 알 수 없는 오류 발생');
    }
}

async function searchGyeonggiEbookLibrary(searchText: string): Promise<GyeonggiEbookResult> {
    try {
      const [ownedResults, subscriptionResults] = await Promise.allSettled([
        searchGyeonggiEbookOwned(searchText),
        searchGyeonggiEbookSubs(searchText),
      ]);
  
      const ownedBooks = (ownedResults.status === 'fulfilled' && Array.isArray(ownedResults.value)) ? ownedResults.value : [];
      const subscriptionBooks = (subscriptionResults.status === 'fulfilled' && Array.isArray(subscriptionResults.value)) ? subscriptionResults.value : [];
  
      if (ownedResults.status === 'rejected' && subscriptionResults.status === 'rejected') {
        const ownedError = ownedResults.reason?.message || '소장형 검색 실패';
        const subsError = subscriptionResults.reason?.message || '구독형 검색 실패';
        throw new Error(`소장형(${ownedError}) 및 구독형(${subsError}) 검색 모두 실패`);
      }
  
      const combinedBooks = [...ownedBooks, ...subscriptionBooks];
      
      const totalStock = combinedBooks.length;
      const availableCount = combinedBooks.filter(book => book.available).length;
  
      return {
        library_name: '경기도 전자도서관',
        total_count_summary: totalStock,
        available_count_summary: availableCount,
        unavailable_count_summary: totalStock - availableCount,
        total_count_owned: ownedBooks.length,
        total_count_subs: subscriptionBooks.length,
        book_list: combinedBooks,
      };
    } catch (error) {
        if (error instanceof Error) {
            console.error('경기도 전자도서관 검색 오류:', error.message);
            throw new Error(`경기도 전자도서관 검색 실패: ${error.message}`);
        }
        throw new Error('경기도 전자도서관 검색 중 알 수 없는 오류 발생');
    }
}

async function searchSiripEbookOwned(searchTitle: string): Promise<SiripEbookDetails['owned']> {
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
      return parseSiripEbookOwnedHTML(htmlContent);
      
    } catch (error) {
        if (error instanceof Error) {
            console.error('시립도서관 전자책 검색 오류:', error.message);
            throw new Error(`시립도서관 전자책 검색 실패: ${error.message}`);
        }
        throw new Error('시립도서관 전자책 검색 중 알 수 없는 오류 발생');
    }
}

async function searchSiripEbookSubs(searchTitle: string): Promise<SiripEbookDetails['subscription']> {
    try {
      const encodedTitle = encodeURIComponent(searchTitle);
      const baseSearchUrl = 'https://gjcitylib.dkyobobook.co.kr/search/searchList.ink';
  
      const initialHeaders = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      };
  
      const initialResponse = await fetch(baseSearchUrl, {
        method: 'GET',
        headers: initialHeaders,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
      });
  
      if (!initialResponse.ok) {
        throw new Error(`세션 획득 실패: HTTP ${initialResponse.status}`);
      }
  
      const sessionCookie = initialResponse.headers.get('set-cookie');
      if (!sessionCookie) {
        throw new Error('세션 쿠키를 획득하지 못했습니다.');
      }
      
      const searchUrl = `${baseSearchUrl}?schTxt=${encodedTitle}`;
      const searchHeaders = {
        ...initialHeaders,
        'Cookie': sessionCookie,
        'Referer': baseSearchUrl,
        'Sec-Fetch-Site': 'same-origin',
      };
  
      const response = await fetch(searchUrl, { 
        method: 'GET', 
        headers: searchHeaders, 
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT) 
      });
      
      if (!response.ok) {
        throw new Error(`시립도서관 구독형 전자책 HTTP ${response.status}`);
      }
  
      const htmlContent = await response.text();
      return parseSiripEbookSubsHTML(htmlContent);
  
    } catch (error) {
        if (error instanceof Error) {
            console.error('시립도서관 구독형 전자책 검색 오류:', error.message);
            throw new Error(`시립도서관 구독형 전자책 검색 실패: ${error.message}`);
        }
        throw new Error('시립도서관 구독형 전자책 검색 중 알 수 없는 오류 발생');
    }
}

async function searchSiripEbookIntegrated(searchTitle: string): Promise<SiripEbookResult> {
    try {
      const [ownedResults, subscriptionResults] = await Promise.allSettled([
        searchSiripEbookOwned(searchTitle),
        searchSiripEbookSubs(searchTitle)
      ]);
      
      let siripOwnedData: SiripEbookDetails['owned'];
      let siripSubsData: SiripEbookDetails['subscription'];
      
      if (ownedResults.status === 'fulfilled') {
        siripOwnedData = ownedResults.value;
      } else {
        siripOwnedData = {
          library_name: '광주시립중앙도서관-소장형', total_count: 0, available_count: 0, unavailable_count: 0, book_list: [],
          error: ownedResults.reason?.message || 'Unknown error'
        };
      }
      
      if (subscriptionResults.status === 'fulfilled') {
        siripSubsData = subscriptionResults.value;
      } else {
        siripSubsData = {
          library_name: '광주시립중앙도서관-구독형', total_count: 0, available_count: 0, unavailable_count: 0, book_list: [],
          error: subscriptionResults.reason?.message || 'Unknown error'
        };
      }
      
      const totalBooks = siripOwnedData.total_count + siripSubsData.total_count;
      const totalAvailable = siripOwnedData.available_count + siripSubsData.available_count;
      const totalUnavailable = siripOwnedData.unavailable_count + siripSubsData.unavailable_count;
      
      const integratedResult: SiripEbookResult = {
        sirip_ebook_summary: {
          library_name: '광주시립중앙도서관-통합',
          total_count_summary: totalBooks,
          available_count_summary: totalAvailable,
          unavailable_count_summary: totalUnavailable,
          total_count_owned: siripOwnedData.total_count,
          total_count_subs: siripSubsData.total_count,
          search_query: searchTitle
        },
        details: {
          owned: siripOwnedData,
          subscription: siripSubsData,
        }
      };
      
      if (siripOwnedData.error || siripSubsData.error) {
        integratedResult.errors = {};
        if (siripOwnedData.error) integratedResult.errors.owned = siripOwnedData.error;
        if (siripSubsData.error) integratedResult.errors.subscription = siripSubsData.error;
      }
      
      return integratedResult;
      
    } catch (error) {
        if (error instanceof Error) {
            console.error('시립도서관 통합 검색 오류:', error.message);
            throw new Error(`시립도서관 통합 검색 실패: ${error.message}`);
        }
        throw new Error('시립도서관 통합 검색 중 알 수 없는 오류 발생');
    }
}

// ===========================================
// 파싱 함수들 (Parsing Functions)
// ===========================================

type GwangjuParsedItem = {
    title: string;
    author: string;
    publisher: string;
    pubDate: string;
    library: string;
    callNo: string;
    baseCallNo: string;
    status: '대출가능' | '대출불가' | '알 수 없음';
    dueDate: string;
}

function parseGwangjuBookItem(item: HTMLElement): GwangjuParsedItem | null {
    try {
      const title = item.querySelector('dt.tit a')?.text.replace(/^\d+\.\s*/, '').trim();
      if (!title) return null;
  
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
  
      let callNo = "정보없음";
      const dataDd = item.querySelector('dd.data');
      if (dataDd) {
          const callNoMatch = dataDd.text.match(/청구기호:\s*([^\s\n]+(?:.|\s)*?)(?:\s*<|위치출력|$)/);
          if (callNoMatch) callNo = callNoMatch[1].trim();
      } else if (authorDd) {
          const callNoMatch = authorDd.rawText.match(/청구기호:\s*([^\s\n]+)/);
          if (callNoMatch) callNo = callNoMatch[1].trim();
      }
      
      const library = item.querySelector('dd.site span')?.text.replace('도서관:', '').trim() || "정보없음";
      const baseCallNo = callNo.split('=')[0].trim();
      
      let status: '대출가능' | '대출불가' | '알 수 없음' = "알 수 없음";
      let dueDate = "-";
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
  
      return { title, author, publisher, pubDate, library, callNo, baseCallNo, status, dueDate };
    } catch (error) {
      console.error('광주 도서 아이템 파싱 오류:', error);
      return null;
    }
}

function parseGwangjuPaperHTML(html: string): GwangjuPaperResult {
    try {
      const root: HTMLElement = parse(html);
      const bookItems = root.querySelectorAll('.resultList > li');
  
      if (bookItems.length === 0) {
        return {
          library_name: "광주 시립도서관", total_count_summary: 0, available_count_summary: 0,
          total_count_toechon: 0, available_count_toechon: 0, total_count_other: 0, available_count_other: 0,
          book_title: "결과 없음", book_list: []
        };
      }
      
      const parsedBooks = bookItems.map(parseGwangjuBookItem).filter((book): book is GwangjuParsedItem => book !== null);
  
      let total_count_summary = 0;
      let total_count_toechon = 0;
      let total_count_other = 0;
      let available_count_summary = 0;
      let available_count_toechon = 0;
      let available_count_other = 0;
      
      const book_list: GwangjuPaperBook[] = parsedBooks.map(book => {
        const isAvailable = book.status === '대출가능';
        
        total_count_summary++;
        if (isAvailable) available_count_summary++;
  
        if (book.library === '퇴촌도서관') {
          total_count_toechon++;
          if (isAvailable) available_count_toechon++;
        } else {
          total_count_other++;
          if (isAvailable) available_count_other++;
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
        library_name: "광주 시립도서관", total_count_summary: total_count_summary, available_count_summary: available_count_summary,
        total_count_toechon: total_count_toechon, available_count_toechon, total_count_other, available_count_other,
        book_title: parsedBooks[0]?.title || "제목 정보없음", book_list
      };
  
    } catch (error) {
        if (error instanceof Error) {
            console.error(`광주 파싱 오류: ${error.message}`);
            throw new Error(`광주 파싱 오류: ${error.message}`);
        }
        throw new Error('광주 파싱 중 알 수 없는 오류 발생');
    }
}

function parseGyeonggiEduHTML(html: string, libraryCode: string): { library_name: string; book_list: GyeonggiEduEbook[] } {
    try {
      const libraryNameMap: { [key: string]: '성남도서관' | '통합도서관' } = { '10000004': '성남도서관', '10000009': '통합도서관' };
      const branchName = libraryNameMap[libraryCode] || `코드(${libraryCode})`;
  
      if (html.includes("찾으시는 자료가 없습니다")) {
        return { library_name: `경기도교육청-${branchName}`, book_list: [] };
      }
  
      const root = parse(html);
      const bookItems = root.querySelectorAll('#search-results .row');
  
      if (bookItems.length === 0) {
        return { library_name: `경기도교육청-${branchName}`, book_list: [] };
      }
  
      const availability: GyeonggiEduEbook[] = bookItems.map(item => {
        const selectBookLink = item.querySelector('a.selectBook');
        const keyValue = selectBookLink?.getAttribute('keyValue');
  
        let title = "정보없음", author = "정보없음", publisher = "정보없음", isbn = "정보없음";
  
        if (keyValue) {
          const parts = keyValue.split('///');
          if (parts.length > 4) {
            title = parts[0].replace(/<[^>]*>/g, '').trim();
            author = parts[2].replace(/<[^>]*>/g, '').trim();
            publisher = parts[3].replace(/<[^>]*>/g, '').trim();
            isbn = parts[4].trim();
          }
        }
  
        const infoBlock = item.querySelector('.bif');
        let pubDate = "정보없음";
        let status: '대출가능' | '대출불가' | '알 수 없음' = "알 수 없음";
  
        if (infoBlock) {
          const infoBlockHtml = infoBlock.innerHTML;
          const infoBlockText = infoBlock.text;
  
          const pubDateMatch = infoBlockHtml.match(/발행일자\s*:\s*([^<]+)/i);
          pubDate = pubDateMatch ? pubDateMatch[1].trim() : "정보없음";
          
          if (infoBlockText.includes("대출 가능")) status = "대출가능";
          else if (infoBlockText.includes("대출중") || infoBlockText.includes("대출 불가")) status = "대출불가";
        }
  
        return {
          '소장도서관': branchName, '도서명': title, '저자': author, '출판사': publisher,
          '발행일': pubDate, '대출상태': status, 'isbn': isbn
        };
      }).filter((book): book is GyeonggiEduEbook => book.도서명 !== "정보없음");
  
      return { library_name: `경기도교육청-${branchName}`, book_list: availability };
    } catch (error) {
        if (error instanceof Error) {
            console.error(`경기도교육청(${libraryCode}) 파싱 오류: ${error.message}`);
            throw new Error(`경기도교육청 파싱 오류: ${error.message}`);
        }
        throw new Error('경기도교육청 파싱 중 알 수 없는 오류 발생');
    }
}

function parseGyenggiEbookOwnedResults(json_data: any): GyeonggiEbook[] {
    try {
      if (!json_data || json_data.httpStatus !== 'OK' || !json_data.data) return [];
      const contents = json_data.data.contents || [];
      if (contents.length === 0) return [];
  
      return contents.map((book: any): GyeonggiEbook => {
        const isAvailable = (parseInt(book.COPYS || 0, 10) - parseInt(book.LOAN_CNT || 0, 10)) > 0;
        const pubDate = book.PUBLISH_DATE ? book.PUBLISH_DATE.split(' ')[0] : '정보없음';
        
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
  
function parseGyenggiEbookSubsResults(json_data: any, query: string): GyeonggiEbook[] {
    try {
      if (!json_data || !Array.isArray(json_data.bookSearchResponses)) return [];
      
      const GyenggiEbookSubsList = json_data.bookSearchResponses;
      if (GyenggiEbookSubsList.length === 0) return [];
  
      return GyenggiEbookSubsList.map((book: any): GyeonggiEbook => {
        const pubDateRaw = book.ucm_ebook_pubdate || '';
        const pubDate = pubDateRaw ? pubDateRaw.split(' ')[0] : '정보없음';
        const title = book.ucm_title || book.title || '전자책';
  
        return {
          type: '구독형', title: title, author: book.ucm_writer || book.author || '',
          publisher: book.ucp_brand || book.publisher || '', isbn: book.ucm_ebook_isbn || book.isbn || '',
          pubDate: pubDate, available: true,
        };
      });
  
    } catch (error) {
        if (error instanceof Error) {
            console.error('❌ 구독형 도서 결과 파싱 오류:', error.message);
        } else {
            console.error('❌ 구독형 도서 결과 파싱 중 알 수 없는 오류:', error);
        }
        return [];
    }
}
  
function parseSiripEbookOwnedHTML(html: string): SiripEbookDetails['owned'] {
    try {
      if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다')) {
        return { library_name: '광주시립중앙도서관-소장형', total_count: 0, available_count: 0, unavailable_count: 0, book_list: [] };
      }
  
      const root = parse(html);
      const bookItems = root.querySelectorAll('.book_resultList > li');
  
      if (bookItems.length === 0) {
        return { library_name: '광주시립중앙도서관-소장형', total_count: 0, available_count: 0, unavailable_count: 0, book_list: [] };
      }
  
      const SiripEbookOwnedList: SiripEbookOwned[] = bookItems.map(item => {
        const titleAttr = item.querySelector('.tit a')?.getAttribute('title');
        const title = titleAttr ? titleAttr.split('|')[0].trim() : '제목 정보없음';
  
        let author = '저자 정보없음';
        let publisher = '출판사 정보없음';
        let publishDate = '출간일 정보없음';
        const writerElement = item.querySelector('.writer');
        if (writerElement && writerElement.childNodes.length >= 3) {
          author = writerElement.childNodes[0].rawText.trim();
          publisher = writerElement.childNodes[1].innerText.trim();
          publishDate = writerElement.childNodes[2].rawText.trim();
        }
  
        let totalCopies = 0;
        let availableCopies = 0;
        let isAvailable = false;
  
        const useElement = item.querySelector('p.use');
        if (useElement) {
          const useText = useElement.text;
          const loanMatch = useText.match(/대출\s*:\s*(\d+)\/(\d+)/);
          if (loanMatch) {
            const currentBorrowed = parseInt(loanMatch[1], 10);
            totalCopies = parseInt(loanMatch[2], 10);
            availableCopies = Math.max(0, totalCopies - currentBorrowed);
            isAvailable = availableCopies > 0;
          }
        } else {
          totalCopies = 1;
          availableCopies = 1;
          isAvailable = true;
        }
        
        return {
          type: '소장형', title, author, publisher, publishDate, isAvailable, totalCopies, availableCopies,
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
        if (error instanceof Error) {
            console.error(`시립도서관 소장형 전자책 파싱 오류: ${error.message}`);
            throw new Error(`시립도서관 소장형 전자책 파싱 오류: ${error.message}`);
        }
        throw new Error('시립도서관 소장형 파싱 중 알 수 없는 오류 발생');
    }
}
  
function parseSiripEbookSubsHTML(html: string): SiripEbookDetails['subscription'] {
    try {
      if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다')) {
        return { library_name: '광주시립중앙도서관-구독형', total_count: 0, available_count: 0, unavailable_count: 0, book_list: [] };
      }
  
      const root = parse(html);
      const bookItems = root.querySelectorAll('.book_resultList > li');
      
      if (bookItems.length === 0) {
        return { library_name: '광주시립중앙도서관-구독형', total_count: 0, available_count: 0, unavailable_count: 0, book_list: [] };
      }
      
      const SiripEbookSubsList: SiripEbookSubscription[] = bookItems.map(item => {
        const titleAttr = item.querySelector('.tit a')?.getAttribute('title');
        const title = titleAttr ? titleAttr.split('|')[0].trim() : '제목 정보없음';
  
        let author = '저자 정보없음';
        let publisher = '출판사 정보없음';
        let publishDate = '출간일 정보없음';
  
        const writerElement = item.querySelector('.writer');
        if (writerElement && writerElement.childNodes.length >= 3) {
          const authorNode = writerElement.childNodes[0];
          const publisherNode = writerElement.childNodes[1];
          const dateNode = writerElement.childNodes[2];
  
          author = authorNode.rawText.trim();
          publisher = publisherNode.innerText.trim();
          publishDate = dateNode.rawText.trim();
        }
  
        return { type: '구독형', title, author, publisher, isAvailable: true, publishDate };
      });
  
      return {
        library_name: '광주시립중앙도서관-구독형',
        total_count: SiripEbookSubsList.length,
        available_count: SiripEbookSubsList.length,
        unavailable_count: 0,
        book_list: SiripEbookSubsList
      };
  
    } catch (error) {
      if (error instanceof Error) {
        console.error(`시립도서관 구독형 전자책 파싱 오류: ${error.stack}`);
        // ✅ 반환 타입에 맞게 error 속성을 추가하여 반환
        return { 
          library_name: '광주시립중앙도서관-구독형', total_count: 0, available_count: 0, unavailable_count: 0, 
          book_list: [], error: error.message 
        };
      }
      // ✅ 알 수 없는 오류 발생 시에도 타입에 맞는 객체 반환
      return { 
        library_name: '광주시립중앙도서관-구독형', total_count: 0, available_count: 0, unavailable_count: 0, 
        book_list: [], error: 'An unknown error occurred'
      };
    }
}

// ==============================================
// 키워드 통합 검색 전용 함수들
// ==============================================

async function searchGwangjuPaperKeyword(keyword: string): Promise<KeywordSearchResultItem[]> {
    try {
      const encodedKeyword = encodeURIComponent(keyword);
  
      const searchPromises = [
        fetch(`https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do?searchType=SIMPLE&searchKey=ALL&searchKeyword=${encodedKeyword}&searchLibrary=ALL`, {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }),
        fetch(`https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do?searchType=SIMPLE&searchKey=ALL&searchKeyword=${encodedKeyword}&searchLibraryArr=MN`, {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
      ];
  
      const responses = await Promise.allSettled(searchPromises);
  
      const parsingPromises = responses.map(async (result, index) => {
        const libraryGroupName = index === 0 ? '기타' : '퇴촌';
        if (result.status === 'fulfilled' && result.value.ok) {
          const html = await result.value.text();
          return parseGwangjuPaperKeywordResults(html);
        } else {
          const reason = result.status === 'rejected' ? result.reason : result.value.status;
          console.error(`광주 종이책(${libraryGroupName}) 검색 HTTP 오류:`, reason);
          return [];
        }
      });
  
      const parsedResults = await Promise.all(parsingPromises);
      const combinedResults = parsedResults.flatMap(result => result);
  
      const uniqueResults = Array.from(new Map(combinedResults.map(item =>
          [`${item.title}-${item.author}`, item]
      )).values());
  
      return uniqueResults;
      
    } catch (error) {
        if (error instanceof Error) {
            console.error('광주 종이책 키워드 검색 전체 과정에서 오류 발생:', error.message);
        }
        return [];
    }
}
  
function parseGwangjuPaperKeywordResults(html: string): KeywordSearchResultItem[] {
    try {
      const root = parse(html);
      const bookItems = root.querySelectorAll('.resultList.imageType > li');
  
      if (bookItems.length === 0) {
        return [];
      }
  
      return bookItems.map(item => {
        const book = parseGwangjuBookItem(item);
        if (!book) return null;
  
        return {
          type: '종이책',
          libraryName: book.library === '퇴촌도서관' ? '퇴촌' : '기타',
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          pubDate: book.pubDate,
          isAvailable: book.status === '대출가능'
        };
      }).filter((item): item is KeywordSearchResultItem => item !== null);
  
    } catch (error) {
        if (error instanceof Error) {
            console.error('광주 종이책 키워드 결과 파싱 오류:', error.message);
        }
        return [];
    }
}
  
async function searchGyeonggiEduKeyword(keyword: string): Promise<KeywordSearchResultItem[]> {
      const results: KeywordSearchResultItem[] = [];
      try {
          const libraryCodes = ['10000004', '10000009'];
          const searchPromises = libraryCodes.map(code => searchGyeonggiEduEbook(keyword, code));
          const eduResults = await Promise.allSettled(searchPromises);
  
          eduResults.forEach(result => {
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
          
          const uniqueResults = Array.from(new Map(results.map(item =>
              [`${item.title}-${item.author}`, item]
          )).values());
  
          return uniqueResults;
      } catch (error) {
          if (error instanceof Error) {
              console.error('경기도교육청 전자책 키워드 검색 오류:', error.message);
          }
          return [];
      }
}

async function searchGyeonggiEbookKeyword(keyword: string): Promise<KeywordSearchResultItem[]> {
    try {
      const gyeonggiResult = await searchGyeonggiEbookLibrary(keyword);
  
      if (gyeonggiResult?.book_list && Array.isArray(gyeonggiResult.book_list)) {
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
        if (error instanceof Error) {
            console.error('경기도 전자도서관 키워드 검색 오류:', error.message);
        }
        return [];
    }
}

async function searchSiripEbookKeyword(keyword: string): Promise<KeywordSearchResultItem[]> {
    const results: KeywordSearchResultItem[] = [];
    try {
        const siripResult = await searchSiripEbookIntegrated(keyword);

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
        if (siripResult?.details?.subscription?.book_list) {
            siripResult.details.subscription.book_list.forEach(book => {
                results.push({
                    type: '전자책',
                    libraryName: 'e시립구독',
                    title: book.title || '정보없음',
                    author: book.author || '정보없음',
                    publisher: book.publisher || '정보없음',
                    pubDate: book.publishDate || '정보없음',
                    isAvailable: book.isAvailable || true
                });
            });
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error('시립도서관 전자책 키워드 검색 오류:', error.message);
        }
    }
    return results;
}

// ==============================================
// ✅ 메인 Worker 핸들러 (export default)
// ==============================================

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
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

    if (request.method === 'POST' && pathname === '/keyword-search') {
        try {
            const body: KeywordSearchRequest = await request.json();
            const { keyword } = body;
    
            if (!keyword || !keyword.trim()) {
              return new Response(JSON.stringify({ error: 'keyword 파라미터가 필요합니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            console.log(`Keyword search request: "${keyword}"`);
    
            const safeSearch = async (searchFn: (keyword: string) => Promise<KeywordSearchResultItem[]>, name: string) => {
              try {
                return await searchFn(keyword);
              } catch (error) {
                console.error(`[CRITICAL ERROR] '${name}' 함수 실행 중 치명적 오류 발생:`, error);
                return [];
              }
            };
    
            const searchPromises = [
              safeSearch(searchGwangjuPaperKeyword, 'searchGwangjuPaperKeyword'),
              safeSearch(searchGyeonggiEduKeyword, 'searchGyeonggiEduKeyword'),
              safeSearch(searchGyeonggiEbookKeyword, 'searchGyeonggiEbookKeyword'),
              safeSearch(searchSiripEbookKeyword, 'searchSiripEbookKeyword'),
            ];
    
            const results = await Promise.allSettled(searchPromises);
    
            const combinedResults = results
              .filter((result): result is PromiseFulfilledResult<KeywordSearchResultItem[]> =>
                result.status === 'fulfilled' && Array.isArray(result.value)
              )
              .flatMap(result => result.value);
    
            console.log(`Keyword search completed: ${combinedResults.length} results found`);
            return new Response(JSON.stringify(combinedResults), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
          } catch (error) {
            console.error('Keyword search error:', error);
            return new Response(JSON.stringify({ error: '키워드 검색 중 오류가 발생했습니다.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
    }

    if (request.method === 'POST' && pathname !== '/keyword-search') {
        const cache = caches.default;

        // --- 👇 캐시 키 생성 로직 변경 ---
        const body: ApiRequest = await request.clone().json(); // .text() 대신 .json()으로 파싱
        // ✅ 1. 모든 필요한 변수를 try 블록 이전에 구조 분해 할당으로 선언합니다.
        const { 
            isbn, 
            author = '', 
            customTitle = '', 
            eduTitle = '', 
            gyeonggiTitle = '', 
            siripTitle = '' 
        } = body;
        
        // --- 👇 캐시 키 생성 로직 ---
        const cacheableData = {
            isbn,
            customTitle, // 기본값 ''가 이미 할당되어 안전합니다.
            eduTitle,
            gyeonggiTitle,
            siripTitle
        };

        // 2. 객체의 키를 기준으로 정렬하여 항상 동일한 순서의 문자열을 보장합니다.
        const sortedKeys = Object.keys(cacheableData).sort();
        const sortedCacheableData = sortedKeys.reduce((obj, key) => {
            obj[key as keyof typeof cacheableData] = cacheableData[key as keyof typeof cacheableData];
            return obj;
        }, {} as typeof cacheableData);

        const cacheKeyString = JSON.stringify(sortedCacheableData);

        // 3. 이 일관된 문자열을 해싱합니다.
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cacheKeyString));
        const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // ==========================================================
        // ✅ [수정] 캐시 키를 명시적인 Request 객체로 생성
        // ==========================================================
        // 1. 캐시 전용 URL을 만듭니다.
        const cacheUrl = new URL(request.url);
        cacheUrl.pathname = '/cache/' + hashHex;

        // 2. 이 URL을 사용하여 깨끗하고 명시적인 GET 요청 객체를 캐시 키로 생성합니다.
        //    이렇게 하면 원본 POST 요청의 헤더가 캐시 키에 영향을 주지 않아 안정성이 높아집니다.
        const cacheKeyRequest = new Request(cacheUrl.toString(), {
          method: 'GET',
        });
        
        console.log('[CACHE DEBUG] Key String:', cacheKeyString);
        console.log('[CACHE DEBUG] Cache Key URL:', cacheUrl.toString());

        // 3. 수정된 cacheKeyRequest 객체로 캐시를 조회합니다.
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
  
        try {
            console.log(`Request received - ISBN: ${isbn}, Author: "${author}", eduTitle: "${eduTitle}", GyeonggiTitle: "${gyeonggiTitle}", SiripTitle: "${siripTitle}"`);
    
            if (!isbn) {
              return new Response(JSON.stringify({ error: 'isbn 파라미터가 필요합니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
    
            const promises: Promise<any>[] = [
              searchGwangjuLibrary(isbn),
            ];
    
            if (eduTitle) {
              promises.push(
                searchGyeonggiEduEbook(eduTitle, '10000004'),
                searchGyeonggiEduEbook(eduTitle, '10000009')
              );
            }
    
            let gyeonggiEbookPromise: Promise<GyeonggiEbookResult> | null = null;
            if (gyeonggiTitle) {
              gyeonggiEbookPromise = searchGyeonggiEbookLibrary(gyeonggiTitle);
            }
    
            let siripEbookPromise: Promise<SiripEbookResult> | null = null;
            if (siripTitle) {
              siripEbookPromise = searchSiripEbookIntegrated(siripTitle);
            }
    
            const results = await Promise.allSettled(promises);
    
            let gyeonggiEbookResult: GyeonggiEbookResult | { error: string } | null = null;
            if (gyeonggiEbookPromise) {
              try {
                gyeonggiEbookResult = await gyeonggiEbookPromise;
              }
              catch (error) {
                if (error instanceof Error) {
                  console.error('경기도 전자도서관 검색 오류:', error.message);
                  gyeonggiEbookResult = { error: error.message };
                } else {
                  console.error('An unknown error occurred:', error);
                  gyeonggiEbookResult = { error: 'An unknown error occurred' };
                }
              }
            }
    
            let siripEbookResult: SiripEbookResult | { error: string } | null = null;
            if (siripEbookPromise) {
              try {
                siripEbookResult = await siripEbookPromise;
              } catch (error) {
                if (error instanceof Error) {
                  console.error('시립도서관 통합 전자책 검색 오류:', error.message);
                  siripEbookResult = { error: error.message };
                } else {
                  console.error('An unknown error occurred:', error);
                  siripEbookResult = { error: 'An unknown error occurred' };
                }
              }
            }
    
            const finalResult: Partial<LibraryApiResponse> = {
              gwangju_paper: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason.message },
              gyeonggi_ebook_edu: null,
              gyeonggi_ebook_library: gyeonggiEbookResult,
              sirip_ebook: siripEbookResult || null
            };
    
            if (eduTitle && results.length > 1) {
              const combinedEduBooks: (GyeonggiEduEbook | { library: string; error: string })[] = [];
              
              const res1 = results[1];
              if (res1.status === 'fulfilled' && res1.value?.book_list) {
                combinedEduBooks.push(...res1.value.book_list);
              }
              const res2 = results[2];
              if (res2.status === 'fulfilled' && res2.value?.book_list) {
                combinedEduBooks.push(...res2.value.book_list);
              }
    
              const errorLibs: string[] = [];
    
              if (results[1].status === 'rejected') {
                const errorMessage = `검색 실패: ${results[1].reason.message}`;
                console.error(`[API ERROR] 성남교육도서관(${eduTitle}):`, errorMessage);
                combinedEduBooks.push({ library: '성남도서관', error: errorMessage });
                errorLibs.push('성남');
              }
              if (results[2].status === 'rejected') {
                const errorMessage = `검색 실패: ${results[2].reason.message}`;
                console.error(`[API ERROR] 통합교육도서관(${eduTitle}):`, errorMessage);
                combinedEduBooks.push({ library: '통합도서관', error: errorMessage });
                errorLibs.push('통합');
              }
    
              let total_count_summary = 0;
              let available_count_summary = 0;
              let total_count_seongnam = 0;
              let total_count_tonghap = 0;
              let error_count = 0;
    
              const validBooks = combinedEduBooks.filter((book): book is GyeonggiEduEbook => !('error' in book));
    
              total_count_summary = validBooks.length;
              available_count_summary = validBooks.filter(b => b.대출상태 === '대출가능').length;
              total_count_seongnam = validBooks.filter(b => b.소장도서관 === '성남도서관').length;
              total_count_tonghap = validBooks.filter(b => b.소장도서관 === '통합도서관').length;
              error_count = errorLibs.length;
    
              finalResult.gyeonggi_ebook_edu = {
                library_name: "경기도교육청 전자도서관",
                total_count_summary: total_count_summary,
                available_count_summary: available_count_summary,
                unavailable_count_summary: total_count_summary - available_count_summary,
                total_count_seongnam,
                total_count_tonghap,
                error_count,
                error_lib_detail: errorLibs.length > 0 ? `에러 발생: ${errorLibs.join(', ')}` : undefined,
                book_list: validBooks
              };
            }
    
            const responsePayload: LibraryApiResponse = {
              title: eduTitle,
              isbn: isbn,
              author: author,
              customTitle: customTitle || '',
              lastUpdated: Date.now(),
              ...finalResult
            } as LibraryApiResponse;
    
            console.log('API Response:', JSON.stringify(responsePayload, null, 2));
    
            response = new Response(JSON.stringify(responsePayload), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache-Status': 'MISS',
                // 4. 이 응답은 공개적으로 캐시할 수 있으며, 1일(86400초) 동안 유효하다고 명시합니다.
                //    이 헤더가 캐시 MISS 문제의 핵심 해결책입니다.
                //  (예: 12시간은 43200).
                // 'Cache-Control': 'public, max-age=86400' // 24시간
                'Cache-Control': 'public, max-age=43200' // 12시간
              }
            });
    
            if (!hasCacheBlockingError(finalResult)) {
              console.log("Response is clean. 캐시 저장중 Caching...");
              ctx.waitUntil(cache.put(cacheKeyRequest, response.clone())); 
            } else {
              console.warn("Response contains errors. 에러로 캐시 저장 스킵 Skipping cache.");
              response.headers.set('Cache-Control', 'no-store');
            }
    
            return response;
    
          } catch (error) {
            if (error instanceof Error) {
              console.error(`API Error: ${error.message}`);
              return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } else {
              console.error('An unknown error occurred:', error);
              return new Response(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          }
    }

    return new Response('Method not allowed', { status: 405 });
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
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
      if (error instanceof Error) {
        console.error('💥 Supabase keep-alive ERROR:', error.message);
      } else {
        console.error('An unknown error occurred:', error);
      }
    }
  }
};

import {
  Env,
  ApiRequest,
  KeywordSearchRequest,
  GwangjuPaperResult,
  GwangjuPaperBook,
  gyeonggiEduEbook,
  gyeonggiEduEbookResult,
  gyeonggiEbook,
  gyeonggiEbookResult,
  SiripEbookOwned,
  SiripEbookSubscription,
  SiripEbookOwnedResult,
  SiripEbookSubsResult,
  SiripEbookResult,
  SiripEbookBook,
  LibraryApiResponse,
  KeywordSearchResultItem
} from './types';

import { parse, HTMLElement } from 'node-html-parser';
import { createClient } from '@supabase/supabase-js'; // ✅ Supabase 클라이언트 import

// API 최대 대기 시간 15초
const DEFAULT_TIMEOUT = 15000;

// ✅ 에러책 자동 업데이트 위한 함수
// ==============================================
function createOptimalSearchTitle(title: string): string {
  if (typeof title !== 'string' || !title) {
    return '';
  }
  const subtitleMarkers = /:|-|\(|\)|\[|\]|\{|\}/;
  let coreTitle = title;
  const markerIndex = title.search(subtitleMarkers);
  if (markerIndex !== -1) {
    coreTitle = title.substring(0, markerIndex).trim();
  }
  const words = coreTitle.split(' ').filter(word => word.trim() !== '');
  return words.slice(0, 3).join(' ');
}

function processGyeonggiEbookEduTitle(title: string): string {
  return createOptimalSearchTitle(title);
}

function processGyeonggiEbookTitle(title: string): string {
  return createOptimalSearchTitle(title);
}

function processSiripEbookTitle(title: string): string {
  return createOptimalSearchTitle(title);
}
// ✅ [추가 끝]


// ==============================================
// 헬퍼 함수들 (Helper Functions)
// ==============================================

function hasCacheBlockingError(finalResult: Partial<LibraryApiResponse>): boolean {
  if (finalResult.gwangjuPaper && 'error' in finalResult.gwangjuPaper) return true;
  if (finalResult.gyeonggiEbookEdu && finalResult.gyeonggiEbookEdu.errorCount > 0) return true;
  if (finalResult.gyeonggiEbookLib && 'error' in finalResult.gyeonggiEbookLib) return true;
  if (finalResult.siripEbook && ('error' in finalResult.siripEbook || (finalResult.siripEbook && 'errors' in finalResult.siripEbook))) return true;
  
  return false;
}

// ==============================================
// 크롤링 함수들 (Crawling Functions)
// ==============================================

async function searchGwangjuLibrary(isbn: string): Promise<GwangjuPaperResult> {
    // throw new Error("광주 도서관 테스트 에러"); // 크롤링 에러 테스트용
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

async function searchGyeonggiEduEbook(searchText: string, libraryCode: string): Promise<{ libraryName: string; bookList: gyeonggiEduEbook[] }> {
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

async function searchGyeonggiEbookOwned(query: string): Promise<gyeonggiEbook[]> {
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

async function searchGyeonggiEbookSubs(query: string): Promise<gyeonggiEbook[]> {
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

async function searchGyeonggiEbookLibrary(searchText: string): Promise<gyeonggiEbookResult> {
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
      const availableCount = combinedBooks.filter(book => book.loanStatus).length;
  
      return {
        libraryName: '경기도 전자도서관',
        totalCountSummary: totalStock,
        availableCountSummary: availableCount,
        unavailableCountSummary: totalStock - availableCount,
        totalCountOwned: ownedBooks.length,
        totalCountSubs: subscriptionBooks.length,
        bookList: combinedBooks,
      };
    } catch (error) {
        if (error instanceof Error) {
            console.error('경기도 전자도서관 검색 오류:', error.message);
            throw new Error(`경기도 전자도서관 검색 실패: ${error.message}`);
        }
        throw new Error('경기도 전자도서관 검색 중 알 수 없는 오류 발생');
    }
}

async function searchSiripEbookOwned(searchTitle: string): Promise<SiripEbookOwnedResult> {
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
        throw new Error(`시립도서관 소장형 전자책 HTTP ${response.status}`);
      }
      
      const htmlContent = await response.text();
      return parseSiripEbookOwnedHTML(htmlContent);
      
    } catch (error) {
        if (error instanceof Error) {
            console.error('시립도서관 소장형 전자책 검색 오류:', error.message);
            throw new Error(`시립도서관 소장형 전자책 검색 실패: ${error.message}`);
        }
        throw new Error('시립도서관 소장형 전자책 검색 중 알 수 없는 오류 발생');
    }
}

async function searchSiripEbookSubs(searchTitle: string): Promise<SiripEbookSubsResult> {
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
        
        const ownedData = ownedResults.status === 'fulfilled' ? ownedResults.value : null;
        const subsData = subscriptionResults.status === 'fulfilled' ? subscriptionResults.value : null;

        const ownedError = ownedResults.status === 'rejected' ? (ownedResults.reason as Error).message : ownedData?.error;
        const subsError = subscriptionResults.status === 'rejected' ? (subscriptionResults.reason as Error).message : subsData?.error;

        const combinedBookList: SiripEbookBook[] = [
            ...(ownedData?.bookList || []),
            ...(subsData?.bookList || [])
        ];

        const totalCountOwned = ownedData?.totalCount || 0;
        const totalCountSubs = subsData?.totalCount || 0;
        const totalCountSummary = totalCountOwned + totalCountSubs;

        const availableCountOwned = ownedData?.availableCount || 0;
        const availableCountSubs = subsData?.availableCount || 0;
        const availableCountSummary = availableCountOwned + availableCountSubs;

        const flatResult: SiripEbookResult = {
            libraryName: '시립도서관 전자책',
            totalCountSummary: totalCountSummary,
            availableCountSummary: availableCountSummary,
            unavailableCountSummary: totalCountSummary - availableCountSummary,
            totalCountOwned: totalCountOwned,
            totalCountSubs: totalCountSubs,
            availableCountOwned: availableCountOwned,
            availableCountSubs: availableCountSubs,
            searchQuery: searchTitle,
            bookList: combinedBookList,
        };
        
        if (ownedError || subsError) {
            flatResult.errors = {};
            if (ownedError) flatResult.errors.owned = ownedError;
            if (subsError) flatResult.errors.subscription = subsError;
        }
        
        return flatResult;

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
      
      let loanStatus: '대출가능' | '대출불가' | '알 수 없음' = "알 수 없음";
      let dueDate = "-";
      const statusEl = item.querySelector('.bookStateBar .txt');
      if (statusEl) {
          const statusText = statusEl.querySelector('b')?.text || "";
          if (statusText.includes('대출가능')) {
              loanStatus = '대출가능';
          } else if (statusText.includes('대출불가') || statusText.includes('대출중')) {
              loanStatus = '대출불가';
              const dueDateMatch = statusEl.text.match(/반납예정일:\s*([0-9.-]+)/i);
              if (dueDateMatch) dueDate = dueDateMatch[1].trim();
          }
      }
  
      return { title, author, publisher, pubDate, library, callNo, baseCallNo, status: loanStatus, dueDate };
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
          libraryName: "광주 시립도서관", totalCountSummary: 0, availableCountSummary: 0,
          totalCountToechon: 0, availableCountToechon: 0, totalCountOther: 0, availableCountOther: 0,
          title: "결과 없음", bookList: []
        };
      }
      
      const parsedBooks = bookItems.map(parseGwangjuBookItem).filter((book): book is GwangjuParsedItem => book !== null);
  
      let totalCountSummary = 0;
      let totalCountToechon = 0;
      let totalCountOther = 0;
      let availableCountSummary = 0;
      let availableCountToechon = 0;
      let availableCountOther = 0;
      
      const bookList: GwangjuPaperBook[] = parsedBooks.map(book => {
        const isAvailable = book.status === '대출가능';
        
        totalCountSummary++;
        if (isAvailable) availableCountSummary++;
  
        if (book.library === '퇴촌도서관') {
          totalCountToechon++;
          if (isAvailable) availableCountToechon++;
        } else {
          totalCountOther++;
          if (isAvailable) availableCountOther++;
        }
        
        return {
          libraryName: book.library,
          callNo: book.callNo,
          baseCallNo: book.baseCallNo,
          loanStatus: isAvailable,
          dueDate: book.dueDate,
        };
      });
  
      return {
        libraryName: "광주 시립도서관", totalCountSummary: totalCountSummary, availableCountSummary: availableCountSummary,
        totalCountToechon: totalCountToechon, availableCountToechon, totalCountOther, availableCountOther,
        title: parsedBooks[0]?.title || "제목 정보없음", bookList
      };
  
    } catch (error) {
        if (error instanceof Error) {
            console.error(`광주 파싱 오류: ${error.message}`);
            throw new Error(`광주 파싱 오류: ${error.message}`);
        }
        throw new Error('광주 파싱 중 알 수 없는 오류 발생');
    }
}

function parseGyeonggiEduHTML(html: string, libraryCode: string): { libraryName: string; bookList: gyeonggiEduEbook[] } {
    try {
      const libraryNameMap: { [key: string]: '성남도서관' | '통합도서관' } = { '10000004': '성남도서관', '10000009': '통합도서관' };
      const branchName = libraryNameMap[libraryCode] || `코드(${libraryCode})`;
  
      if (html.includes("찾으시는 자료가 없습니다")) {
        return { libraryName: `경기도교육청-${branchName}`, bookList: [] };
      }
  
      const root = parse(html);
      const bookItems = root.querySelectorAll('#search-results .row');
  
      if (bookItems.length === 0) {
        return { libraryName: `경기도교육청-${branchName}`, bookList: [] };
      }
  
      const loanStatus: gyeonggiEduEbook[] = bookItems.map(item => {
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
          libraryName: branchName, 
          title: title, 
          author: author, 
          publisher: publisher,
          pubDate: pubDate, 
          loanStatus: status === '대출가능', // 👈 [수정] 반환 시 boolean으로 변환
          isbn: isbn
        };
      }).filter((book): book is gyeonggiEduEbook => book.title !== "정보없음");
  
      return { libraryName: `경기도교육청-${branchName}`, bookList: loanStatus };
    } catch (error) {
        if (error instanceof Error) {
            console.error(`경기도교육청(${libraryCode}) 파싱 오류: ${error.message}`);
            throw new Error(`경기도교육청 파싱 오류: ${error.message}`);
        }
        throw new Error('경기도교육청 파싱 중 알 수 없는 오류 발생');
    }
}

function parseGyenggiEbookOwnedResults(json_data: any): gyeonggiEbook[] {
    try {
      if (!json_data || json_data.httpStatus !== 'OK' || !json_data.data) return [];
      const contents = json_data.data.contents || [];
      if (contents.length === 0) return [];
  
      return contents.map((book: any): gyeonggiEbook => {
        const loanStatus = (parseInt(book.COPYS || 0, 10) - parseInt(book.LOAN_CNT || 0, 10)) > 0;
        const pubDate = book.publishDate ? book.publishDate.split(' ')[0] : '정보없음';
        
        return {
          type: '소장형',
          title: book.TITLE || book.TITLE_N || '전자책',
          author: book.AUTHOR || book.AUTHOR_N || '',
          publisher: book.PUBLISHER || book.PUBLISHER_N || '',
          isbn: book.ISBN || '',
          pubDate: pubDate,
          loanStatus: loanStatus,
        };
      });
    } catch (error) {
      console.error('소장형 도서 파싱 오류:', error);
      return [];
    }
}
  
function parseGyenggiEbookSubsResults(json_data: any, query: string): gyeonggiEbook[] {
    try {
      if (!json_data || !Array.isArray(json_data.bookSearchResponses)) return [];
      
      const GyenggiEbookSubsList = json_data.bookSearchResponses;
      if (GyenggiEbookSubsList.length === 0) return [];
  
      return GyenggiEbookSubsList.map((book: any): gyeonggiEbook => {
        const pubDateRaw = book.ucm_ebook_pubdate || '';
        const pubDate = pubDateRaw ? pubDateRaw.split(' ')[0] : '정보없음';
        const title = book.ucm_title || book.title || '전자책';
  
        return {
          type: '구독형', title: title, author: book.ucm_writer || book.author || '',
          publisher: book.ucp_brand || book.publisher || '', isbn: book.ucm_ebook_isbn || book.isbn || '',
          pubDate: pubDate, loanStatus: true,
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
  
function parseSiripEbookOwnedHTML(html: string): SiripEbookOwnedResult {
    try {
      if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다')) {
        return { libraryName: '시립도서관 전자책-소장형', totalCount: 0, availableCount: 0, unavailableCount: 0, bookList: [] };
      }
  
      const root = parse(html);
      const bookItems = root.querySelectorAll('.book_resultList > li');
  
      if (bookItems.length === 0) {
        return { libraryName: '시립도서관 전자책-소장형', totalCount: 0, availableCount: 0, unavailableCount: 0, bookList: [] };
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
        let loanStatus = false;
  
        const useElement = item.querySelector('p.use');
        if (useElement) {
          const useText = useElement.text;
          const loanMatch = useText.match(/대출\s*:\s*(\d+)\/(\d+)/);
          if (loanMatch) {
            const currentBorrowed = parseInt(loanMatch[1], 10);
            totalCopies = parseInt(loanMatch[2], 10);
            availableCopies = Math.max(0, totalCopies - currentBorrowed);
            loanStatus = availableCopies > 0;
          }
        } else {
          totalCopies = 1;
          availableCopies = 1;
          loanStatus = true;
        }
        
        return {
          type: '소장형', title, author, publisher, publishDate, loanStatus, totalCopies, availableCopies,
        };
      });
  
      const availableCount = SiripEbookOwnedList.filter(book => book.loanStatus).length;
      const unavailableCount = SiripEbookOwnedList.length - availableCount;
  
      return {
        libraryName: '시립도서관 전자책-소장형',
        totalCount: SiripEbookOwnedList.length,
        availableCount: availableCount,
        unavailableCount: unavailableCount,
        bookList: SiripEbookOwnedList
      };
  
    } catch (error) {
        if (error instanceof Error) {
            console.error(`시립도서관 소장형 전자책 파싱 오류: ${error.message}`);
            throw new Error(`시립도서관 소장형 전자책 파싱 오류: ${error.message}`);
        }
        throw new Error('시립도서관 소장형 파싱 중 알 수 없는 오류 발생');
    }
}
  
function parseSiripEbookSubsHTML(html: string): SiripEbookSubsResult {
    try {
      if (html.includes('검색결과가 없습니다') || html.includes('자료가 없습니다')) {
        return { libraryName: '시립도서관 전자책-구독형', totalCount: 0, availableCount: 0, unavailableCount: 0, bookList: [] };
      }
  
      const root = parse(html);
      const bookItems = root.querySelectorAll('.book_resultList > li');
      
      if (bookItems.length === 0) {
        return { libraryName: '시립도서관 전자책-구독형', totalCount: 0, availableCount: 0, unavailableCount: 0, bookList: [] };
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
  
        return { type: '구독형', title, author, publisher, loanStatus: true, publishDate };
      });
  
      return {
        libraryName: '시립도서관 전자책-구독형',
        totalCount: SiripEbookSubsList.length,
        availableCount: SiripEbookSubsList.length,
        unavailableCount: 0,
        bookList: SiripEbookSubsList
      };
  
    } catch (error) {
      if (error instanceof Error) {
        console.error(`시립도서관 구독형 전자책 파싱 오류: ${error.stack}`);
        // ✅ 반환 타입에 맞게 error 속성을 추가하여 반환
        return { 
          libraryName: '시립도서관 전자책-구독형', totalCount: 0, availableCount: 0, unavailableCount: 0, 
          bookList: [], error: error.message 
        };
      }
      // ✅ 알 수 없는 오류 발생 시에도 타입에 맞는 객체 반환
      return { 
        libraryName: '시립도서관 전자책-구독형', totalCount: 0, availableCount: 0, unavailableCount: 0, 
        bookList: [], error: 'An unknown error occurred'
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
          loanStatus: book.status === '대출가능'
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
              if (result.status === 'fulfilled' && result.value?.bookList) { 
                  result.value.bookList.forEach(book => {
                      results.push({
                          type: '전자책',
                          libraryName: 'e교육',
                          title: book.title || '정보없음',
                          author: book.author || '정보없음',
                          publisher: book.publisher || '정보없음',
                          pubDate: book.pubDate || '정보없음',
                          loanStatus: book.loanStatus
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
  
      if (gyeonggiResult?.bookList && Array.isArray(gyeonggiResult.bookList)) {
        return gyeonggiResult.bookList.map(book => ({
          type: '전자책',
          libraryName: 'e경기',
          title: book.title || '정보없음',
          author: book.author || '정보없음',
          publisher: book.publisher || '정보없음',
          pubDate: book.pubDate || '정보없음',
          loanStatus: book.loanStatus || false,
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
    try {
        const siripResult = await searchSiripEbookIntegrated(keyword);

        // ✅ 평탄화된 bookList를 직접 순회합니다.
        if (siripResult?.bookList && Array.isArray(siripResult.bookList)) {
            return siripResult.bookList.map((book: SiripEbookBook) => { // ✅ book 타입을 명시하여 에러 해결
                if (book.type === '소장형') {
                    return {
                        type: '전자책',
                        libraryName: 'e시립소장',
                        title: book.title || '정보없음',
                        author: book.author || '정보없음',
                        publisher: book.publisher || '정보없음',
                        pubDate: book.publishDate || '정보없음',
                        loanStatus: book.loanStatus || false
                    };
                } else { // '구독형'
                    return {
                        type: '전자책',
                        libraryName: 'e시립구독',
                        title: book.title || '정보없음',
                        author: book.author || '정보없음',
                        publisher: book.publisher || '정보없음',
                        pubDate: book.publishDate || '정보없음',
                        loanStatus: book.loanStatus || true
                    };
                }
            });
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error('시립도서관 전자책 키워드 검색 오류:', error.message);
        }
    }
    return []; // ✅ forEach 대신 map을 사용하고, 에러 시 빈 배열을 반환하도록 로직 개선
}




// =======================================================
// ✅ [신규] 단일 책 재고 조회 및 DB 업데이트 페이로드 생성 함수
// (이 함수는 재고 조회 로직을 재사용하기 위해 추가됩니다)
// =======================================================

async function getStockUpdatePayload(
    book: { id: number; isbn13: string; title: string; author: string; customSearchTitle?: string | null },
    env: Env
): Promise<{[key: string]: any} | null> {
    try {
        const { isbn13, title, author, customSearchTitle } = book;

        // 경기도교육청, 경기도, 시립 도서관용 검색 제목 생성
        const eduTitle = customSearchTitle  || processGyeonggiEbookEduTitle(title);
        const gyeonggiTitle = customSearchTitle  || processGyeonggiEbookTitle(title);
        const siripTitle = customSearchTitle  || processSiripEbookTitle(title);
        
        // 병렬로 모든 도서관 재고 조회
        const [
            gwangjuPaperResult,
            gyeonggiEbookEduResult,
            gyeonggiEbookLibResult,
            siripEbookResult
        ] = await Promise.allSettled([
            searchGwangjuLibrary(isbn13),
            // eduTitle이 있을 때만 경기도교육청 전자도서관 조회
            eduTitle ? Promise.all([
                searchGyeonggiEduEbook(eduTitle, '10000004'),
                searchGyeonggiEduEbook(eduTitle, '10000009')
            ]) : Promise.resolve(null),
            gyeonggiTitle ? searchGyeonggiEbookLibrary(gyeonggiTitle) : Promise.resolve(null),
            siripTitle ? searchSiripEbookIntegrated(siripTitle) : Promise.resolve(null)
        ]);
        
        const dbUpdatePayload: { [key: string]: any } = {};

        // 광주 시립도서관 (종이책)
        if (gwangjuPaperResult.status === 'fulfilled') {
            const data = gwangjuPaperResult.value;
            dbUpdatePayload.stock_gwangju_toechon_total = data.totalCountToechon;
            dbUpdatePayload.stock_gwangju_toechon_available = data.availableCountToechon;
            dbUpdatePayload.stock_gwangju_other_total = data.totalCountOther;
            dbUpdatePayload.stock_gwangju_other_available = data.availableCountOther;
        }

        // 경기도 교육청 전자도서관
        if (gyeonggiEbookEduResult.status === 'fulfilled' && gyeonggiEbookEduResult.value) {
            const [seongnam, tonghap] = gyeonggiEbookEduResult.value;
            const total = (seongnam?.bookList.length || 0) + (tonghap?.bookList.length || 0);
            const available = (seongnam?.bookList.filter(b => b.loanStatus).length || 0) + (tonghap?.bookList.filter(b => b.loanStatus).length || 0);
            dbUpdatePayload.stock_gyeonggi_edu_total = total;
            dbUpdatePayload.stock_gyeonggi_edu_available = available;
        }

        // 경기도 전자도서관
        if (gyeonggiEbookLibResult.status === 'fulfilled' && gyeonggiEbookLibResult.value) {
            const data = gyeonggiEbookLibResult.value;
            dbUpdatePayload.stock_gyeonggi_total = data.totalCountSummary;
            dbUpdatePayload.stock_gyeonggi_available = data.availableCountSummary;
        }

        // 시립도서관 전자책
        if (siripEbookResult.status === 'fulfilled' && siripEbookResult.value) {
            const data = siripEbookResult.value;
            dbUpdatePayload.stock_sirip_subs_total = data.totalCountSubs;
            dbUpdatePayload.stock_sirip_owned_total = data.totalCountOwned;
            dbUpdatePayload.stock_sirip_subs_available = data.availableCountSubs;
            dbUpdatePayload.stock_sirip_owned_available = data.availableCountOwned;
        }
        
        // 업데이트할 내용이 있을 때만 payload 반환
        return Object.keys(dbUpdatePayload).length > 0 ? dbUpdatePayload : null;

    } catch (error) {
        console.error(`[Auto-Refresh] Failed to get stock for Book ID ${book.id}:`, error);
        return null;
    }
}


// ================================================
// ✅ [신규] 스케줄된 작업을 위한 헬퍼 함수들
// ================================================

async function handleStockRefresh(env: Env): Promise<void> {
    try {
        // Supabase 클라이언트 초기화 (service_role 키 사용)
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

        // 1. DB 함수를 호출하여 갱신 대상 책 목록 가져오기
        const { data: booksToRefresh, error: rpcError } = await supabase.rpc('get_books_to_refresh');

        if (rpcError) {
            console.error('[CRON ERROR] Failed to fetch books from Supabase:', rpcError);
            return;
        }

        if (!booksToRefresh || booksToRefresh.length === 0) {
            console.log('[CRON INFO] No books with stock errors found. Task finished.');
            return;
        }

        console.log(`[CRON INFO] Found ${booksToRefresh.length} books to refresh.`);
        let successCount = 0;
        let failureCount = 0;

        // 2. 각 책을 순회하며 재고 조회 및 DB 업데이트
        for (const book of booksToRefresh) {
            console.log(`[CRON PROCESS] Refreshing stock for book ID: ${book.id}, Title: ${book.title}`);

            // 재고 조회 로직 호출
            const updatePayload = await getStockUpdatePayload(book, env);

            if (updatePayload) {
                // 3. 조회 성공 시 Supabase DB 업데이트
                const { error: updateError } = await supabase
                    .from('user_library')
                    .update(updatePayload)
                    .eq('id', book.id);

                if (updateError) {
                    console.error(`[CRON ERROR] Failed to update book ID ${book.id}:`, updateError);
                    failureCount++;
                } else {
                    console.log(`[CRON SUCCESS] Successfully updated book ID ${book.id}`);
                    successCount++;
                }
            } else {
                console.warn(`[CRON WARN] No stock data found for book ID ${book.id}, skipping update.`);
                failureCount++;
            }

            // 4. Rate Limiting 방지를 위해 각 요청 사이에 2초 지연
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`[CRON END] Task finished. Success: ${successCount}, Failure: ${failureCount}`);

    } catch (error) {
        console.error('[CRON CRITICAL] An unexpected error occurred during stock refresh:', error);
    }
}

async function handleKeepAlive(env: Env): Promise<void> {
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


// ==============================================
// ✅ 메인 Worker 핸들러 (export default)
// ==============================================

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {


    // ✅ [추가 시작] 로컬 테스트를 위한 /__scheduled 엔드포인트 처리
    const url = new URL(request.url);
    if (url.pathname === '/__scheduled') {
      console.log(`[DEV ONLY] Detected manual trigger for scheduled event via ${request.method} /__scheduled`);
      // waitUntil을 사용하여 백그라운드에서 scheduled 핸들러가 완전히 실행되도록 보장
      ctx.waitUntil(this.scheduled({ cron: '' } as ScheduledEvent, env, ctx));
      // 클라이언트에게는 즉시 성공 응답을 보냄
      return new Response('Scheduled event triggered for testing.', { status: 200 });
    }
    // ✅ [추가 끝]

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // const url = new URL(request.url);
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

        // ▼▼▼▼▼ [수정 시작] isDbSchemaChanged 플래그 추출 및 기본값 설정 ▼▼▼▼▼
        const { isDbSchemaChanged = false, ...otherBodyParams } = body;
        
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

        // let response: Response | null = null;
        let response: Response | undefined = undefined;
        
        console.log('[CACHE DEBUG] Key String:', cacheKeyString);
        console.log('[CACHE DEBUG] Cache Key URL:', cacheUrl.toString());
  
        // ▼▼▼▼▼ [수정 시작] isDbSchemaChanged 값에 따라 캐시 조회 분기 ▼▼▼▼▼
        // isDbSchemaChanged가 false일 때만 캐시를 조회합니다. (true이면 캐시 우회)
        if (!isDbSchemaChanged) {
            response = await cache.match(cacheKeyRequest);
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
        } else {
            console.warn("[Cache Bypass] DB 스키마 변경 감지로 캐시 조회를 건너뜁니다.");
        }
        // ▲▲▲▲▲ [수정 끝] ▲▲▲▲▲
        
        try {
            console.log(`Request received - ISBN: ${isbn}, Author: "${author}", eduTitle: "${eduTitle}", gyeonggiTitle: "${gyeonggiTitle}", SiripTitle: "${siripTitle}"`);
    
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
    
            let gyeonggiEbookPromise: Promise<gyeonggiEbookResult> | null = null;
            if (gyeonggiTitle) {
              gyeonggiEbookPromise = searchGyeonggiEbookLibrary(gyeonggiTitle);
            }
    
            let siripEbookPromise: Promise<SiripEbookResult> | null = null;
            if (siripTitle) {
              siripEbookPromise = searchSiripEbookIntegrated(siripTitle);
            }
    
            const results = await Promise.allSettled(promises);
    
            let gyeonggiEbookResult: gyeonggiEbookResult | { error: string } | null = null;
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
              gwangjuPaper: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason.message },
              gyeonggiEbookEdu: null,
              gyeonggiEbookLib: gyeonggiEbookResult,
              siripEbook: siripEbookResult || null
            };
    
            if (eduTitle && results.length > 1) {
              const combinedEduBooks: (gyeonggiEduEbook | { library: string; error: string })[] = [];
              
              const res1 = results[1];
              if (res1.status === 'fulfilled' && res1.value?.bookList) {
                combinedEduBooks.push(...res1.value.bookList);
              }
              const res2 = results[2];
              if (res2.status === 'fulfilled' && res2.value?.bookList) {
                combinedEduBooks.push(...res2.value.bookList);
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
    
              let totalCountSummary = 0;
              let availableCountSummary = 0;
              let totalCountSeongnam = 0;
              let totalCountTonghap = 0;
              let errorCount = 0;
    
              const validBooks = combinedEduBooks.filter((book): book is gyeonggiEduEbook => !('error' in book));
    
              totalCountSummary = validBooks.length;
              availableCountSummary = validBooks.filter(b => b.loanStatus).length;
              totalCountSeongnam = validBooks.filter(b => b.libraryName === '성남도서관').length;
              totalCountTonghap = validBooks.filter(b => b.libraryName === '통합도서관').length;
              errorCount = errorLibs.length;
    
              finalResult.gyeonggiEbookEdu = {
                libraryName: "경기도교육청 전자도서관",
                totalCountSummary: totalCountSummary,
                availableCountSummary: availableCountSummary,
                unavailableCountSummary: totalCountSummary - availableCountSummary,
                totalCountSeongnam,
                totalCountTonghap,
                errorCount,
                errorLibDetail: errorLibs.length > 0 ? `에러 발생: ${errorLibs.join(', ')}` : undefined,
                bookList: validBooks
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

  
  // ----------------------------------------------
  // 2. 신규/수정 scheduled 핸들러 (자동화 로직)
  // ----------------------------------------------
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    
    // event.cron 속성을 사용하여 어떤 스케줄이 실행되었는지 확인
    switch (event.cron) {
      case "0 17 * * *": // 재고 자동 갱신 스케줄
        console.log(`[CRON START] Starting scheduled stock refresh at ${new Date().toISOString()}`);
        // ctx.waitUntil()을 사용하여 스케줄된 이벤트가 완료될 때까지 실행을 보장
        ctx.waitUntil(handleStockRefresh(env));
        break;

      case "0 12 */3 * *": // Supabase Keep-Alive 스케줄
        console.log(`[CRON START] Starting Supabase Keep-Alive at ${new Date().toISOString()}`);
        ctx.waitUntil(handleKeepAlive(env));
        break;

      default:
        // wrangler dev로 테스트 시 event.cron은 빈 문자열("")
        if (event.cron === '') {
            console.log(`[MANUAL TRIGGER] Manually running stock refresh for testing.`);
            ctx.waitUntil(handleStockRefresh(env));
        } else {
            console.warn(`[CRON WARN] Unknown cron schedule: ${event.cron}`);
        }
        break;
    }
  }
};


var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// workers_finalv6.js
var workers_finalv6_default = {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          message: "4-Way \uD1B5\uD569 \uB3C4\uC11C\uAD00 \uC7AC\uACE0 \uD655\uC778 API + \uACBD\uAE30\uB3C4 \uC804\uC790\uB3C4\uC11C\uAD00 API/HTML \uD1B5\uD569 + Supabase Keep-Alive",
          version: "6.0-production-unified"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (request.method === "POST") {
      try {
        const text = await request.text();
        const body = JSON.parse(text);
        const { isbn, title = "", gyeonggiTitle = "" } = body;
        console.log(`Request received - ISBN: ${isbn}, Title: "${title}", GyeonggiTitle: "${gyeonggiTitle}"`);
        if (!isbn) {
          return new Response(JSON.stringify({ error: "isbn \uD30C\uB77C\uBBF8\uD130\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const promises = [
          searchGwangjuLibrary(isbn)
        ];
        let gyeonggiEbookPromise = null;
        if (title) {
          promises.push(
            searchSingleGyeonggiEbook(title, "10000004"),
            // 성남 (기존 title 사용)
            searchSingleGyeonggiEbook(title, "10000009")
            // 통합 (기존 title 사용)
          );
        }
        if (gyeonggiTitle) {
          gyeonggiEbookPromise = searchGyeonggiEbookLibraryAPI(gyeonggiTitle);
        } else if (title) {
          gyeonggiEbookPromise = searchGyeonggiEbookLibrary(title);
        }
        const results = await Promise.allSettled(promises);
        let gyeonggiEbookResult = null;
        if (gyeonggiEbookPromise) {
          try {
            gyeonggiEbookResult = await gyeonggiEbookPromise;
          } catch (error) {
            gyeonggiEbookResult = { error: error.message };
          }
        }
        const finalResult = {
          gwangju_paper: results[0].status === "fulfilled" ? results[0].value : { error: results[0].reason.message },
          gyeonggi_ebooks: [],
          gyeonggi_ebook_library: gyeonggiEbookResult
        };
        if (title && results.length > 1) {
          if (results[1].status === "fulfilled" && results[1].value?.availability) {
            finalResult.gyeonggi_ebooks.push(...results[1].value.availability);
          }
          if (results[2].status === "fulfilled" && results[2].value?.availability) {
            finalResult.gyeonggi_ebooks.push(...results[2].value.availability);
          }
          if (finalResult.gyeonggi_ebooks.length === 0) {
            if (results[1]?.status === "rejected") finalResult.gyeonggi_ebooks.push({ library: "\uC131\uB0A8\uB3C4\uC11C\uAD00", error: `\uAC80\uC0C9 \uC2E4\uD328: ${results[1].reason.message}` });
            if (results[2]?.status === "rejected") finalResult.gyeonggi_ebooks.push({ library: "\uD1B5\uD569\uB3C4\uC11C\uAD00", error: `\uAC80\uC0C9 \uC2E4\uD328: ${results[2].reason.message}` });
          }
        }
        return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        console.error(`API Error: ${error.message}`);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  },
  // Supabase 무료요금제에서 7일 비활성화시 잠금 예방 위해서 3일에 1번씩 ping 보내는 Scheduled Events 처리
  async scheduled(event, env, ctx) {
    try {
      console.log("=== Supabase Keep-Alive Start ===");
      console.log("Triggered at:", (/* @__PURE__ */ new Date()).toISOString());
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/keep_alive`, {
        method: "POST",
        headers: {
          "apikey": env.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(1e4)
      });
      if (response.ok) {
        const result = await response.json();
        console.log("\u2705 Supabase keep-alive SUCCESS:", result);
      } else {
        console.error("\u274C Supabase keep-alive FAILED:", response.status);
      }
    } catch (error) {
      console.error("\u{1F4A5} Supabase keep-alive ERROR:", error.message);
    }
  }
};
async function searchGwangjuLibrary(isbn) {
  const url = "https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchResultList.do";
  const payload = new URLSearchParams({ "searchType": "DETAIL", "searchKey5": "ISBN", "searchKeyword5": isbn, "searchLibrary": "ALL", "searchSort": "SIMILAR", "searchRecordCount": "30" });
  const headers = { "User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://lib.gjcity.go.kr:8443/kolaseek/plus/search/plusSearchDetail.do" };
  const response = await fetch(url, { method: "POST", headers, body: payload.toString(), signal: AbortSignal.timeout(2e4) });
  if (!response.ok) throw new Error(`\uACBD\uAE30\uAD11\uC8FC HTTP ${response.status}`);
  const htmlContent = await response.text();
  return parseGwangjuHTML(htmlContent);
}
__name(searchGwangjuLibrary, "searchGwangjuLibrary");
async function searchSingleGyeonggiEbook(searchText, libraryCode) {
  const url = new URL("https://lib.goe.go.kr/elib/module/elib/search/index.do");
  url.searchParams.set("menu_idx", "94");
  url.searchParams.set("search_text", searchText);
  url.searchParams.set("library_code", libraryCode);
  url.searchParams.set("libraryCode", libraryCode);
  url.searchParams.set("sortField", "book_pubdt");
  url.searchParams.set("sortType", "desc");
  url.searchParams.set("rowCount", "50");
  const headers = { "User-Agent": "Mozilla/5.0" };
  const response = await fetch(url.toString(), { method: "GET", headers, signal: AbortSignal.timeout(2e4) });
  if (!response.ok) throw new Error(`\uACBD\uAE30\uB3C4\uAD50\uC721\uCCAD(${libraryCode}) HTTP ${response.status}`);
  const htmlContent = await response.text();
  return parseGyeonggiHTML(htmlContent, libraryCode);
}
__name(searchSingleGyeonggiEbook, "searchSingleGyeonggiEbook");
async function searchGyeonggiEbookLibrary(searchText) {
  const baseUrl = "https://ebook.library.kr/search";
  const encodedTitle = encodeURIComponent(searchText).replace(/'/g, "%27");
  const detailQuery = `TITLE:${encodedTitle}:true`;
  const url = `${baseUrl}?detailQuery=${detailQuery}&OnlyStartWith=false&searchType=all&listType=list`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
  };
  const response = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(25e3) });
  if (!response.ok) throw new Error(`\uACBD\uAE30\uB3C4 \uC804\uC790\uB3C4\uC11C\uAD00 HTTP ${response.status}`);
  const htmlContent = await response.text();
  console.log(`\uAC80\uC0C9\uC5B4: ${searchText}, URL: ${url}`);
  console.log("HTML \uC751\uB2F5 \uC77C\uBD80:", htmlContent.substring(0, 1e3));
  console.log('HTML\uC5D0\uC11C "\uC18C\uC7A5\uD615" \uAC80\uC0C9:', htmlContent.includes("\uC18C\uC7A5\uD615"));
  console.log('HTML\uC5D0\uC11C "\uAD6C\uB3C5\uD615" \uAC80\uC0C9:', htmlContent.includes("\uAD6C\uB3C5\uD615"));
  return parseGyeonggiEbookLibraryHTML(htmlContent);
}
__name(searchGyeonggiEbookLibrary, "searchGyeonggiEbookLibrary");
async function searchGyeonggiEbookLibraryAPI(searchText) {
  console.log(`Searching Gyeonggi Ebook Library API with: "${searchText}"`);
  const apiUrl = "https://ebook.library.kr/api/service/search-engine";
  const detailQuery = `TITLE:${searchText}:true`;
  const encodedDetailQuery = encodeURIComponent(detailQuery);
  const url = `${apiUrl}?contentType=EB&searchType=all&detailQuery=${encodedDetailQuery}&sort=relevance&asc=desc&loanable=false&withFacet=true&page=1&size=20`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Referer": "https://ebook.library.kr/search",
    "X-Requested-With": "XMLHttpRequest"
  };
  try {
    console.log(`API URL: ${url}`);
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(2e4)
    });
    if (!response.ok) {
      throw new Error(`\uACBD\uAE30\uB3C4 \uC804\uC790\uB3C4\uC11C\uAD00 API HTTP ${response.status}: ${response.statusText}`);
    }
    const jsonData = await response.json();
    console.log(`API Response:`, JSON.stringify(jsonData, null, 2));
    return parseGyeonggiEbookAPIResponse(jsonData, searchText);
  } catch (error) {
    console.error(`Gyeonggi Ebook API Error:`, error);
    throw new Error(`\uACBD\uAE30\uB3C4 \uC804\uC790\uB3C4\uC11C\uAD00 API \uD638\uCD9C \uC2E4\uD328: ${error.message}`);
  }
}
__name(searchGyeonggiEbookLibraryAPI, "searchGyeonggiEbookLibraryAPI");
function parseGwangjuHTML(html) {
  try {
    const bookListMatch = html.match(/<ul[^>]*class[^>]*resultList[^>]*imageType[^>]*>([\s\S]*?)<\/ul>/i);
    if (!bookListMatch) return { book_title: "\uACB0\uACFC \uC5C6\uC74C", availability: [] };
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    const bookItems = [...bookListMatch[1].matchAll(liPattern)];
    if (bookItems.length === 0) return { book_title: "\uACB0\uACFC \uC5C6\uC74C", availability: [] };
    const firstBookHtml = bookItems[0][1];
    const titleMatch = firstBookHtml.match(/<dt[^>]*class[^>]*tit[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    let title = titleMatch ? titleMatch[1].trim().replace(/^\d+\.\s*/, "") : "\uC81C\uBAA9 \uC815\uBCF4 \uC5C6\uC74C";
    const availability = bookItems.map((item) => {
      const bookHtml = item[1];
      const library = bookHtml.match(/<dd[^>]*class[^>]*site[^>]*>[\s\S]*?<span[^>]*>도서관:\s*([^<]+)<\/span>/i)?.[1].trim() || "\uC815\uBCF4 \uC5C6\uC74C";
      const callNo = bookHtml.match(/청구기호:\s*([^\n<]+?)(?:\s*<|$)/i)?.[1].trim() || "\uC815\uBCF4 \uC5C6\uC74C";
      const baseCallNo = callNo.split("=")[0];
      let status = "\uC54C \uC218 \uC5C6\uC74C";
      let dueDate = "-";
      const statusSectionMatch = bookHtml.match(/<div[^>]*class[^>]*bookStateBar[^>]*>[\s\S]*?<p[^>]*class[^>]*txt[^>]*>([\s\S]*?)<\/p>/i);
      if (statusSectionMatch) {
        const statusContent = statusSectionMatch[1];
        const statusText = statusContent.match(/<b[^>]*>([^<]+)<\/b>/i)?.[1].trim() || "";
        if (statusText.includes("\uB300\uCD9C\uAC00\uB2A5")) status = "\uB300\uCD9C\uAC00\uB2A5";
        else if (statusText.includes("\uB300\uCD9C\uBD88\uAC00") || statusText.includes("\uB300\uCD9C\uC911")) {
          status = "\uB300\uCD9C\uBD88\uAC00";
          dueDate = statusContent.match(/반납예정일:\s*([0-9.-]+)/i)?.[1].trim() || "-";
        }
      }
      return { "\uC18C\uC7A5\uB3C4\uC11C\uAD00": library, "\uCCAD\uAD6C\uAE30\uD638": callNo, "\uAE30\uBCF8\uCCAD\uAD6C\uAE30\uD638": baseCallNo, "\uB300\uCD9C\uC0C1\uD0DC": status, "\uBC18\uB0A9\uC608\uC815\uC77C": dueDate };
    });
    return { book_title: title, availability };
  } catch (error) {
    throw new Error(`\uAD11\uC8FC \uD30C\uC2F1 \uC624\uB958: ${error.message}`);
  }
}
__name(parseGwangjuHTML, "parseGwangjuHTML");
function parseGyeonggiHTML(html, libraryCode) {
  try {
    const libraryNameMap = { "10000004": "\uC131\uB0A8\uB3C4\uC11C\uAD00", "10000009": "\uD1B5\uD569\uB3C4\uC11C\uAD00" };
    const branchName = libraryNameMap[libraryCode] || `\uCF54\uB4DC(${libraryCode})`;
    if (html.includes("\uCC3E\uC73C\uC2DC\uB294 \uC790\uB8CC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4")) {
      return { library_name: `\uACBD\uAE30\uB3C4\uAD50\uC721\uCCAD-${branchName}`, availability: [] };
    }
    const searchResultsMatch = html.match(/<div id="search-results" class="search-results">([\s\S]*?)<div id="cms_paging"/i);
    if (!searchResultsMatch) {
      return { library_name: `\uACBD\uAE30\uB3C4\uAD50\uC721\uCCAD-${branchName}`, availability: [] };
    }
    const searchResultsHtml = searchResultsMatch[1];
    const bookItemsPattern = /<div class="row">[\s\S]*?<\/div>\s*(?=<div class="row">|$)/gi;
    const bookItems = [...searchResultsHtml.matchAll(bookItemsPattern)];
    if (bookItems.length === 0) {
      return { library_name: `\uACBD\uAE30\uB3C4\uAD50\uC721\uCCAD-${branchName}`, availability: [] };
    }
    const availability = bookItems.map((match) => {
      const bookHtml = match[0];
      let title = bookHtml.match(/<a[^>]+class="name goDetail"[^>]*>([\s\S]*?)<\/a>/i)?.[1].trim() || "\uC815\uBCF4 \uC5C6\uC74C";
      title = title.replace(/<[^>]*>/g, "").trim();
      const infoBlock = bookHtml.match(/<div class="bif">([\s\S]*?)<\/div>/i)?.[1] || "";
      const author = infoBlock.match(/저자\s*:\s*(.*?)(?:<span|<br|\s*│)/i)?.[1]?.trim() || "\uC815\uBCF4 \uC5C6\uC74C";
      const publisher = infoBlock.match(/출판사\s*:\s*(.*?)(?:<span|<br|\s*│)/i)?.[1]?.trim() || "\uC815\uBCF4 \uC5C6\uC74C";
      const pubDate = infoBlock.match(/발행일자\s*:\s*(.*?)(?:<span|<br|\s*│|$)/i)?.[1]?.trim() || "\uC815\uBCF4 \uC5C6\uC74C";
      let statusText = "\uC815\uBCF4 \uC5C6\uC74C";
      const statusPatterns = [
        /대출\s*가능\s*여부\s*:\s*(.*?)(?:<br|<span|\s*│|$)/i,
        /대출\s*가능\s*여부\s*:\s*(.*?)(?:\\n|<|$)/i,
        /대출\s*가능\s*여부\s*:\s*([^<\n]+)/i,
        /대출.*?가능.*?여부.*?:\\s*(.*?)(?:<br|<span|\s*│|$)/i
      ];
      for (const pattern of statusPatterns) {
        const match2 = infoBlock.match(pattern);
        if (match2 && match2[1]) {
          statusText = match2[1].trim();
          break;
        }
      }
      if (statusText === "\uC815\uBCF4 \uC5C6\uC74C") {
        console.log(`\uB514\uBC84\uADF8 - \uB3C4\uC11C\uBA85: ${title}`);
        console.log(`\uB514\uBC84\uADF8 - infoBlock \uB0B4\uC6A9:`, infoBlock.substring(0, 500));
      }
      let status = "\uC54C \uC218 \uC5C6\uC74C";
      if (statusText.includes("\uB300\uCD9C \uAC00\uB2A5") || statusText.includes("\uB300\uCD9C\uAC00\uB2A5")) {
        status = "\uB300\uCD9C\uAC00\uB2A5";
      } else if (statusText.includes("\uB300\uCD9C\uC911") || statusText.includes("\uB300\uCD9C \uBD88\uAC00") || statusText.includes("\uB300\uCD9C\uBD88\uAC00")) {
        status = "\uB300\uCD9C\uBD88\uAC00";
      }
      return { "\uC18C\uC7A5\uB3C4\uC11C\uAD00": branchName, "\uB3C4\uC11C\uBA85": title, "\uC800\uC790": author, "\uCD9C\uD310\uC0AC": publisher, "\uBC1C\uD589\uC77C": pubDate, "\uB300\uCD9C\uC0C1\uD0DC": status };
    });
    return { library_name: `\uACBD\uAE30\uB3C4\uAD50\uC721\uCCAD-${branchName}`, availability };
  } catch (error) {
    console.error(`\uACBD\uAE30\uB3C4\uAD50\uC721\uCCAD(${libraryCode}) \uD30C\uC2F1 \uC624\uB958: ${error.message}`);
    throw new Error(`\uACBD\uAE30\uB3C4\uAD50\uC721\uCCAD \uD30C\uC2F1 \uC624\uB958: ${error.message}`);
  }
}
__name(parseGyeonggiHTML, "parseGyeonggiHTML");
function parseGyeonggiEbookAPIResponse(apiData, originalSearchText) {
  const libraryName = "\uACBD\uAE30\uB3C4\uC804\uC790\uB3C4\uC11C\uAD00";
  let books = [];
  let totalCount = 0;
  let availableCount = 0;
  let unavailableCount = 0;
  let ownedCount = 0;
  let subscriptionCount = 0;
  if (apiData && apiData.data && apiData.data.contents && Array.isArray(apiData.data.contents)) {
    const contents = apiData.data.contents;
    totalCount = apiData.data.totalElements || contents.length;
    books = contents.map((item) => {
      const isAvailable = item.LOANABLE === "1";
      const type = item.CONTENT_TYPE_DESC || "\uC18C\uC7A5\uD615";
      if (isAvailable) {
        availableCount++;
      } else {
        unavailableCount++;
      }
      if (type === "\uC18C\uC7A5\uD615") {
        ownedCount++;
      } else {
        subscriptionCount++;
      }
      return {
        type,
        title: item.TITLE || item.TITLE_N || "Unknown",
        status: isAvailable ? "\uB300\uCD9C\uAC00\uB2A5" : "\uB300\uCD9C\uBD88\uAC00",
        current_borrow: parseInt(item.LOAN_CNT) || 0,
        total_capacity: parseInt(item.COPYS) || 1,
        author: item.AUTHOR || item.AUTHOR_N || "Unknown",
        publisher: item.PUBLISHER || item.PUBLISHER_N || "Unknown",
        isbn: item.ISBN || "",
        owner: item.OWNER_NAME || "",
        reservable: item.RESERVABLE === "1",
        reserve_count: parseInt(item.RESERVE_CNT) || 0
      };
    });
  }
  return {
    library_name: libraryName,
    total_count: totalCount,
    available_count: availableCount,
    unavailable_count: unavailableCount,
    owned_count: ownedCount,
    subscription_count: subscriptionCount,
    books
  };
}
__name(parseGyeonggiEbookAPIResponse, "parseGyeonggiEbookAPIResponse");
function parseGyeonggiEbookLibraryHTML(html) {
  try {
    console.log("\uACBD\uAE30\uB3C4 \uC804\uC790\uB3C4\uC11C\uAD00 \uD30C\uC2F1 \uC2DC\uC791");
    console.log("HTML \uAE38\uC774:", html.length);
    const noResultPatterns = [
      "\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
      "\uAC80\uC0C9\uB41C \uC790\uB8CC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
      "\uAC80\uC0C9\uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
      "No results found",
      'class="noResult"'
    ];
    const hasNoResults = noResultPatterns.some((pattern) => html.includes(pattern));
    if (hasNoResults) {
      console.log("\uAC80\uC0C9 \uACB0\uACFC \uC5C6\uC74C \uD655\uC778\uB428");
      return {
        library_name: "\uACBD\uAE30\uB3C4 \uC804\uC790\uB3C4\uC11C\uAD00",
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
    console.log("HTML\uC5D0\uC11C searchResultList \uCC3E\uAE30...");
    const allSections = html.match(/<div class="searchResultList"[^>]*>/g) || [];
    console.log("\uBC1C\uACAC\uB41C \uC139\uC158\uB4E4:", allSections);
    const dataTypes = allSections.map((section) => {
      const match = section.match(/data-type="([^"]*)"/);
      return match ? match[1] : "unknown";
    });
    console.log("data-type \uAC12\uB4E4:", dataTypes);
    const ebSectionMatch = html.match(/<div class="searchResultList" data-type="EB">([\s\S]*?)(?=<div class="searchResultList" data-type="(?:SUBS|AB)"|$)/i);
    if (ebSectionMatch) {
      console.log("\uC18C\uC7A5\uD615(EB) \uC139\uC158 \uBC1C\uACAC");
      console.log("EB \uC139\uC158 \uAE38\uC774:", ebSectionMatch[1].length);
      const ebCountPatterns = [
        /<em>소장형 \(<span>(\d+)<\/span>\)<\/em>/i,
        /<em>소장형.*?(\d+).*?<\/em>/i,
        /소장형.*?(\d+)/i
      ];
      for (const pattern of ebCountPatterns) {
        const match = ebSectionMatch[1].match(pattern);
        if (match) {
          ownedCount = parseInt(match[1], 10);
          console.log(`\uC18C\uC7A5\uD615 \uAC1C\uC218 \uBC1C\uACAC: ${ownedCount} (\uD328\uD134: ${pattern})`);
          break;
        }
      }
      if (ownedCount > 0) {
        availableCount = ownedCount;
        console.log(`\uC18C\uC7A5\uD615 \uCC45 \uC788\uC74C - \uB300\uCD9C\uAC00\uB2A5\uC73C\uB85C \uC124\uC815: ${availableCount}`);
        for (let i = 0; i < ownedCount; i++) {
          books.push({
            type: "\uC18C\uC7A5\uD615",
            title: "\uC18C\uC7A5\uD615 \uC804\uC790\uCC45",
            status: "\uB300\uCD9C\uAC00\uB2A5",
            current_borrow: 0,
            total_capacity: 1
          });
        }
      }
      const buttonPatterns = [
        /<button[^>]*class="[^ vital]*btn[^ vital]*"[^>]*>([^<]*)<small[^>]*>(\d+)\/(\d+)<\/small><\/button>/gi,
        /<button[^>]*>([^<]*)<small[^>]*>(\d+)\/(\d+)<\/small><\/button>/gi,
        /대출하기|예약하기|이용하기/gi
      ];
      console.log("\uBC84\uD2BC \uD328\uD134 \uAC80\uC0C9 \uC2DC\uC791...");
      for (const pattern of buttonPatterns) {
        const matches = [...ebSectionMatch[1].matchAll(pattern)];
        console.log(`\uD328\uD134 ${pattern} \uB9E4\uCE58 \uC218: ${matches.length}`);
        if (matches.length > 0) {
          console.log("\uCCAB \uBC88\uC9F8 \uB9E4\uCE58:", matches[0]);
        }
      }
    }
    const subsSectionMatch = html.match(/<div class="searchResultList" data-type="SUBS">([\s\S]*?)(?=<div class="searchResultList" data-type="AB"|$)/i);
    if (subsSectionMatch) {
      console.log("\uAD6C\uB3C5\uD615(SUBS) \uC139\uC158 \uBC1C\uACAC");
      const subsCountPatterns = [
        /<em>구독형 \(<span>(\d+)<\/span>\)<\/em>/i,
        /<em>구독형.*?(\d+).*?<\/em>/i,
        /구독형.*?(\d+)/i
      ];
      for (const pattern of subsCountPatterns) {
        const match = subsSectionMatch[1].match(pattern);
        if (match) {
          subscriptionCount = parseInt(match[1], 10);
          console.log(`\uAD6C\uB3C5\uD615 \uAC1C\uC218 \uBC1C\uACAC: ${subscriptionCount} (\uD328\uD134: ${pattern})`);
          break;
        }
      }
      if (subscriptionCount > 0) {
        availableCount += subscriptionCount;
        console.log(`\uAD6C\uB3C5\uD615 ${subscriptionCount}\uAD8C\uC744 \uB300\uCD9C\uAC00\uB2A5\uC73C\uB85C \uC124\uC815`);
        for (let i = 0; i < subscriptionCount; i++) {
          books.push({
            type: "\uAD6C\uB3C5\uD615",
            title: "\uAD6C\uB3C5\uD615 \uC804\uC790\uCC45",
            status: "\uB300\uCD9C\uAC00\uB2A5"
          });
        }
      }
    }
    if (ownedCount === 0 && subscriptionCount === 0) {
      console.log("EB/SUBS \uC139\uC158\uC5D0\uC11C \uCC3E\uC9C0 \uBABB\uD568. \uC77C\uBC18 \uAC80\uC0C9 \uACB0\uACFC \uD655\uC778...");
      const generalBookPatterns = [
        /class="bookItem"/gi,
        /class="book"/gi,
        /<li[^>]*book/gi,
        /대출하기|예약하기|이용하기/gi
      ];
      let foundBooks = 0;
      generalBookPatterns.forEach((pattern, index) => {
        const matches = html.match(pattern) || [];
        console.log(`\uC77C\uBC18 \uD328\uD134 ${index + 1}: ${matches.length}\uAC1C \uB9E4\uCE58`);
        if (matches.length > foundBooks) {
          foundBooks = matches.length;
        }
      });
      if (foundBooks > 0) {
        console.log(`\uC77C\uBC18 \uAC80\uC0C9\uC73C\uB85C ${foundBooks}\uAD8C \uBC1C\uACAC - \uC784\uC2DC\uB85C 1\uAD8C \uC124\uC815`);
        ownedCount = 1;
        availableCount = 1;
        books.push({
          type: "\uC77C\uBC18",
          title: "\uC804\uC790\uCC45",
          status: "\uB300\uCD9C\uAC00\uB2A5"
        });
      }
    }
    const totalCount = ownedCount + subscriptionCount;
    const unavailableCount = totalCount - availableCount;
    console.log(`\uD30C\uC2F1 \uC644\uB8CC - \uCD1D: ${totalCount}, \uC18C\uC7A5\uD615: ${ownedCount}, \uAD6C\uB3C5\uD615: ${subscriptionCount}, \uB300\uCD9C\uAC00\uB2A5: ${availableCount}`);
    return {
      library_name: "\uACBD\uAE30\uB3C4 \uC804\uC790\uB3C4\uC11C\uAD00",
      total_count: totalCount,
      available_count: availableCount,
      unavailable_count: unavailableCount,
      owned_count: ownedCount,
      subscription_count: subscriptionCount,
      books
    };
  } catch (error) {
    console.error(`\uACBD\uAE30\uB3C4 \uC804\uC790\uB3C4\uC11C\uAD00 \uD30C\uC2F1 \uC624\uB958: ${error.message}`);
    throw new Error(`\uACBD\uAE30\uB3C4 \uC804\uC790\uB3C4\uC11C\uAD00 \uD30C\uC2F1 \uC624\uB958: ${error.message}`);
  }
}
__name(parseGyeonggiEbookLibraryHTML, "parseGyeonggiEbookLibraryHTML");

// C:/Users/ahnbu/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/ahnbu/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-JnrNCF/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = workers_finalv6_default;

// C:/Users/ahnbu/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-JnrNCF/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=workers_finalv6.js.map

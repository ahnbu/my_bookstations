# 경기 광주시 시립도서관 구독형 크롤링 가이드

# [기술 아카이브] 광주시립(구독형) 크롤링 안정화 작업 히스토리

**문서 목적:** 이 문서는 광주시립도서관 구독형 전자책 크롤링 기능 구현 시 발생했던 일련의 문제들과 그 해결 과정을 기록하여, 향후 유사한 안티-스크래핑(Anti-Scraping) 문제 발생 시 체계적인 해결 가이드를 제공하는 것을 목적으로 한다.

## 1. 초기 구현: 단순 GET 요청 (실패)

-   **시도:** 도서관 검색 페이지 URL에 검색어를 쿼리 파라미터로 추가하여 `GET` 요청을 보내는 가장 기본적인 크롤링 방식.
-   **결과:** `HTTP 400 Bad Request` 오류 발생.
-   **분석:** 서버가 최소한의 인증 절차 없이 들어오는 요청을 차단하고 있음을 확인. 이는 가장 기초적인 봇 방어 메커니즘이다.

## 2. 1차 개선: 2단계 요청 (세션 쿠키 획득) 도입 (일시적 성공)

-   **가설:** 서버가 유효한 세션 쿠키를 요구할 것이다.
-   **개선 내용:** 실제 사용자의 행동을 모방한 2단계 요청 로직 구현.
    1.  **세션 획득:** 먼저 기본 검색 페이지에 접속하여 `Set-Cookie` 헤더를 통해 세션 쿠키를 발급받는다.
    2.  **검색 수행:** 획득한 쿠키를 `Cookie` 헤더에 담아 실제 검색을 요청한다.
-   **결과:** 배포 직후에는 정상적으로 작동했으나, **약 30분 후부터 간헐적으로 `HTTP 400` 오류가 다시 발생**하기 시작했다.
-   **분석:** 2단계 요청 자체는 올바른 방향이었으나, 서버의 더 정교한 봇 탐지 시스템을 통과하기에는 충분하지 않았다.

## 3. 2차 개선: 완전한 브라우저 헤더 모방 (안정성 향상)

-   **가설:** 서버가 세션 획득을 위한 **최초 접속 단계부터** 요청 헤더의 유효성을 검증할 것이다.
-   **개선 내용:**
    -   1단계(세션 획득) 요청부터 `User-Agent` 뿐만 아니라, `Sec-Fetch-Dest`, `Sec-Fetch-Mode`, `Sec-Fetch-Site` 등 실제 브라우저가 보내는 대부분의 헤더를 포함하여 요청을 보냈다.
    -   2단계(검색 수행) 요청 시에도 상속받은 헤더를 기반으로, `Referer`와 `Sec-Fetch-Site: 'same-origin'`을 명시하여 페이지 내의 자연스러운 이동처럼 위장했다.
-   **결과:** 이전보다 성공률이 크게 향상되었으나, **여전히 서버 트래픽이 몰리는 시간대나 연속적인 요청 시 실패하는 현상**이 관찰되었다.

## 4. 3차 개선 시도: KV를 이용한 세션 캐싱 (실패 및 원인 분석)

-   **가설:** 매번 새로운 세션을 요청하는 패턴이 서버에 의해 "비정상 트래픽"으로 감지될 것이다. 따라서 한 번 발급받은 세션을 재사용하면 문제를 해결할 수 있다.
-   **개선 내용:** Cloudflare KV를 도입하여 발급받은 세션 쿠키를 25분간 캐싱하고, 유효한 캐시가 있으면 재사용하는 로직을 구현했다.
-   **결과:** **오히려 실패 빈도가 급증**했다. `"유효한 세션을 획득할 수 없습니다."` 라는 새로운 유형의 에러가 지배적으로 발생했다.
-   **실패 원인 분석 (핵심 교훈):**
    -   **경쟁 상태 (Race Condition):** 여러 Worker 인스턴스가 거의 동시에 "캐시된 세션 없음"을 확인하고, 동시에 "새 세션 발급"을 요청했다.
    -   **서버의 역공:** 도서관 서버는 동일 IP로부터 짧은 시간 안에 여러 개의 새 세션 발급 요청이 들어오자, 이를 명백한 공격 패턴으로 간주하고 해당 IP를 일시적으로 차단했다.
    -   **결론:** 정교하게 설계한 캐싱 전략이 오히려 동시성 문제를 일으켜 서버의 더 강력한 방어 메커니즘을 자극하는 **역효과**를 낳았다.

## 5. 최종 해결책: "단순함"과 "견고함"의 결합 (현재 버전)

-   **결론 도출:** 가장 성공률이 높았던 것은 복잡한 상태 관리 없이, **각 요청이 독립적으로 수행되는 단순한 2단계 요청 패턴**이었다.
-   **최종 개선 내용:**
    1.  **KV 캐싱 로직 완전 폐기:** 동시성 문제를 유발하는 복잡한 상태 관리 로직을 모두 제거하고, "구식 코드"의 단순한 `매번 새 세션 요청` 패턴으로 회귀했다.
    2.  **헤더 위장술 극대화:** 2차 개선에서 도입했던 **"완전한 브라우저 헤더 모방" 전략을 그대로 유지**했다.
    3.  **일관된 에러 처리:** `try...catch` 블록으로 함수 전체를 감싸고, 각 단계에서 실패 시 명확한 에러를 던지도록 하여 문제 추적을 용이하게 만들었다.
-   **최종 동작 원리:** 각 크롤링 요청은 **완전히 독립적인 일회성 트랜잭션**으로 동작한다. 매번 실제 브라우저와 거의 동일한 헤더로 위장하여 새 세션을 발급받고, 그 즉시 검색을 수행한다. 이 방식은 상태 관리가 필요 없어 동시성 문제에서 자유로우며, 각 요청의 성공 확률을 개별적으로 극대화한다.

## 교훈 및 미래 대응 방안

1.  **단순함의 가치:** 정교한 시스템(세션 캐싱)이 항상 더 나은 해결책은 아니다. 대상 서버의 동작 방식을 파악하고, 때로는 가장 단순한 stateless 접근법이 더 안정적일 수 있다.
2.  **위장은 기본:** 현대의 안티-스크래핑 시스템을 상대할 때, 요청 헤더를 실제 브라우저와 최대한 유사하게 구성하는 것은 선택이 아닌 필수다.
3.  **실패는 상수다:** 외부 서버의 정책은 언제든 변경될 수 있다. 크롤링 실패는 버그가 아닌 시스템의 정상적인 상태 중 하나로 간주하고, 실패 시 **"조용한 실패(Graceful Degradation)"**와 **"데이터 폴백(Fallback)"** 로직을 견고하게 설계하는 것이 중요하다.
4.  **지속적인 모니터링:** 간헐적 실패 패턴을 감지하기 위해 로깅과 모니터링은 필수적이다. 실패 빈도가 다시 증가한다면, 서버 정책이 또 변경되었을 가능성이 높으므로 브라우저 요청 분석부터 다시 시작해야 한다.

---
**문서 최종 수정일**: 2025-10-28


# 경기도 전자도서관 구독형 크롤링 가이드

경기도 전자도서관 구독형 전자책 크롤링 시스템의 핵심 구현 가이드입니다.

## 📋 개요

경기도 전자도서관의 구독형 전자책 서비스는 일반적인 HTTP 요청과 달리, **동적 인증 토큰**을 통한 정교한 인증 시스템을 사용합니다. 이 문서는 안정적인 크롤링을 위한 핵심 구현사항을 상세히 설명합니다.

## 🔑 핵심 기술적 도전사항

### 1. 동적 인증 토큰 (Dynamic Token)
- **고정값이 아님**: 매 요청 시마다 현재 시간 기반으로 생성
- **시간 민감성**: KST(한국 표준시) 기준으로 정확한 시간 필요
- **Base64 인코딩**: 환경별로 다른 함수 사용 필요

### 2. 환경별 호환성
- **Cloudflare Workers**: `btoa()` 내장 함수 사용
- **Node.js 로컬**: `Buffer.from().toString('base64')` 사용
- **시간대 처리**: UTC+9 수동 변환 필요

### 3. 필수 헤더 요구사항
- **token**: 동적 생성된 인증 토큰
- **Referer**: 출처 검증용 헤더
- **User-Agent**: 봇 탐지 방지

## 🛠️ 핵심 구현 코드

### 동적 토큰 생성 함수

```javascript
/**
 * KST 기준 동적 인증 토큰 생성
 * @returns {string} Base64 인코딩된 토큰
 */
function generateDynamicToken() {
  // KST (UTC+9) 기준 현재 시간 생성
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  
  // YYYYMMDDHHMM 형식으로 타임스탬프 생성
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  
  const timestamp = `${yyyy}${mm}${dd}${hh}${min}`;
  const tokenString = `${timestamp},0000000685`; // 고정 ID 추가
  
  // 환경별 Base64 인코딩
  return typeof btoa !== 'undefined' 
    ? btoa(tokenString)  // Cloudflare Workers
    : Buffer.from(tokenString).toString('base64'); // Node.js
}
```

### 구독형 도서 검색 함수

```javascript
/**
 * 구독형 전자책 검색
 * @param {string} query - 검색어
 * @returns {Promise<Object>} 검색 결과
 */
async function searchSubscriptionBooks(query) {
  const url = 'https://api.bookers.life/v2/Api/books/search';
  
  // 동적 토큰 생성
  const dynamicToken = generateDynamicToken();
  
  // 요청 헤더 구성
  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'token': dynamicToken,
    'Referer': 'https://ebook.library.kr/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };
  
  // 요청 바디 구성
  const body = {
    search: query,
    searchOption: 1,
    pageSize: 20,
    pageNum: 1,
    detailYn: "y"
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      console.error('구독형 크롤링 실패:', response.status);
      return { books: [] };
    }
    
    const data = await response.json();
    return {
      books: data.bookSearchResponses || []
    };
    
  } catch (error) {
    console.error('구독형 크롤링 오류:', error);
    return { books: [] };
  }
}
```

## 🔍 트러블슈팅 가이드

### 일반적인 오류와 해결방법

#### 1. "btoa is not defined" 오류
**원인**: Node.js 로컬 환경에서 `btoa()` 함수를 사용한 경우  
**해결**: Buffer 객체 사용으로 변경
```javascript
// 잘못된 방법
const token = btoa(tokenString);

// 올바른 방법
const token = Buffer.from(tokenString).toString('base64');
```

#### 2. 401 Unauthorized 오류
**원인**: 잘못된 토큰 또는 시간대 문제  
**해결**: KST 변환 확인 및 토큰 생성 로직 점검
```javascript
// 시간대 확인
const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
console.log('KST 시간:', now.toISOString());
```

#### 3. 403 Forbidden 오류
**원인**: 필수 헤더 누락 (특히 Referer)  
**해결**: 모든 필수 헤더 포함 확인
```javascript
const requiredHeaders = {
  'token': dynamicToken,     // 필수
  'Referer': 'https://ebook.library.kr/', // 필수
  'User-Agent': '...',       // 필수
};
```

### 디버깅 팁

1. **토큰 생성 확인**
```javascript
const tokenString = `${timestamp},0000000685`;
console.log('토큰 문자열:', tokenString);
console.log('Base64 토큰:', dynamicToken);
```

2. **시간 검증**
```javascript
const kstTime = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
console.log('KST 시간:', kstTime.toLocaleString('ko-KR'));
```

3. **응답 상태 로깅**
```javascript
console.log('응답 상태:', response.status, response.statusText);
if (!response.ok) {
  const errorText = await response.text();
  console.log('오류 메시지:', errorText);
}
```

## ⚠️ 주의사항

### 1. 시간 민감성
- 토큰은 분 단위로 변경되므로 실시간 생성 필수
- 시스템 시간이 정확해야 함 (NTP 동기화 권장)

### 2. 요청 빈도 제한
- 과도한 요청은 IP 차단 위험
- 적절한 요청 간격 유지 (1-2초 권장)

### 3. 에러 처리
- 네트워크 오류, 인증 실패, 파싱 오류 등 다양한 예외 상황 대비
- 실패 시 재시도 로직 구현 (지수 백오프 권장)

## 🔧 환경별 구현 예시

### Cloudflare Workers 환경
```javascript
// btoa() 함수 사용 가능
const dynamicToken = btoa(`${timestamp},0000000685`);
```

### Node.js 로컬 환경
```javascript
// Buffer 객체 사용 필요
const dynamicToken = Buffer.from(`${timestamp},0000000685`).toString('base64');
```

### 브라우저 환경 (테스트용)
```javascript
// btoa() 함수 사용 가능하지만 CORS 이슈 존재
const dynamicToken = btoa(`${timestamp},0000000685`);
// 프록시 서버를 통한 우회 필요
```

## 📊 성능 최적화

### 1. 토큰 캐싱
```javascript
let cachedToken = null;
let tokenExpiry = 0;

function getCachedToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }
  
  cachedToken = generateDynamicToken();
  tokenExpiry = now + 60000; // 1분 후 만료
  return cachedToken;
}
```

### 2. 병렬 처리
```javascript
// 여러 검색어 동시 처리
const searches = ['book1', 'book2', 'book3'];
const results = await Promise.allSettled(
  searches.map(query => searchSubscriptionBooks(query))
);
```

## 🔗 관련 문서

- [메인 README.md](../README.md) - 프로젝트 개요
- [개발 가이드](./DEVELOPMENT.md) - 전체 시스템 아키텍처
- [변경 내역](./changelog.md) - 버전별 업데이트 기록

---

**문서 최종 수정일**: 2025-01-10  
**작성자**: 개발팀
# 구독형 전자책 크롤링 시스템 가이드

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
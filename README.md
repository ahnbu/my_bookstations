# 📚 마이북스테이션 (My BookStation)

**도서 검색 및 도서관 재고 확인 서비스**

알라딘 API와 연동하여 도서를 검색하고, 여러 도서관의 재고 현황을 실시간으로 확인할 수 있는 웹 애플리케이션입니다. 개인 서재 관리 기능을 통해 관심 도서를 체계적으로 관리할 수 있습니다.

![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-000000?style=flat-square&logo=zustand&logoColor=white)

## 🎯 서비스 목표

- **원스톱 도서 서비스**: 검색부터 재고 확인, 개인 관리까지 한 곳에서
- **실시간 재고 확인**: 여러 도서관의 재고 상태를 동시에 확인
- **개인화된 서재 관리**: 독서 상태, 별점, 메모 등 체계적인 도서 관리
- **편리한 접근성**: 직관적인 UI/UX로 누구나 쉽게 사용

## ✨ 주요 기능

### 📖 도서 검색
- **알라딘 API 연동**: 제목, 저자, 출판사별 검색 지원
- **검색 결과 필터링**: '[세트]'로 시작하는 도서를 자동으로 제외하여 검색 결과의 정확성 향상
- **상세 정보 제공**: 도서 정보, 가격, ISBN, 전자책 유무, 알라딘 구매 링크 등 상세 정보 표시
- **전자책 보기 버튼**: 알라딘 API에서 전자책 정보가 있을 경우, 책 상세 페이지에 '전자책 보기' 버튼 표시

### 📍 통합 도서 재고 확인
- **실시간 통합 조회**: 종이책(광주 시립도서관), 전자책(경기도 교육청 통합 도서관), 전자책(광주 시립도서관 구독형), 전자책(경기도 전자도서관 API) 재고를 한 번의 요청으로 동시에 확인
- **최적화된 API 호출**: 통합된 서비스 로직을 통해 불필요한 네트워크 요청을 최소화
- **도서관 바로가기**: 재고 확인 셀 클릭 시, 해당 도서관의 도서 검색 결과 페이지로 바로 이동
- **재고 새로고침**: 클릭 한 번으로 최신 재고 상태 업데이트
- **재고 0 표시 통일**: 종이책 및 전자책 재고가 0인 경우 '-' 아이콘과 함께 '0(0)'으로 통일된 표시 방식 적용
- **🆕 ISBN 기반 정확도 개선**: 경기도 전자도서관 검색 결과를 ISBN으로 필터링하여 정확한 재고 정보만 표시
- **🆕 정보 없음 케이스 처리**: 도서관에서 "정보 없음" 상태로 반환되는 무효한 데이터를 자동으로 제외하여 정확한 재고 표시

#### 연동 도서관 목록

##### 종이책 (광주 시립도서관)
- **중앙 도서관**: 광주시 중심가 위치
- **송정 도서관**: 광주시 송정동 소재  
- **오포 도서관**: 광주시 오포읍 소재
- **퇴촌 도서관**: 광주시 퇴촌면 소재
- **기타 도서관**: 광주시 내 기타 모든 시립도서관

##### 전자책 (경기도 교육청 통합 도서관)
- **성남 도서관**: 경기도교육청 성남교육도서관
- **통합 도서관**: 경기도교육청 통합전자도서관

##### 전자책 (광주 시립도서관 구독형)
- **교보문고 구독형**: 광주 시립도서관에서 제공하는 교보문고 전자책 구독 서비스

##### 전자책 (경기도 전자도서관) - API 방식 (신규)
- **API 엔드포인트**: `https://ebook.library.kr/api/service/search-engine`
- **요청 방식**: `GET`
- **주요 파라미터**:
    - `contentType=EB`: 전자책 콘텐츠 유형
    - `searchType=all`: 전체 검색
    - `detailQuery=TITLE:{검색어}:true`: 제목 검색 쿼리
    - `sort=relevance`: 관련도순 정렬
    - `page=1&size=20`: 페이징 설정

### 👤 개인 서재 관리
- **내 서재**: 관심 도서를 개인 서재에 저장 및 관리
- **독서 기록**: 읽음 상태(읽지 않음/읽는 중/완독) 및 별점(1-5점) 기록
- **다양한 정렬 기능**: 추가순, 제목순, 저자순, 출간일순, 별점순, 읽음순 정렬 지원
- **데이터 내보내기**: 서재 데이터를 CSV 파일로 내보내기 (날짜 자동 포함)
- **기존 서재 데이터 업데이트**: 누락된 전자책 ISBN13 정보를 자동으로 업데이트

### 🔐 사용자 인증
- **Google 소셜 로그인**: 간편한 Google 계정 연동
- **이메일 회원가입/로그인**: 이메일과 비밀번호를 통한 전통적인 인증 방식

## 🏗️ 기술 스택

### Frontend
- **React 19** - 최신 React 기능 활용
- **TypeScript** - 강력한 타입 시스템으로 안정성 확보
- **Vite** - 빠른 개발 서버 및 빌드 도구
- **Tailwind CSS** - 유틸리티 우선 CSS 프레임워크
- **Lucide React** - 일관된 아이콘 시스템으로 전체 UI 통일

### State Management
- **Zustand** - 경량화된 상태 관리 라이브러리
- **분리된 스토어 구조**: 인증(Auth), 도서(Book), UI 상태별 관리

### Backend & Database
- **Supabase** - 백엔드 서비스 및 PostgreSQL 데이터베이스
- **Cloudflare Workers** - 도서관 재고 크롤링을 위한 서버리스 백엔드
- **실시간 동기화** - 서재 데이터의 실시간 저장 및 동기화

### Data Validation
- **Zod** - 런타임 타입 검증으로 외부 API 응답 안정성 확보

## 🚀 빠른 시작

### 필수 조건
- Node.js 18 이상
- Git

### 설치 및 실행

1. **저장소 클론**
   ```bash
   git clone <repository-url>
   cd my_bookstation
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **환경 변수 설정**
   ```bash
   # .env.local 파일 생성 및 설정
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **개발 서버 실행**
   ```bash
   npm run dev
   ```

5. **브라우저에서 확인**
   ```
   http://localhost:5173
   ```

## 📖 사용법

### 기본 사용 흐름
1. **로그인**: 메인 화면 우측 상단의 '로그인' 또는 '회원가입' 버튼을 통해 계정을 관리합니다.
2. **도서 검색**: 메인 화면의 검색창에서 검색 유형('전체', '제목' 등)을 선택하고, 찾고 싶은 키워드를 입력한 후 검색 아이콘을 클릭합니다.
3. **도서 선택**: 검색 결과가 팝업 창에 나타나면, 원하는 **도서를 클릭**하여 선택합니다.
4. **재고 확인**: 선택한 도서의 상세 정보와 **여러 도서관의 재고 현황**이 화면 중앙에 표시됩니다.
5. **서재 관리**: **'내 서재에 추가'** 버튼을 눌러 관심 도서를 하단의 '내 서재' 목록에 저장합니다.

### 내 서재 기능
- **도서 추가/삭제**: 관심 도서를 쉽게 추가하고 삭제
- **읽음 상태 관리**: '읽지 않음', '읽는 중', '완독' 상태로 독서 진행도 관리
- **별점 평가**: 1점~5점 별점으로 개인적인 평가 기록
- **정렬 옵션**: 추가순, 제목순, 저자순, 출간일순, 별점순, 읽음순으로 정렬
- **CSV 내보내기**: 서재 데이터를 CSV 파일로 내보내기 (파일명에 날짜 자동 포함)

### 도서관 재고 확인
- **실시간 조회**: 여러 도서관의 재고를 동시에 확인
- **바로가기 링크**: 각 도서관 셀 클릭 시 해당 도서관 검색 페이지로 이동
- **재고 새로고침**: 최신 재고 상태로 업데이트

## 🚀 최신 기술적 개선사항

### ISBN 기반 필터링 시스템 (2025-01-09)
경기도 전자도서관 검색 결과의 정확도를 대폭 향상시켰습니다.

**📊 개선 효과**:
- "내 손으로, 시베리아 횡단열차": 4(3) → 1(0) - 75% 정확도 향상
- 제목 유사 도서 제외로 정확한 재고 정보만 표시
- 종이책 ISBN과 전자책 ISBN 모두 매칭 지원

**🔧 기술적 구현**:
```typescript
// ISBN 정규화 및 매칭
const normalizedIsbn1 = isbn1.replace(/[-\s]/g, '');
const normalizedIsbn2 = isbn2.replace(/[-\s]/g, '');
return normalizedIsbn1 === normalizedIsbn2;

// 필터링된 결과로 정확한 카운트 제공
const matchedBooks = gyeonggiResult.books?.filter(ebookResult => 
  isBookMatched(book, ebookResult)
);
```

### 종이책 재고 정확성 개선 (2025-01-10)
도서관 API의 "정보 없음" 응답을 올바르게 처리하여 재고 표시 정확도를 개선했습니다.

**🛠️ 문제 해결**:
- 기존: "네이비씰 균형의 기술" 기타lib 1(0) (잘못된 표시)
- 개선: "네이비씰 균형의 기술" 기타lib 0(0) (정확한 표시)

**💡 핵심 로직**:
```typescript
availability.forEach(item => {
  const libraryName = item['소장도서관'];
  // "정보 없음" 케이스 필터링
  if (libraryName === '정보 없음' || libraryName === '알 수 없음' || !libraryName) {
    return; // 이 항목은 카운트하지 않음
  }
  // ... 정상 카운트 로직
});
```

### API 테스트 도구 향상 (2025-01-10)
개발자 도구의 사용성을 대폭 개선했습니다.

**⚡ 주요 기능**:
- **통합 검색**: 기존 SearchForm 재활용으로 알라딘 API 통합
- **원클릭 테스트**: 검색 결과 클릭으로 자동 API 테스트 실행
- **통합 결과 표시**: 전체 API 응답을 하나의 박스에서 확인
- **복사 기능**: JSON 결과를 클립보드로 원클릭 복사
- **개선된 UX**: alert() 팝업을 인라인 메시지로 대체

### 구독형 크롤링 시스템 (2025-01-09)
경기도 전자도서관의 구독형 전자책 크롤링 로직을 완전히 안정화했습니다.

**📊 개선 효과**:
- 동적 인증 토큰 생성으로 API 접근 안정성 향상
- KST 기준 시간 처리로 인증 실패 문제 해결
- 로컬 환경과 Cloudflare Workers 환경 호환성 확보

**🔧 핵심 기술적 구현**:

1. **동적 인증 토큰 생성 시스템**
```javascript
// KST (UTC+9) 기준 현재 시간으로 동적 토큰 생성
const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
const timestamp = `${yyyy}${mm}${dd}${hh}${min}`;
const tokenString = `${timestamp},0000000685`;

// 환경별 Base64 인코딩 처리
const dynamicToken = typeof btoa !== 'undefined' 
  ? btoa(tokenString)  // Cloudflare Workers
  : Buffer.from(tokenString).toString('base64'); // Node.js 로컬
```

2. **필수 헤더 구성**
```javascript
const headers = {
  'Content-Type': 'application/json;charset=UTF-8',
  'token': dynamicToken, // 동적 생성된 인증 토큰
  'Referer': 'https://ebook.library.kr/', // 출처 검증
  'User-Agent': 'Mozilla/5.0 ...' // 브라우저 위장
};
```

**💡 핵심 해결사항**:
- **시간대 문제**: 로컬 환경에서 KST 변환 필요
- **인코딩 함수**: `btoa()` vs `Buffer.from().toString('base64')`
- **필수 헤더**: `token`, `Referer`, `User-Agent` 포함 필수

## 🔗 관련 문서

- **[개발 가이드](docs/DEVELOPMENT.md)** - 개발환경 설정, 아키텍처, 기술 상세 정보
- **[변경 내역](docs/changelog.md)** - 버전별 업데이트 기록
- **[에러 로그](docs/error_log.md)** - 문제점 및 해결 방법
- **[작업 목록](docs/task_list.md)** - 진행 상황 및 계획

## 🤝 기여하기

프로젝트에 기여하고 싶으시다면:

1. 이슈를 통해 버그 리포트나 기능 제안
2. Pull Request를 통한 코드 기여
3. 문서 개선 및 번역

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

**마지막 업데이트**: 2025-01-10  
**버전**: v1.6.5

---

**핵심 개선사항 요약**:
- 📊 **ISBN 필터링으로 재고 정확도 75% 향상**
- 🔧 **종이책 "정보 없음" 오류 완전 해결**
- 🚀 **구독형 크롤링 시스템 안정화**
- ⚡ **API 테스트 도구 통합 및 복사 기능**
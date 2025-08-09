# 📚 마이북스테이션 (My BookStation)

**도서 검색 및 도서관 재고 확인 서비스**

알라딘 API와 연동하여 도서를 검색하고, 전국 도서관의 재고 현황을 실시간으로 확인할 수 있는 웹 애플리케이션입니다.

![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-000000?style=flat-square&logo=zustand&logoColor=white)

## ✨ 주요 기능

### 📖 도서 검색
- **알라딘 API 연동**: 제목, 저자, 출판사별 검색 지원
- **검색 결과 필터링**: '[세트]'로 시작하는 도서를 자동으로 제외하여 검색 결과의 정확성 향상
- **상세 정보 제공**: 도서 정보, 가격, ISBN, 전자책 유무, 알라딘 구매 링크 등 상세 정보 표시
- **전자책 보기 버튼**: 알라딘 API에서 전자책 정보가 있을 경우, 책 상세 페이지에 '전자책 보기' 버튼 표시

### 📍 통합 도서 재고 확인
- **실시간 통합 조회**: 종이책(광주 시립도서관), 전자책(경기도 교육도서관), 전자책(광주 시립도서관 구독형), 전자책(경기도 교육청 통합 도서관) 재고를 한 번의 요청으로 동시에 확인
- **최적화된 API 호출**: 통합된 서비스 로직을 통해 불필요한 네트워크 요청을 최소화
- **도서관 바로가기**: 재고 확인 셀 클릭 시, 해당 도서관의 도서 검색 결과 페이지로 바로 이동 (종이책, 전자책(교육), 전자책(시립구독), 전자책(경기소장) 모두 지원)
- **재고 새로고침**: 클릭 한 번으로 최신 재고 상태 업데이트
- **재고 0 표시 통일**: 종이책 및 전자책 재고가 0인 경우 '-' 아이콘과 함께 '0(0)'으로 통일된 표시 방식 적용.

### 👤 개인 서재 관리
- **내 서재**: 관심 도서를 개인 서재에 저장 및 관리
- **독서 기록**: 읽음 상태(읽지 않음/읽는 중/완독) 및 별점(1-5점) 기록
- **다양한 정렬 기능**: 추가순, 제목순, 저자순, 출간일순, 별점순, 읽음순 정렬 지원
- **데이터 내보내기**: 서재 데이터를 CSV 파일로 내보내기
- **기존 서재 데이터 업데이트**: 누락된 전자책 ISBN13 정보를 자동으로 업데이트.


### 🔐 사용자 인증
- **Google 소셜 로그인**: 간편한 Google 계정 연동
- **이메일 회원가입/로그인**: 이메일과 비밀번호를 통한 전통적인 인증 방식

## 🏗️ 기술 스택

### Frontend
- **React 19** - 최신 React 기능 활용
- **TypeScript** - 강력한 타입 시스템으로 안정성 확보
- **Vite** - 빠른 개발 서버 및 빌드 도구
- **Tailwind CSS** - 유틸리티 우선 CSS 프레임워크

### State Management
- **Zustand** - 경량화된 상태 관리 라이브러리
- **분리된 스토어 구조**: 인증(Auth), 도서(Book), UI 상태별 관리

### Backend & Database
- **Supabase** - 백엔드 서비스 및 PostgreSQL 데이터베이스
- **Cloudflare Workers** - 도서관 재고 크롤링을 위한 서버리스 백엔드
- **실시간 동기화** - 서재 데이터의 실시간 저장 및 동기화

### Data Validation
- **Zod** - 런타임 타입 검증으로 외부 API 응답 안정성 확보

## 🚀 실행 방법

### 로컬 환경 설정

**필수 조건:** Node.js 18+ 

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

### 프로덕션 빌드

```bash
npm run build
npm run preview
```

## 📁 프로젝트 구조

```
my_bookstation/
├── src/
│   ├── components/          # React 컴포넌트
│   ├── stores/             # Zustand 상태 관리
│   ├── services/           # API 서비스 계층
│   └── ...
├── docs/                   # 프로젝트 문서
│   ├── changelog.md        # 변경 내역
│   └── ...
├── crwaling_test/          # CloudFlare Workers 크롤링 스크립트
│   ├── workers_finalv1.js  # 도서관 재고 크롤링 워커 (v1)
│   ├── workers_finalv2.js  # 도서관 재고 크롤링 워커 (v2)
│   └── workers_finalv3.js  # 도서관 재고 크롤링 워커 (v3, 현재)
├── gemini.md               # Gemini 에이전트 협업 규칙
└── ...
```

## 🔍 도서관 재고 확인 시스템

### 📊 재고 확인 로직 개요

마이북스테이션은 **3-Way 통합 도서관 재고 확인 API**를 통해 종이책과 전자책 재고를 실시간으로 조회합니다.

### 🏛️ 지원 도서관

#### 종이책 (광주 시립도서관)
- **퇴촌 도서관**: 광주시 퇴촌면 소재
- **기타 도서관**: 광주시 내 기타 모든 시립도서관

#### 전자책 (경기도 교육청 통합 도서관)
- **성남 도서관**: 경기도교육청 성남교육도서관
- **통합 도서관**: 경기도교육청 통합전자도서관

#### 전자책 (광주 시립도서관 구독형)
- **교보문고 구독형**: 광주 시립도서관에서 제공하는 교보문고 전자책 구독 서비스

#### 전자책 (경기도 교육청 통합 도서관)
- **경기도 교육청 통합 도서관**: 경기도 교육청에서 제공하는 전자책 서비스

### 🔄 재고 확인 프로세스

#### 1. API 요청 파라미터
```javascript
{
  isbn: "종이책 검색용 ISBN13",
  title: "전자책 검색용 도서 제목 (처리된 버전, 전자책(교육) 및 전자책(시립구독) 모두 포함)"
}
```

#### 2. 제목 처리 로직 (`processBookTitle`)
전자책 검색의 정확성을 높이기 위한 제목 전처리:
- **한글 외 문자 제거**: 영어, 숫자, 특수문자를 공백으로 변경
- **최대 3단어 제한**: 공백으로 분리한 후 첫 3개 단어만 사용
- **예시**: 
  - 입력: `"해리포터와 마법사의 돌 Harry Potter"`
  - 출력: `"해리포터와 마법사의 돌"`

#### 2.1. 전자책 (광주 시립도서관 구독형) 제목 처리 로직
광주 시립도서관 구독형 전자책 검색을 위한 제목 전처리:
- **"-" 문자 처리**: 제목에 "-"가 있으면, "-"를 포함하여 그 뒤에 있는 내용은 추출할 텍스트에서 사용하지 않습니다.
- **최대 3단어 제한**: 위 처리 후, 공백으로 분리한 첫 3개 단어만 사용합니다.
- **예시**:
  - 입력: `"도서 제목 - 부제"`
  - 출력: `"도서 제목"`
  - 입력: `"긴 도서 제목 - 부제 (추가 정보)"`
  - 출력: `"긴 도서 제목"`

#### 3. 병렬 API 호출
```javascript
Promise.allSettled([
  searchGwangjuLibrary(isbn),        // 광주 시립도서관 (종이책)
  searchSingleGyeonggiEbook(title, '10000004'), // 성남 도서관 (전자책)
  searchSingleGyeonggiEbook(title, '10000009')  // 통합 도서관 (전자책)
])
```

### 📝 HTML 파싱 및 상태 판단

#### 종이책 상태 판단 (광주 시립도서관)
```javascript
// HTML에서 대출 상태 추출
const statusText = bookStateBar.textContent;
if (statusText.includes('대출가능')) {
  status = '대출가능';
} else if (statusText.includes('대출불가') || statusText.includes('대출중')) {
  status = '대출불가';
  dueDate = extractDueDate(statusContent);
}
```

#### 전자책 상태 판단 (경기도 교육청)
```javascript
// "대출 가능 여부" 필드를 다중 정규식 패턴으로 추출
const statusPatterns = [
  /대출\s*가능\s*여부\s*:\s*(.*?)(?:<br|<span|\s*│|$)/i,
  /대출\s*가능\s*여부\s*:\s*(.*?)(?:\n|<|$)/i,
  /대출\s*가능\s*여부\s*:\s*([^<\n]+)/i,
  /대출.*?가능.*?여부.*?:\s*(.*?)(?:<br|<span|\s*│|$)/i
];

// 전자책 동시 대출 특성을 고려한 판단
if (statusText.includes("대출 가능") || statusText.includes("대출가능")) {
  status = "대출가능";  // 전자책은 동시 대출이 가능하므로
} else if (statusText.includes("대출중") || statusText.includes("대출 불가")) {
  status = "대출불가";
}
```

### 📊 응답 데이터 구조
```javascript
{
  gwangju_paper: {
    book_title: "도서 제목",
    availability: [
      {
        소장도서관: "퇴촌도서관",
        청구기호: "813.7-김12ㅎ",
        대출상태: "대출가능",
        반납예정일: "-"
      }
    ]
  },
  gyeonggi_ebooks: [
    {
      소장도서관: "성남도서관",
      도서명: "도서 제목",
      저자: "저자명",
      출판사: "출판사명",
      발행일: "2023-10-24",
      대출상태: "대출가능"
    }
  ]
}
```

### 🎯 프론트엔드 표시 로직

#### 재고 요약 (`summarizeEBooks`)
```javascript
const summary = {
  총개수: 0,      // 전체 전자책 수량
  대출가능: 0,    // 대출 가능한 전자책 수량
  대출불가: 0,    // 대출 불가능한 전자책 수량
  성남도서관: 0,  // 성남도서관 보유 수량
  통합도서관: 0,  // 통합도서관 보유 수량
  오류개수: 0     // 조회 실패 수량
};
```

#### UI 표시 형식
- **종이책 재고**: `✔️ 3(2)` (총 3권 중 2권 대출가능)
- **전자책 재고**: `✔️ 1(1)` (총 1권 중 1권 대출가능)
- **재고 없음**: `- 0(0)`
- **e북(시립구독) 재고**: `1/1` (더미 데이터)
- **e북(경기소장) 재고**: `1/1` (더미 데이터)

### 🔧 최적화 및 성능

#### CloudFlare Workers 배포
- **서버리스 아키텍처**: 요청 기반 스케일링
- **글로벌 엣지 네트워크**: 전 세계 빠른 응답 시간
- **타임아웃 관리**: 20초 HTTP 타임아웃 설정
- **에러 핸들링**: Promise.allSettled로 일부 실패 시에도 서비스 제공

#### 캐싱 및 최적화
- **프론트엔드 캐싱**: 동일한 ISBN/제목에 대한 중복 요청 방지  
- **배치 처리**: 여러 도서관 동시 조회로 응답 시간 단축
- **점진적 로딩**: 재고 정보를 단계적으로 로딩하여 UX 개선

### 🛠️ 디버깅 및 모니터링
- **상세 로깅**: CloudFlare Workers 콘솔을 통한 실시간 디버깅
- **에러 추적**: HTML 파싱 실패 시 상세 오류 정보 제공
- **상태 모니터링**: API 응답 시간 및 성공률 추적

## 🔧 최근 주요 업데이트 (v1.6.0)

### 기능 개선 및 UI/UX 최적화
- ✅ **CSV 내보내기 개선**: 한글 깨짐 현상 수정 및 '전자책재고' 열 추가, 파일명에 내보내기 날짜 자동 포함.
- ✅ **API 테스트 UI 간소화**: 불필요한 테스트 유형 선택 및 안내 문구 제거, 통합 테스트만 제공.
- ✅ **'내 서재' 재고 표시 통일**: 종이책 및 전자책 재고가 0인 경우 '-' 아이콘과 함께 '0(0)'으로 통일된 표시 방식 적용.
- ✅ **'e북(시립구독)' 열 추가**: '내 서재'에 'e북(시립구독)' 열을 추가하고, 특정 제목 추출 기준에 따라 교보문고 전자도서관 링크 연결.
- ✅ **'e북.경기' 열 및 '전자책(경기소장)' 정보 추가**: '내 서재' 테이블에 'e북.경기' 열을 추가하고, 책 상세 페이지에 '전자책(경기소장)' 항목을 추가했습니다. 재고/대출 가능은 더미로 '1/1'을 표시하며, 클릭 시 경기도교육청 전자도서관 검색 페이지로 이동하도록 연결했습니다. 제목 처리 방식은 'e북.시독'과 동일하게 적용했습니다.
- ✅ **책 상세 페이지에 전자책 ISBN 표시**: 알라딘 API에서 제공하는 전자책의 `isbn13` 또는 `isbn` 필드를 사용하여 전자책 ISBN을 표시하도록 했습니다. (이후 숫자만 추출하는 로직은 취소됨)
- ✅ **기존 서재 책 전자책 ISBN13 정보 업데이트**: 기존 서재에 추가된 책들의 누락된 전자책 `isbn13` 정보를 자동으로 업데이트하는 로직을 추가했습니다.

자세한 변경 내역은 [changelog.md](docs/changelog.md)를 참조하세요.

## 📚 문서

- **[변경 내역](docs/changelog.md)** - 버전별 상세 변경사항
- **[개발 가이드](docs/DEVELOPMENT.md)** - 프로젝트 아키텍처 및 기술 스택
- **[Gemini 작업 규칙](gemini.md)** - AI 에이전트 협업 가이드

## 🤝 기여하기

1. 이 저장소를 Fork 하세요
2. 새로운 기능 브랜치를 생성하세요 (`git checkout -b feature/amazing-feature`)
3. 변경 사항을 커밋하세요 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 Push 하세요 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성하세요

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 문의

프로젝트에 대한 문의나 제안은 Issues를 통해 남겨주세요.

---

*마지막 업데이트: 2025-08-09*
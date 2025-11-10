네, 알겠습니다. 마지막 **3단계: `DEVELOPMENT.md` 업데이트** 작업을 시작하겠습니다.

이 문서는 프로젝트의 내부 설계도와 같으므로, 실제 코드와의 정합성을 맞추는 것이 매우 중요합니다. 최신 커밋 히스토리와 현재 코드 구조를 바탕으로 `DEVELOPMENT.md`의 각 섹션을 정밀하게 수정했습니다. 특히 API 명세, 데이터 흐름, 트러블슈팅 가이드 부분을 대대적으로 개선했습니다.

---

### `DEVELOPMENT.md` 수정 제안

기존 `DEVELOPMENT.md` 파일의 내용 전체를 아래 내용으로 교체하시면 됩니다.

```markdown
# 개발 가이드 (Development Guide)

마이북스테이션 프로젝트의 개발자를 위한 기술 문서입니다.

## 🏗️ 시스템 아키텍처

### 전체 아키텍처 개요
```mermaid
graph TD
    subgraph "User Interface (React + Vite)"
        A[React Components] --> B[Zustand Stores]
        B --> C[Service Layer]
    end

    subgraph "Backend Services"
        F[Supabase]
        G[Cloudflare Workers]
        H[Vercel Serverless]
        I[Supabase Edge Functions]
    end

    subgraph "External APIs"
        D[Aladin API]
        E[Library Crawling Targets]
    end

    C -- "DB/Auth/Realtime" --> F
    C -- "Stock Check API" --> G
    C -- "Aladin Proxy" --> H
    C -- "Feedback" --> I

    H -- "REST API" --> D
    G -- "HTML Crawling/API" --> E
```

### 프론트엔드 아키텍처
- **컴포넌트**: UI를 구성하는 재사용 가능한 블록 (`/components`)
- **상태 관리 (Zustand)**: 전역 상태를 관리하는 훅 기반 스토어 (`/stores`)
  - `useAuthStore`: 사용자 인증 및 세션 관리
  - `useUIStore`: 모달, 알림 등 UI 상태 관리
  - `useBookStore`: 도서 데이터, 내 서재, API 연동 등 핵심 비즈니스 로직
  - `useSettingsStore`: 사용자 맞춤 설정 관리
- **서비스 계층**: 외부 API와의 통신을 담당하는 모듈 (`/services`)
  - `aladin.service.ts`: Vercel 프록시를 통해 알라딘 API 호출
  - `unifiedLibrary.service.ts`: Cloudflare Worker로 통합된 도서관 재고 API 호출, 도서관 링크 생성 담당
  - `feedback.service.ts`: Supabase Edge Function으로 피드백 전송
- **유틸리티**: 특정 도메인에 종속되지 않는 순수 함수 모음 (`/utils`)
  - `bookDataCombiner.ts`: API 응답을 내부 데이터 구조로 조합
  - `isbnMatcher.ts`: ISBN 기반으로 도서를 매칭하는 로직

## 📁 프로젝트 구조
```
my_bookstation/
├── api/                     # Vercel Serverless Functions (Aladin 프록시)
│   └── search.ts
├── components/              # React 컴포넌트
│   ├── layout/              # Header, Footer 등 레이아웃
│   ├── DevToolsFloat.tsx    # 관리자 전용 기능 모달 (구 AdminPanel.tsx)
│   ├── MyLibrary.tsx        # 개인 서재 (핵심 기능)
│   ├── MyLibraryBookDetailModal.tsx # 내 서재 상세 정보 모달
│   └── ... (기타 UI 컴포넌트)
├── library-checker/         # Cloudflare Workers (재고 확인 API)
│   └── src/index.js
├── services/                # API 서비스 계층
│   ├── aladin.service.ts
│   └── unifiedLibrary.service.ts
├── stores/                  # Zustand 상태 관리 스토어
│   ├── useAuthStore.ts
│   ├── useBookStore.ts
│   ├── useSettingsStore.ts
│   └── useUIStore.ts
├── supabase/                # Supabase 설정 및 Functions
│   └── functions/
│       └── send-feedback-email/ # 피드백 처리 Edge Function
├── utils/                   # 공통 유틸리티 함수
│   ├── adminCheck.ts        # 관리자 이메일 확인
│   ├── bookDataCombiner.ts  # 데이터 조합 로직
│   ├── isbnMatcher.ts       # ISBN 기반 도서 매칭
│   └── ...
├── App.tsx                  # 메인 애플리케이션 컴포넌트
├── types.ts                 # 전역 TypeScript 타입 정의 (Zod 기반)
└── ... (설정 파일)
```

## 🔧 기술 스택 상세

- **React 19 & TypeScript**: 최신 React 기능 활용 및 정적 타입 체킹
- **Zustand**: 경량화된 전역 상태 관리
- **Supabase**: PostgreSQL 데이터베이스, 인증, Row Level Security(RLS)
- **Cloudflare Workers**: 도서관 재고 크롤링 및 키워드 통합 검색 API 서버. **Cache API**를 활용한 응답 캐싱.
- **Vercel Serverless Functions**: Aladin API 키 보호를 위한 프록시 서버
- **Supabase Edge Functions**: 보안이 필요한 서버 사이드 로직 (피드백 이메일 전송)
- **Tailwind CSS**: 유틸리티 우선 CSS 프레임워크
- **Zod**: 런타임 데이터 검증

## 🚀 개발 환경 설정

### 로컬 개발 설정
1.  **저장소 클론 및 의존성 설치**
    ```bash
    git clone <repository-url>
    cd my_bookstation
    npm install
    ```
2.  **프론트엔드 환경 변수 설정** (`.env.local` 파일 생성 - Git 제외)
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_ALADIN_TTB_KEY=your_aladin_ttb_key
    ```
3.  **Cloudflare Workers 로컬 실행** (별도 터미널)
    ```bash
    cd library-checker
    npm install
    npm run dev
    ```
    - Worker는 기본적으로 `http://127.0.0.1:8787`에서 실행됩니다.
4.  **프론트엔드 개발 서버 실행**
    ```bash
    npm run dev
    ```

## 📊 API 명세

### 1. Aladin API 프록시 (Vercel Serverless)
- **엔드포인트**: `/api/search`
- **역할**: 클라이언트로부터 받은 검색 파라미터를 사용하여 서버 측에서 Aladin API를 호출합니다. TTB Key를 클라이언트에 노출하지 않습니다.

### 2. 통합 도서관 재고 API (Cloudflare Workers)
- **엔드포인트**:
  - 로컬: `http://127.0.0.1:8787`
  - 프로덕션: `https://library-checker.byungwook-an.workers.dev`
- **메서드**: `POST`
- **요청 본문**:
  ```json
  {
    "isbn": "9791190538534",
    "eduTitle": "12가지 인생의 법칙",
    "gyeonggiTitle": "12가지 인생의 법칙",
    "siripTitle": "12가지 인생의 법칙",
    "customTitle": "" // (Optional) 지정 시 위 3개 title 대신 사용
  }
  ```
- **응답 본문 (성공 예시)**:
  ```json
  {
    "title": "12가지 인생의 법칙",
    "isbn": "9791190538534",
    "author": "...",
    "customTitle": "",
    "lastUpdated": 1761380372099,
    "gwangjuPaper": { /* ... */ },
    "gyeonggiEbookEdu": { /* ... */ },
    "gyeonggiEbookLib": { /* ... */ },
    "siripEbook": { /* ... */ }
  }
  ```


### 3. 키워드 통합 검색 API (Cloudflare Workers)
- **엔드포인트**: `/keyword-search`
- **메서드**: `POST`
- **요청 본문**: `{ "keyword": "검색어" }`
- **응답 본문**: 연결된 모든 도서관의 검색 결과를 정규화한 평탄화된 배열
  ```json
  [
    {
      "type": "종이책",
      "libraryName": "퇴촌",
      "title": "도서 제목",
      "author": "저자",
      "publisher": "출판사",
      "pubDate": "2024",
      "loanStatus": true
    },
    {
      "type": "전자책",
      "libraryName": "e경기",
      ...
    },
    ...
  ]
  ```

### 4. 사용자 피드백 API (Supabase Edge Function)
- **엔드포인트**: `https://<project>.supabase.co/functions/v1/send-feedback-email`
- **메서드**: `POST`
- **인증**: `Authorization: Bearer <User JWT>` (Supabase Auth)


---

## 📚 도서관별 검색어 및 URL 생성 시스템 (중앙화 관리)

**`services/unifiedLibrary.service.ts`** 파일의 **`createLibraryOpenURL`** 함수를 통해 모든 도서관 외부 링크 생성을 중앙에서 관리합니다. 이는 코드의 일관성을 유지하고 유지보수를 용이하게 합니다.

### 검색어 처리 로직 우선순위
1.  **커스텀 검색어**: 사용자가 책별로 지정한 `customSearchTitle`이 있으면 최우선으로 사용합니다.
2.  **자동 생성 검색어**: 커스텀 검색어가 없는 경우, `createOptimalSearchTitle(title)` 함수를 통해 원본 제목을 가공하여 사용합니다.
    - **`createOptimalSearchTitle`**: 제목에서 콜론(`:`), 하이픈(`-`), 괄호(`()[]_{}`) 등 부제를 나타내는 특수문자 이후의 내용을 제거하고, 앞 3단어만 추출하여 검색 정확도를 높입니다.

### URL 생성 규칙 (`createLibraryOpenURL`)

| LibraryName (`libraryName`) | 도서관 | 생성 URL 패턴 (GET 방식) | 비고 |
| :--- | :--- | :--- | :--- |
| `퇴촌` | 광주 퇴촌도서관 (종이책) | `.../resultList.do?searchLibraryArr=MN&searchKeyword={검색어}` | 웹 방화벽 우회를 위해 상세페이지 대신 검색 결과 페이지 사용 |
| `기타` | 광주 기타 시립도서관 (종이책)| `.../resultList.do?searchLibrary=ALL&searchKeyword={검색어}` | |
| `e교육` | 경기도 교육청 전자도서관 | `.../search/index.do?search_text={검색어}` | |
| `e시립구독`| 광주 시립 구독형 전자책 | `.../search/searchList.ink?schTxt={검색어}` | 교보문고 플랫폼 |
| `e시립소장`| 광주 시립 소장형 전자책 | `.../search/searchList.ink?schTxt={검색어}` | 예스24 플랫폼 |
| `e경기` | 경기도 전자도서관 | `.../search?keyword={검색어}` | 소장형/구독형 통합 검색 페이지 |

**클라이언트 코드 사용 예시:**
```typescript
import { createLibraryOpenURL } from '../services/unifiedLibrary.service';

// ... 컴포넌트 내부
const searchUrl = createLibraryOpenURL("e경기", book.title, book.customSearchTitle);
```

---

## 💾 데이터 흐름 및 처리 (Data Flow & Processing)

`useBookStore`가 API 응답을 받아 DB에 저장하는 과정은 단순한 데이터 저장을 넘어, 화면 표시에 최적화된 형태로 데이터를 가공하고 안정성을 보장하는 중요한 파이프라인을 포함합니다.

### 데이터 조합 함수의 역할 분리

1.  **`combineRawApiResults` (데이터 확인용)**:
    -   **역할**: 알라딘과 도서관 API 응답을 **가공 없이 그대로 병합**합니다.
    -   **목적**: 상세 모달의 'API' 버튼 클릭 시, DB에 저장된 원본 `book_data`를 확인하는 용도입니다.

2.  **`createBookDataFromApis` (DB 저장 및 화면 표시용)**:
    -   **역할**: 두 API 응답을 조합하여, UI에서 사용하기 좋은 **"순수 API 데이터 객체(`ApiCombinedBookData`)"를 생성**합니다.
    -   **주요 로직**:
        -   **안전한 초기화**: `ApiCombinedBookData` 타입에 맞게 모든 도서관 관련 필드를 `null`로 초기화합니다.
        -   **성공 중심 할당**: 각 API 응답이 유효할 경우에만 해당 필드에 값을 할당합니다. 응답이 실패하거나(`undefined`, `null`), 비정상적(`{}`)이면 초기값 `null`이 유지됩니다.
        -   **파생 데이터 생성**: `toechonStock`, `filteredGyeonggiEbookInfo` 등 요약/파생 데이터를 생성합니다.

### 데이터 처리 파이프라인 요약

```mermaid
graph TD
    subgraph "API Calls"
        A[Aladin API]
        L[Library API via Cloudflare]
    end

    subgraph "Data Combiner (utils/bookDataCombiner.ts)"
        CP[createBookDataFromApis]
    end

    subgraph "Application"
        STORE[useBookStore <br>(refreshBookInfo)]
        DB[(Supabase DB <br> book_data)]
    end

    A --> CP
    L --> CP
    CP -- "Processed Data (pureApiData)" --> STORE

    STORE -- "Merge with User Data & Fallback" --> DB
```
- **데이터 복원 로직**: `refreshBookInfo` 함수는 `pureApiData`의 필드가 `undefined` 또는 `null`일 경우, 이를 API 실패로 간주하고 기존 DB에 저장된 `originalBook`의 값으로 복원하여 데이터 유실을 방지합니다.


## 🎨 재고 정보 UI/UX 가이드라인

내 서재의 재고 정보 표시는 사용자에게 안정적이고 일관된 경험을 제공하기 위해 **"점진적 정보 공개(Progressive Disclosure)"** 원칙을 따릅니다. 목록 뷰에서는 안정적인 핵심 정보를 간결하게, 상세 뷰에서는 현재 상태를 포함한 상세 정보를 제공합니다.

### 색상 표시 기준

재고 정보 태그의 색상은 아래의 기준으로 결정됩니다.

| UI 색상 | CSS 클래스 (`status-*`) | 의미 |
| :--- | :--- | :--- |
| **🟩 녹색/파란색** | `status-available` | **재고 있음:** DB에 저장된 총 재고(`_total`)가 1 이상인 경우. |
| **⬜ 회색** | `status-none` | **정보 없음 또는 재고 없음:** DB에 저장된 총 재고(`_total`)가 `0`이거나 `NULL`(아직 조회 전)인 경우. |
| **🟥 빨간색** | `status-unavailable` | **조회 실패:** **상세 모달**에서만 표시되며, 현재 API 정보 갱신에 실패했음을 의미. |

---

### 동작 시나리오 비교

아래 표는 리팩토링 전후의 동작 방식을 비교하여, 새로운 UX 원칙이 어떻게 적용되는지 보여줍니다.

#### **(A) 상황: (DB에 없는) 새 책을 서재에 추가하는 경우**

| 단계 | 동작 | [변경 전] 동작 방식 | [변경 후] 동작 방식 |
| :--- | :--- | :--- | :--- |
| **1** | '서재에 추가' 버튼 클릭 | `book` 객체 생성. API 정보 필드는 `null`. | (동일) `book` 객체 생성. `stock_*` 및 API 정보 필드 모두 `null`. |
| **2** | UI에 즉시 표시 (API 응답 전) | `isError`가 `true`가 됨<br/>(`!book.gwangjuPaperInfo` 조건 때문에).<br/>**UI 색상: 🟥 빨간색 (에러)** | `isError`가 `false`가 됨<br/>(`!!book.gwangjuPaperInfo` 조건 때문에). `totalBooks`는 `0`.<br/>**UI 색상: ⬜ 회색 (정보 없음)** |
| **3** | 백그라운드 API 조회 성공 | `isError`는 `false`. `totalBooks` > 0.<br/>**UI 색상: 🟩 녹색/파란색 (재고 있음)** | (동일) `isError`는 `false`. `totalBooks` > 0.<br/>**UI 색상: 🟩 녹색/파란색 (재고 있음)** |
| **4** | 백그라운드 API 조회 실패 | `isError`는 `true`.<br/>**UI 색상: 🟥 빨간색 (에러)** | (동일) `isError`는 `true`.<br/>**UI 색상: 🟥 빨간색 (에러)** |

**✨ 개선점:** 새 책 추가 시 발생하는 불필요한 '에러' 상태(빨간색) 표시를 제거하여, 사용자에게 보다 안정적인 첫인상을 제공합니다.

---

#### **(B) 상황: (DB에 과거 '성공' 데이터가 있는) 기존 책을 조회/새로고침하는 경우**

| 단계 | 동작 | [변경 전] 동작 방식 | [변경 후] 동작 방식 |
| :--- | :--- | :--- | :--- |
| **1** | **내 서재 목록** 로드 | DB의 `stock_*` 값(`> 0`)을 사용. `isError`는 `false`.<br/>**UI 색상: 🟩 녹색/파란색** | `isError`를 무시하고 `stock_*` 값(`> 0`)만 사용.<br/>**UI 색상: 🟩 녹색/파란색** |
| **2** | '새로고침' 클릭 (API **실패** 시) | `isError`가 `true`가 됨. `totalBooks`는 과거 값 유지.<br/>**UI 색상: 🟥 빨간색 (에러)** | `isError`를 무시. `totalBooks`는 과거 값 유지.<br/>**UI 색상: 🟩 녹색/파란색 (유지)** |
| **3** | **상세 모달** 열기 (API **실패** 후) | `hasError`가 `true`.<br/>**UI 표시: 🟥 빨간색 + `(에러)`** | (동일) `hasError`가 `true`.<br/>**UI 표시: 🟥 빨간색 + `(에러)`** |

**✨ 개선점:** API 새로고침이 일시적으로 실패하더라도, **목록 뷰에서는 마지막으로 성공한 정보를 계속 보여주어** 안정적인 경험을 제공합니다. 사용자는 상세 정보에 진입해서만 현재의 '갱신 실패' 상태를 인지하게 됩니다.

---

#### **(C) 상황: (DB에 과거 '실패' 데이터가 있는) 기존 책을 조회/새로고침하는 경우**

| 단계 | 동작 | [변경 전] 동작 방식 | [변경 후] 동작 방식 |
| :--- | :--- | :--- | :--- |
| **1** | **내 서재 목록** 로드 | `stock_*`는 `NULL`(`totalBooks: 0`). `...Info`는 `{error}` 객체(`isError: true`).<br/>**UI 색상: 🟥 빨간색 (에러)** | `isError`를 무시. `stock_*`는 `NULL`(`totalBooks: 0`).<br/>**UI 색상: ⬜ 회색 (정보 없음)** |
| **2** | '새로고침' 클릭 (API **성공** 시) | DB 값 갱신. `isError`는 `false`.<br/>**UI 색상: 🟩 녹색/파란색 (재고 있음)** | (동일) DB 값 갱신.<br/>**UI 색상: 🟩 녹색/파란색 (재고 있음)** |
| **3** | **상세 모달** 열기 | `hasError`가 `true`. `totalCount`는 `undefined`.<br/>**UI 표시: 🟥 빨간색 + `(에러)`** | (동일) `hasError`가 `true`. `totalCount`는 `undefined`.<br/>**UI 표시: 🟥 빨간색 + `(에러)`** |

**✨ 개선점:** 과거에 조회 실패했던 책이 목록에서 계속 빨간색으로 표시되어 사용자에게 스트레스를 주던 문제를 해결했습니다. 이제 **회색(정보 없음)으로 차분하게 표시**하여, 사용자가 필요할 때 다시 조회하도록 유도합니다.


## 🗃️ 데이터베이스 유지보수 및 최적화 로그 (Database Maintenance & Optimization Log)

이 섹션은 Supabase의 'Database Linter'를 통해 발견된 경고들을 해결하고, 프로젝트의 성능, 보안, 안정성을 향상시킨 내역을 기록합니다.

### **최종 수정일: 2025-11-02**

#### **요약**
Supabase 대시보드에서 보고된 성능 및 보안 관련 경고들에 대해 전면적인 검토 및 수정을 진행했습니다. 모든 주요 경고 항목을 해결하여 데이터베이스의 안정성과 확장성을 확보했습니다.

| 경고 유형 (Warning Type) | 상태 (Status) | 주요 조치 (Action Taken) |
| :--- | :--- | :--- |
| `vulnerable_postgres_version` | ✅ **완료** | 보안 패치가 포함된 최신 버전으로 PostgreSQL 업그레이드 완료. |
| `auth_rls_initplan` | ✅ **완료** | 모든 RLS 정책에서 `auth.uid()`를 `(select auth.uid())`로 변경하여 쿼리 성능 최적화. |
| `function_search_path_mutable`| ✅ **완료** | 모든 DB 함수에 `search_path`를 명시적으로 설정하여 보안 강화. |
| `extension_in_public` | ✅ **완료** | `pg_trgm` 확장 프로그램을 `extensions` 스키마로 분리하여 관리 효율성 증대. |
| `auth_otp_long_expiry` | ✅ **완료** | 이메일 OTP 만료 시간을 24시간(`86400s`)에서 10분(`600s`)으로 단축하여 보안 강화. |
| `auth_leaked_password_protection`| ⚠️ **확인** | 유료 플랜 기능으로 확인. 클라이언트 단에서 `zxcvbn` 라이브러리를 통한 비밀번호 강도 검사로 대체 권장. |

---

### **상세 조치 내역**

#### **1. RLS 정책 성능 최적화 (`auth_rls_initplan`)**

-   **문제점**: `user_library`, `user_settings`, `dev_notes` 테이블의 RLS 정책이 각 행마다 `auth.uid()` 함수를 반복 호출하여, 데이터 증가 시 심각한 성능 저하를 유발했습니다.
-   **해결 과정**:
    1.  `auth.uid()`를 서브쿼리 형태인 `(select auth.uid())`로 감싸, 쿼리 당 단 한 번만 실행되도록 수정했습니다.
    2.  초기 수정 시, `user_settings` 테이블에서 `uuid`와 `bigint` 타입 불일치 에러(`operator does not exist: uuid = bigint`)가 발생했습니다.
    3.  `Table Editor`에서 테이블 스키마를 직접 확인하여 `user_settings`와 `dev_notes` 테이블에서 사용자 식별 컬럼이 `id`가 아닌 `user_id`임을 파악하고, 이를 정책에 정확히 반영했습니다.
-   **최종 조치**: 아래 SQL 쿼리를 실행하여 모든 관련 RLS 정책을 성공적으로 최적화했습니다.

    ```sql
    -- user_library 테이블 정책 최적화
    ALTER POLICY "Allow individual read access" ON public.user_library USING (((select auth.uid()) = user_id));
    ALTER POLICY "Allow individual insert access" ON public.user_library WITH CHECK (((select auth.uid()) = user_id));
    ALTER POLICY "Allow individual update access" ON public.user_library USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
    ALTER POLICY "Allow individual delete access" ON public.user_library USING (((select auth.uid()) = user_id));
    
    -- user_settings 테이블 정책 최적화
    ALTER POLICY "Users can view own settings" ON public.user_settings USING (((select auth.uid()) = user_id));
    ALTER POLICY "Users can insert own settings" ON public.user_settings WITH CHECK (((select auth.uid()) = user_id));
    ALTER POLICY "Users can update own settings" ON public.user_settings USING (((select auth.uid()) = user_id));
    ALTER POLICY "Users can delete own settings" ON public.user_settings USING (((select auth.uid()) = user_id));
    
    -- dev_notes 테이블 정책 최적화
    ALTER POLICY "Users can view own dev notes" ON public.dev_notes USING (((select auth.uid()) = user_id));
    ALTER POLICY "Users can insert own dev notes" ON public.dev_notes WITH CHECK (((select auth.uid()) = user_id));
    ALTER POLICY "Users can update own dev notes" ON public.dev_notes USING (((select auth.uid()) = user_id));
    ALTER POLICY "Users can delete own dev notes" ON public.dev_notes USING (((select auth.uid()) = user_id));
    ```

#### **2. 함수 안정성 및 보안 강화 (`function_search_path_mutable`)**

-   **문제점**: 데이터베이스 함수들에 `search_path`가 고정되어 있지 않아, 잠재적인 스키마 하이재킹 공격에 취약했습니다.
-   **해결 과정**:
    1.  초기 수정 시, `get_books_by_tags` 와 `get_all_user_library_isbn` 함수에서 '함수가 존재하지 않는다'는 에러가 발생했습니다.
    2.  원인은 `ALTER FUNCTION` 구문에 사용된 함수의 인자(Signature)가 실제 데이터베이스에 정의된 것과 달랐기 때문입니다.
    3.  `pg_proc` 테이블을 조회하는 쿼리를 통해 모든 대상 함수의 정확한 인자 정보를 파악했습니다.
        -   `get_books_by_tags`: `(text[])`, `(text[], boolean)` 두 가지 오버로딩된 형태임을 확인.
        -   그 외 함수들: 인자를 받지 않는 형태임을 확인.
-   **최종 조치**: 정확한 함수 서명(Signature)을 사용하여 아래 SQL 쿼리를 실행, 모든 함수의 `search_path`를 `public`으로 고정했습니다.

    ```sql
    -- 인자가 있는 함수 수정
    ALTER FUNCTION public.get_books_by_tags(text[]) SET search_path = 'public';
    ALTER FUNCTION public.get_books_by_tags(text[], boolean) SET search_path = 'public';
    
    -- 인자가 없는 함수 수정
    ALTER FUNCTION public.get_all_user_library_isbn() SET search_path = 'public';
    ALTER FUNCTION public.get_all_user_library_isns() SET search_path = 'public';
    ALTER FUNCTION public.get_tag_counts_for_user() SET search_path = 'public';
    ALTER FUNCTION public.keep_alive() SET search_path = 'public';
    ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
    ```

#### **3. 데이터베이스 구조 개선 및 기타 보안 조치**

-   **확장 프로그램 스키마 분리 (`extension_in_public`)**: `pg_trgm` 확장 프로그램을 `public` 스키마에서 전용 `extensions` 스키마로 이전하여 관리 효율성을 높였습니다.
    ```sql
    CREATE SCHEMA IF NOT EXISTS extensions;
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
    ```
-   **OTP 만료 시간 단축 (`auth_otp_long_expiry`)**: 이메일 인증 코드의 유효 시간을 24시간(`86400`초)에서 10분(`600`초)으로 대폭 단축하여 인증 보안을 강화했습니다.
    -   **수정 경로**: `Authentication` > `Sign In / Providers` > `Email` > `Email OTP Expiration`
    

## 🐛 트러블슈팅 가이드

이 섹션은 프로젝트 개발 중 발생했던 주요 문제들과 그 해결 과정을 기록하여, 유사 문제 발생 시 빠르고 효과적으로 대응하기 위한 가이드입니다.

---

### **[유형 1] 크롤링 실패: 세션 쿠키(Session Cookie)가 필요한 경우**

-   **대상 사이트**: 광주시립도서관 구독형 전자책
-   **증상**: 간헐적으로 `HTTP 400 Bad Request` 오류가 발생하며 크롤링 실패.
-   **원인 분석**: 대상 서버의 동적인 안티-스크래핑 정책. 서버는 단순히 쿠키 유무뿐만 아니라, **최초 접속 시의 요청 헤더 패턴**과 **단시간 내 연속적인 새 세션 요청 패턴** 등을 분석하여 봇을 탐지하고 차단한다.
-   **시행착오 및 교훈**:
    -   **실패한 접근 (KV 세션 캐싱):** 세션을 재사용하려는 시도는 Worker 환경의 동시성 문제로 인해 오히려 서버 차단을 유발하는 역효과를 낳았다.
    -   **성공한 접근 (단순 2단계 요청 + 헤더 강화):** 복잡한 상태 관리를 제거하고, **매 요청마다 독립적으로 새 세션을 발급받되, 각 요청(세션 획득/검색)의 헤더를 실제 브라우저와 거의 동일하게 모방**하는 것이 가장 안정적이었다.
-   **최종 해결 전략**: "매번 새로운 세션을 요청하는 단순한 패턴"과 "정교한 브라우저 헤더 위장"을 결합.
    1.  **1단계 (세션 획득):** `Sec-Fetch-*` 등 전체 브라우저 헤더를 모방하여 첫 접속 요청을 보낸다.
    2.  **2단계 (검색 수행):** 획득한 쿠키와 `Referer` 헤더를 포함하여, 페이지 내 정상 이동처럼 보이는 검색 요청을 보낸다.
-   **핵심 교훈**: 크롤링 시 상태 관리(Statefulness)의 복잡성은 신중하게 고려해야 하며, 때로는 가장 단순한 Stateless 접근법이 더 견고할 수 있다. **(상세 히스토리는 `docs/crawling_troubleshooting_guide` 참조)**

---

### **[유형 2] 크롤링 실패: 동적 인증 토큰(Dynamic Token)이 필요한 경우**

-   **대상 사이트**: 경기도 전자도서관 구독형 전자책
-   **증상**: `401 Unauthorized` 또는 `403 Forbidden` 오류가 발생하며, 일반적인 헤더 구성으로는 요청이 거부됩니다.
-   **원인 분석**: 서버가 매 요청마다 실시간으로 생성된 **시간 기반 동적 인증 토큰**을 `token` 헤더에 요구합니다. 이 토큰이 없거나 유효하지 않으면 요청이 차단됩니다.
-   **해결 전략**: 도서관 사이트의 JavaScript 코드를 분석하여 토큰 생성 규칙을 파악하고, 이를 Worker 코드 내에서 그대로 재현합니다.

    1.  **1단계: KST 시간 생성**
        -   서버가 한국 표준시(KST, UTC+9)를 기준으로 시간을 검증하므로, `new Date(new Date().getTime() + 9 * 60 * 60 * 1000)` 코드를 통해 KST 현재 시간을 계산합니다.

    2.  **2단계: 토큰 문자열 조합**
        -   생성된 KST 시간을 `YYYYMMDDHHMM` 형식의 문자열로 변환합니다.
        -   이 타임스탬프와 서버가 지정한 고정 ID(`0000000685`)를 쉼표로 연결하여 원본 토큰 문자열을 만듭니다. (예: `202510271530,0000000685`)

    3.  **3단계: Base64 인코딩**
        -   조합된 토큰 문자열을 Base64로 인코딩합니다. 이때, 실행 환경(Cloudflare Worker의 `btoa` / Node.js의 `Buffer`)에 맞는 함수를 사용해야 합니다.

    4.  **4단계: 인증된 검색 (Authenticated Search)**
        -   검색 API 엔드포인트(`https://api.bookers.life/...`)로 `POST` 요청을 보냅니다.
        -   요청 헤더의 **`token` 필드**에 3단계에서 생성한 동적 토큰을 담아 전송합니다.

    **핵심 코드 (`library-checker/src/index.js`):**
    ```javascript
    // (경기도 전자도서관 구독형 검색 함수 내)
    // 1 & 2. KST 시간 기반 토큰 문자열 생성
    const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const timestamp = /* YYYYMMDDHHMM 형식으로 변환 */;
    const tokenString = `${timestamp},0000000685`;
    
    // 3. Base64 인코딩 (Cloudflare 환경)
    const dynamicToken = btoa(tokenString);

    // 4. 토큰을 헤더에 담아 POST 요청
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'token': dynamicToken,
        'Content-Type': 'application/json;charset=UTF-8',
        'Referer': 'https://ebook.library.kr/',
        // ... 기타 헤더
      },
      body: JSON.stringify({ search: query, /* ... */ })
    });
    ```
-   **교훈**: 두 사례는 크롤링 시 마주치는 대표적인 인증 패턴입니다. `40x` 계열 오류 발생 시, 단순 헤더 변경 외에 **다단계 인증(세션 쿠키) 또는 동적 토큰** 요구 여부를 반드시 확인해야 합니다.

---

### **[유형 3] 캐싱 실패: 동일한 요청에도 계속 Cache MISS가 발생하는 경우**

-   **대상 시스템**: Cloudflare Workers Cache API
-   **증상**: 동일한 `POST` 요청을 반복적으로 보내도 Worker 로그에 계속 `Cache MISS`가 기록되고, 응답 시간도 줄어들지 않는다. `cache.put()`이 호출되는 로그는 확인되지만, `cache.match()`는 항상 실패한다.
-   **원인 분석**: Cloudflare Cache API는 HTTP 표준을 엄격하게 준수한다. 캐시에 응답을 성공적으로 저장하고 조회하려면 다음 두 가지 조건이 충족되어야 하지만, 초기 코드에서는 이를 간과했다.
    1.  **캐시 가능한 응답 헤더 부재**: `cache.put()`으로 저장하는 `Response` 객체에 `Cache-Control`과 같은 캐싱 지시 헤더가 없으면, Cloudflare는 이 응답을 "캐시할 가치가 없는" 일회성 데이터로 간주하고 실제로 저장하지 않을 수 있다.
    2.  **불안정한 캐시 키**: `POST` 요청 자체를 캐시 키(`cache.match(request)`)로 사용하면, `Content-Type` 등 미묘한 헤더 차이로 인해 동일한 요청으로 인식되지 않을 수 있다.
-   **해결 전략**: 캐싱 로직을 HTTP 표준에 맞게 명시적으로 수정한다.
    1.  **안정적인 캐시 키 생성**: 원본 `POST` 요청 본문에서 캐싱에 영향을 주는 데이터(ISBN, 제목 등)를 추출하여 정렬하고, 이를 해싱하여 고유한 식별자를 만든다. 이 식별자를 경로로 사용하는 **새로운 `GET` 메서드의 `Request` 객체**(`new Request('https://.../cache/<hash>')`)를 생성하여 캐시 키로 사용한다. 이렇게 하면 원본 요청의 헤더와 무관하게 일관된 키를 보장할 수 있다.
    2.  **`Cache-Control` 헤더 명시**: 캐시 MISS가 발생하여 새로운 응답을 생성할 때, 해당 `Response` 객체의 헤더에 **`'Cache-Control': 'public, max-age=43200'`** (12시간)을 명시적으로 추가한다. 이 헤더는 "이 응답은 공개적으로 캐시해도 좋으며, 12시간 동안 유효하다"는 명확한 지시를 캐시 시스템에 전달한다.
    3.  **에러 응답 캐싱 방지**: 크롤링 중 일부 도서관에서 오류가 발생한 응답은 캐싱하지 않도록, 해당 `Response` 객체에는 `'Cache-Control': 'no-store'` 헤더를 설정하여 잘못된 데이터가 캐시에 저장되는 것을 방지한다.

    **핵심 코드 (`library-checker/src/index.ts`):**
    ```typescript
    // 1. 안정적인 GET 요청 객체를 캐시 키로 생성
    const cacheUrl = new URL(request.url);
    cacheUrl.pathname = '/cache/' + hashHex;
    const cacheKeyRequest = new Request(cacheUrl.toString(), { method: 'GET' });

    // 캐시 조회
    let response = await cache.match(cacheKeyRequest);

    if (response) {
      console.log("Cache HIT!");
      // ...
    } else {
      // ... 크롤링 로직 수행 ...
      
      // 2. 캐시할 응답에 Cache-Control 헤더 추가
      const responseHeaders = {
        // ... 기타 헤더
        'Cache-Control': 'public, max-age=43200' 
      };
      
      const newResponse = new Response(JSON.stringify(payload), { headers: responseHeaders });

      // 캐시에 저장
      if (!hasError) {
        ctx.waitUntil(cache.put(cacheKeyRequest, newResponse.clone()));
      }
      
      return newResponse;
    }
    ```
-   **교훈**: 서버리스 환경의 캐시 API를 사용할 때는 내부 동작을 추측하기보다, **HTTP 캐싱 표준(특히 `Cache-Control` 헤더)을 명확히 준수**하는 것이 가장 확실하고 안정적인 방법이다. 캐시 키는 항상 일관성과 유일성이 보장되도록 신중하게 설계해야 한다.

### [유형 4] 기술 결정: 경기도 전자도서관 공식 API를 사용하지 않는 이유
> 핵심 기능(재고 정보) 유지를 위한 의사 결정 기록

-   **상황**: 최근 경기도 전자도서관에서 소장형 전자책에 대한 **공식 OpenAPI** (`/api/open-search/ebook`)를 제공하기 시작한 것을 발견. 기존에 사용하던 **비공식 API** (`/api/service/search-engine`)를 공식 API로 교체할지 여부를 검토함.

-   **분석 및 비교**: 두 API는 반환하는 데이터의 성격에 결정적인 차이가 있습니다.

| 구분 | ✅ 현재 사용하는 비공식 API | ⚠️ 신규 발견한 공식 API |
| :--- | :--- | :--- |
| **엔드포인트** | `/api/service/search-engine` | `/api/open-search/ebook` |
| **제공 데이터**| 서지 정보 + **재고 정보 (총 보유/대출 수량)** | 서지 정보 **ONLY** |
| **핵심 기능** | **대출 가능 여부 표시 (✅ 가능)** | **대출 가능 여부 표시 (❌ 불가능)** |
| **안정성** | 비공식 (언제든 변경/중단 가능) | 공식 (비교적 안정적) |
| **적용 시 영향**| **기능 유지** | **핵심 기능(재고 확인) 저하** |

-   **결론**: 사용자 경험의 핵심인 **"대출 가능 여부" 정보를 상실**하는 것은 심각한 기능적 다운그레이드에 해당합니다. 따라서, 비공식 API의 잠재적 불안정성을 감수하더라도 **현재 구현을 유지**하는 것이 프로젝트의 가치를 보존하는 데 더 유리하다고 판단합니다.

-   **장기적 대책 (Fallback 전략)**:
    1.  현재 사용하는 비공식 API가 중단될 경우를 대비한 **"점진적 기능 저하 (Graceful Degradation)"** 전략을 수립합니다.
    2.  **구현 아이디어**: Cloudflare Worker에서 비공식 API 호출(`searchGyeonggiEbookOwned`)이 실패(`catch` 블록)하면, 차선책으로 공식 API를 호출합니다.
    3.  **UI 처리**: 이 경우, 반환된 데이터에 `availabilityUnknown: true` 와 같은 플래그를 추가합니다. 프론트엔드는 이 플래그를 감지하여 재고 정보를 `(?/?)` 또는 `(확인 불가)`와 같이 표시하여, 책의 존재는 알리되 재고 정보는 불확실함을 명확히 전달합니다.

---

### 초기 로딩된 데이터에만 기능이 작동하는 경우

**증상:**
-   '내 서재' 검색 또는 태그 필터링 후 나타난 책에 대해 특정 기능(예: 상세 모달 열기, 재고 새로고침, 태그/메모 CRUD)이 작동하지 않는다.
-   반면, 페이지를 처음 로드했을 때 보이는 책들(예: 25/50권)에 대해서는 동일한 기능이 정상적으로 작동한다.
-   React 개발자 도구에서는 상태 변경이 일어나는 것처럼 보이지만, UI에는 아무런 변화가 없다.

**원인 분석: 제한된 데이터 소스 참조 (The "Wrong Drawer" Problem)**

이 문제는 대부분의 경우 프론트엔드 상태 관리 로직에서 발생합니다. 우리 프로젝트는 성능을 위해 초기에는 일부 데이터(`myLibraryBooks`)만 로드하고, 검색/필터 시에는 별도의 상태(`librarySearchResults`, `libraryTagFilterResults`)를 사용합니다.

문제는 특정 기능을 수행하는 함수(예: `updateBookInStoreAndDB`, `refreshAllBookInfo`)가 업데이트할 대상 객체를 찾을 때, **오직 `myLibraryBooks`라는 하나의 "서랍"에서만** 객체를 찾으려고 시도하기 때문에 발생합니다. 만약 사용자가 다른 서랍(`librarySearchResults`)에 있는 객체에 대해 작업을 요청하면, 함수는 대상을 찾지 못하고 아무것도 하지 않거나 에러를 반환합니다.

**진단 워크플로우:**

1.  **기능 확인**: 작동하지 않는 기능(예: `addTagToBook`)이 의존하는 핵심 함수(예: `updateBookInStoreAndDB`)를 `useBookStore.ts`에서 찾습니다.
2.  **데이터 소스 추적**: 해당 함수가 업데이트할 원본 객체(`originalBook`)를 어디서 가져오는지 확인합니다. 아래와 같은 코드가 있다면 의심해야 합니다.
    ```typescript
    const { myLibraryBooks } = get();
    const originalBook = myLibraryBooks.find(b => b.id === id); // << 문제의 코드
    ```
3.  **재현**: '내 서재'에서 '전체 보기'를 누르지 않은 상태로, 스크롤을 내려 보이지 않는 책의 제목을 검색합니다. 검색 결과로 나온 책에 대해 해당 기능을 실행했을 때 문제가 재현되는지 확인합니다.

**해결 방안: 중앙화된 데이터 조회 함수 사용**

이 문제를 근본적으로 해결하려면, 객체를 찾을 때 모든 잠재적인 데이터 소스를 검색하는 중앙화된 조회 함수를 사용해야 합니다.

1.  **`getBookById` 함수 활용**:
    `useBookStore.ts`에 이미 `getBookById` 함수가 구현되어 있습니다. 이 함수는 `myLibraryBooks`, `librarySearchResults`, `libraryTagFilterResults`를 모두 검색하고, 그래도 없으면 DB에 직접 요청하는 가장 견고한 방법입니다.

2.  **기존 코드 수정**:
    문제가 되는 함수 내부에서 `myLibraryBooks.find(...)`를 사용하는 대신, `getBookById`를 호출하도록 수정합니다.

    **수정 전:**
    ```typescript
    const { myLibraryBooks } = get();
    const originalBook = myLibraryBooks.find(b => b.id === id);
    if (!originalBook) return;
    // ...
    ```

    **수정 후:**
    ```typescript
    const { getBookById } = get();
    const originalBook = await getBookById(id);
    if (!originalBook) return;
    // ...
    ```

3.  **UI 상태 동시 업데이트**:
    데이터를 업데이트하는 함수(`updateBookInStoreAndDB`, `refreshAllBookInfo`)는 `setState`를 호출할 때 **모든 관련 상태 배열**(`myLibraryBooks`, `librarySearchResults`, `libraryTagFilterResults`)을 동시에 업데이트해야 합니다. 이를 통해 어떤 뷰(기본, 검색, 필터)에 있더라도 UI가 일관되게 변경됩니다.

    ```typescript
    // 좋은 예시
    useBookStore.setState(state => ({
      myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? updatedBook : b)),
      librarySearchResults: state.librarySearchResults.map(b => (b.id === id ? updatedBook : b)),
      libraryTagFilterResults: state.libraryTagFilterResults.map(b => (b.id === id ? updatedBook : b)),
    }));
    ```

**핵심 원칙**: 사용자 인터랙션의 대상이 되는 객체를 찾거나 수정할 때는, 현재 화면에 보이는 데이터의 출처(`myLibraryBooks`, `librarySearchResults` 등)와 관계없이, **존재하는 모든 데이터 소스를 포괄하는 단일 통로(`getBookById`)**를 통해 접근해야 합니다.


### API 조회 실패 시 "조회중..."이 무한 반복되는 경우

-   **증상**: 상세 정보 모달에서 특정 재고 정보가 "조회중..."으로 계속 표시되고 멈춥니다.
-   **원인**: API 조회 실패 시 DB에 해당 필드가 `null`로 저장됩니다. UI 컴포넌트가 `!book.someInfo` 와 같이 `null`을 `false`로 해석하여 로딩 상태로 오판하기 때문입니다.
-   **해결**: `MyLibraryBookDetailModal`의 `StockDisplay` 컴포넌트에서 로딩 상태 판단 조건을 `!book.someInfo`에서 `book.someInfo === undefined`로 수정했습니다. 이를 통해 `undefined`(아직 로드 전)와 `null`(API 조회 실패 또는 데이터 없음)을 명확히 구분하여 처리합니다.


### 경기도 광주시 퇴촌도서관 상세페이지 웹 방화벽 차단
- **증상**: 크롤링 데이터에 포함된 상세페이지 URL(`resourcedetail/detail.do?...`)로 직접 접근 시 "Web firewall security policies have been blocked" 에러 페이지가 표시됨.
- **원인**: 도서관 시스템의 보안 정책 강화로 외부에서의 상세페이지 직접 링크가 차단됨.
- **해결**: `createLibraryOpenURL` 함수에서 '퇴촌' 케이스 처리 시, 상세페이지 URL 대신 **제목 기반 검색 결과 페이지 URL**을 생성합니다. 사용자는 검색 결과 목록에서 해당 도서를 클릭하여 상세 정보를 확인할 수 있습니다.

### API 요청 타임아웃 (전체 응답 지연)
- **증상**: 하나의 도서관 서버 응답이 지연되면 전체 재고 조회(`Promise.allSettled`)가 늦어짐.
- **해결**: Cloudflare Worker(`library-checker/src/index.js`)에서 각 도서관 `fetch` 요청에 `AbortSignal.timeout(15000)` (15초)을 설정했습니다. 특정 서버가 15초 내에 응답하지 않으면 해당 요청만 실패 처리하고 나머지 결과를 반환합니다.

### 경기도 전자도서관 검색 결과 0건 (특수문자 문제)
- **증상**: 책 제목에 특수문자가 포함된 경우 검색 결과가 0건으로 나옴.
- **해결**: API 호출 방식을 복잡한 `detailQuery` 파라미터 대신, 실제 웹사이트 검색창과 동일하게 동작하는 `keyword` 파라미터 방식으로 변경하여 검색 정확도를 높였습니다.

---

### 주요 변경점 요약

1.  **아키텍처 & 프로젝트 구조:**
    -   `bookDataCombiner.ts`의 역할을 명확히 하여 프로젝트 구조도에 추가했습니다.
    -   `AdminPanel.tsx`의 이름이 `DevToolsFloat.tsx`로 변경된 것을 반영했습니다.

2.  **기술 스택:**
    -   Cloudflare Workers 설명에 **"Cache API를 활용한 응답 캐싱"**을 명시하여 프로젝트의 중요한 성능 개선 포인트를 강조했습니다.

3.  **API 명세:**
    -   통합 도서관 재고 API의 요청 본문에서 `author` 필드를 제거하여, 최근 커밋(`6a4656d`)에서 해당 기능이 제거되었음을 반영했습니다.
    -   응답 본문 예시에도 `author`를 추가하여, 디버깅 목적으로 값이 그대로 반환됨을 명시했습니다.

4.  **데이터 흐름 및 처리:**
    -   `combineApiResults`를 `createBookDataFromApis`로 수정하여 실제 함수명과 일치시켰습니다.
    -   `createBookDataFromApis`의 핵심 로직인 **"안전한 초기화"**와 **"성공 중심 할당"**을 명확히 설명했습니다.
    -   Mermaid 다이어그램을 단순화하고, `useBookStore`의 **"데이터 복원 로직"**을 텍스트로 명시하여 데이터 유실 방지 매커니즘을 설명했습니다.

5.  **트러블슈팅 가이드:**
    -   가장 최근에 해결된 **"'조회중...' 무한 반복 버그"**에 대한 원인과 해결 방안을 신규 항목으로 추가했습니다.

---
**문서 최종 수정일**: 2025-10-25
```

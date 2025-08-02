# 개발 가이드 (Development Guide)

마이북스테이션 프로젝트의 개발자를 위한 기술 문서입니다.

## 🏗️ 아키텍처 개요

### 프론트엔드 아키텍처
```
┌─────────────────────────────────────────────────┐
│                 React Components                │
├─────────────────────────────────────────────────┤
│          Zustand State Management               │
│  ┌─────────────┬─────────────┬─────────────┐    │
│  │ useUIStore  │useAuthStore │useBookStore │    │
│  └─────────────┴─────────────┴─────────────┘    │
├─────────────────────────────────────────────────┤
│                Service Layer                    │
│  ┌─────────────────┬─────────────────────────┐  │
│  │ aladin.service  │ library.service         │  │
│  └─────────────────┴─────────────────────────┘  │
├─────────────────────────────────────────────────┤
│              External APIs                      │
│  ┌─────────────────┬─────────────────────────┐  │
│  │ Aladin API      │ Library Stock API       │  │
│  └─────────────────┴─────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 상태 관리 의존성 구조
```
useUIStore (기본 UI 상태)
    ↑
useAuthStore (인증 상태)
    ↑  
useBookStore (비즈니스 로직)
```

## 📁 디렉토리 구조

```
my_bookstation/
├── components/              # React 컴포넌트
│   ├── layout/             # 레이아웃 관련 컴포넌트
│   │   ├── Header.tsx      # 상단 헤더 (로그인/로그아웃)
│   │   └── Footer.tsx      # 하단 푸터
│   ├── Auth.tsx            # 인증 폼
│   ├── AuthModal.tsx       # 인증 모달
│   ├── BookModal.tsx       # 도서 검색 결과 모달
│   ├── BookDetails.tsx     # 선택된 도서 상세 정보
│   ├── MyLibrary.tsx       # 개인 서재 관리
│   ├── MyLibraryBookDetailModal.tsx # 내 서재 상세 정보 모달
│   ├── LibraryStock.tsx    # 도서관 재고 정보
│   ├── SearchForm.tsx      # 도서 검색 폼
│   ├── StarRating.tsx      # 별점 평가 컴포넌트
│   ├── Notification.tsx    # 알림 메시지
│   ├── Spinner.tsx         # 로딩 스피너
│   ├── Icons.tsx           # 아이콘 컴포넌트
│   └── APITest.tsx         # API 테스트 컴포넌트 (개발용)
├── stores/                 # Zustand 상태 관리
│   ├── useAuthStore.ts     # 사용자 인증 상태
│   ├── useBookStore.ts     # 도서 및 서재 관련 상태
│   └── useUIStore.ts       # UI 상태 (모달, 로딩, 알림)
├── services/               # API 서비스 계층
│   ├── aladin.service.ts   # 알라딘 도서 검색 API
│   └── library.service.ts  # 도서관 재고 확인 API
├── lib/                    # 라이브러리 설정
│   └── supabaseClient.ts   # Supabase 클라이언트 초기화
├── docs/                   # 프로젝트 문서
└── types.ts                # TypeScript 타입 정의
```

## 🔧 핵심 기술 스택

### Frontend Framework
- **React 19**: 최신 React 기능 및 훅 활용
- **TypeScript**: 정적 타입 체킹으로 런타임 에러 방지
- **Vite**: 빠른 HMR(Hot Module Replacement) 개발 환경

### 상태 관리
- **Zustand 4.5.4**: 
  - Redux 대비 간단한 보일러플레이트
  - TypeScript 완벽 지원
  - 분리된 스토어로 관심사 분리

### UI/UX
- **Tailwind CSS**: 유틸리티 우선 CSS 프레임워크
- **반응형 디자인**: 모바일 및 데스크톱 환경 지원

### 데이터 검증
- **Zod 3**: 
  - 런타임 타입 검증
  - 외부 API 응답 안정성 보장
  - TypeScript 타입 추론 지원

### Backend & Authentication
- **Supabase**:
  - PostgreSQL 데이터베이스
  - 실시간 구독
  - 소셜 로그인 (Google) 및 이메일 인증

## 🔄 데이터 플로우

### 1. 도서 검색 플로우
```
SearchForm → useBookStore.searchBooks() → aladin.service → Zod 검증 → UI 업데이트
```

### 2. 도서관 재고 확인 플로우
```
BookDetails → useBookStore.refreshStock() → library.service → Zod 검증 → UI 업데이트
```

### 3. 서재 관리 플로우
```
MyLibrary → useBookStore (CRUD operations) → Supabase → Real-time sync
```

## 🔍 주요 컴포넌트 분석

### useBookStore.ts
**역할**: 도서 검색, 서재 관리, 도서관 재고 확인의 중심 허브

**주요 상태**:
- `searchResults`: 검색된 도서 목록
- `selectedBook`: 현재 선택된 도서
- `myLibraryBooks`: 개인 서재의 도서 목록

**핵심 액션**:
- `searchBooks()`: 알라딘 API 도서 검색
- `fetchUserLibrary()`: Supabase에서 사용자 서재 로드
- `addToLibrary()`: 서재에 도서 추가
- `refreshStock()`: 도서관 재고 확인

### useAuthStore.ts
**역할**: 사용자 인증 상태 관리

**주요 상태**:
- `session`: Supabase 세션 객체

**핵심 액션**:
- `initializeAuthListener()`: 인증 상태 변화 감지
- `signOut()`: 로그아웃 처리

### useUIStore.ts
**역할**: 모달, 로딩, 알림 등 UI 상태 관리

**주요 상태**:
- `isBookModalOpen`: 도서 검색 모달 상태
- `isAuthModalOpen`: 인증 모달 상태
- `isLoading`: 전역 로딩 상태
- `notification`: 알림 메시지

## 🔒 타입 시스템

### 외부 API 타입 (Zod 기반)
```typescript
// Zod 스키마로 정의 후 타입 추론
export type AladdinBookItem = z.infer<typeof AladdinBookItemSchema>;
export type LibraryStockResponse = z.infer<typeof LibraryStockResponseSchema>;
```

### 내부 애플리케이션 타입
```typescript
// 직접 정의로 단순성 확보
export type ReadStatus = '읽지 않음' | '읽는 중' | '완독';
export type StockInfo = {
  total: number;
  available: number;
};
```

### 복합 타입
```typescript
// 외부 타입과 내부 타입의 조합
export type BookData = AladdinBookItem & {
  toechonStock: StockInfo;
  otherStock: StockInfo;
  addedDate: number;
  readStatus: ReadStatus;
  rating: number;
};
```

## 🛠️ 개발 환경 설정

### 필수 도구
- **Node.js**: 18.0 이상
- **npm**: 8.0 이상 
- **TypeScript**: 5.8.2
- **VS Code**: 권장 에디터 (TypeScript 확장 필수)

### 추천 VS Code 확장
- **TypeScript Importer**: 자동 import 관리
- **Tailwind CSS IntelliSense**: CSS 클래스 자동완성
- **ES7+ React/Redux/React-Native snippets**: React 스니펫

### 환경 변수
```bash
# .env.local
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🧪 테스팅 전략

### 타입 검증
```bash
# TypeScript 컴파일 체크
npm run build

# 타입 체크만 실행
npx tsc --noEmit
```

### API 응답 검증
- 모든 외부 API 응답은 Zod 스키마로 런타임 검증
- 개발 환경에서 `APITest.tsx` 컴포넌트로 API 동작 확인

## 🚀 배포

### Vercel 배포 (권장)
1. GitHub 연동
2. 환경 변수 설정
3. 자동 배포 파이프라인 구성

### 환경별 설정
- **개발**: `npm run dev` (CORS 프록시 사용)
- **프로덕션**: `/api/search` 엔드포인트 (자체 백엔드 프록시)

## 🔧 트러블슈팅

### 자주 발생하는 문제

1. **TypeScript 컴파일 에러**
   - `TYPESCRIPT_GUIDELINES.md` 참조
   - interface 대신 type 사용 권장

2. **CORS 에러**
   - 개발 환경: corsproxy.io 사용
   - 프로덕션 환경: 백엔드 프록시 설정 필요

3. **Supabase 연결 에러**
   - 환경 변수 확인
   - Row Level Security (RLS) 정책 확인

### 디버깅 도구
- **React Developer Tools**: 컴포넌트 상태 확인
- **Browser DevTools**: 네트워크 요청 모니터링
- **Zustand DevTools**: 상태 변화 추적

---

*문서 최종 수정일: 2025-08-01 20:50*
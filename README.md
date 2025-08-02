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

### 📍 통합 도서 재고 확인
- **실시간 통합 조회**: 종이책(광주 시립도서관)과 전자책(경기도 교육도서관) 재고를 한 번의 요청으로 동시에 확인
- **최적화된 API 호출**: 통합된 서비스 로직을 통해 불필요한 네트워크 요청을 최소화
- **도서관 바로가기**: 재고 확인 셀 클릭 시, 해당 도서관의 도서 검색 결과 페이지로 바로 이동
- **재고 새로고침**: 클릭 한 번으로 최신 재고 상태 업데이트

### 👤 개인 서재 관리
- **내 서재**: 관심 도서를 개인 서재에 저장 및 관리
- **독서 기록**: 읽음 상태(읽지 않음/읽는 중/완독) 및 별점(1-5점) 기록
- **다양한 정렬 기능**: 추가순, 제목순, 저자순, 출간일순, 별점순, 읽음순 정렬 지원
- **데이터 내보내기**: 서재 데이터를 CSV 파일로 내보내기

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
├── gemini.md               # Gemini 에이전트 협업 규칙
└── ...
```

## 🔧 최근 주요 업데이트 (v1.5.0)

### 서비스 계층 리팩토링 및 API 최적화
- ✅ **API 호출 통합**: 종이책과 전자책 재고를 조회하는 API 호출 로직을 하나로 통합하여, 중복과 비효율을 제거하고 성능을 개선했습니다.
- ✅ **코드 구조 개선**: `library.service.ts`를 제거하고 `unifiedLibrary.service.ts`로 역할을 일원화하여 서비스 계층의 명확성을 높였습니다.
- ✅ **UI/UX 개선**: 상세 정보 모달, 내 서재 테이블 레이아웃 등 사용자 편의성을 높이기 위한 다양한 UI 개선 작업을 진행했습니다.

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

*마지막 업데이트: 2025-08-03*
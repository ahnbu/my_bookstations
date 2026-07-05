(참고 - 20250916 : 자동 배포 테스트용 1줄 입력)

# Library Checker - Cloudflare Workers

마이북스테이션 프로젝트의 통합 도서관 재고 확인 API를 위한 Cloudflare Workers입니다.

## 📋 기능

- 경기광주 시립도서관 종이책 재고 확인
- 경기도교육청 전자책 재고 확인 (성남/통합도서관)
- 경기도 전자도서관 전자책 재고 확인
- Supabase 무료요금제 유지를 위한 Keep-Alive 기능 (3일마다 실행)

## 🚀 로컬 개발 환경 설정

### 1. 환경 변수 설정

`.dev.vars` 파일을 생성하고 Supabase 정보를 입력하세요:

```bash
# .dev.vars
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 2. 로컬 개발 서버 실행

```bash
# 개발 서버 시작 (포트 8787)
npm run dev

# 또는 특정 포트로 실행
wrangler dev --test-scheduled --port 8787
```

### 3. API 테스트

**기본 상태 확인:**
```bash
curl -X GET "http://127.0.0.1:8787"
```

**도서 검색 테스트:**
```bash
curl -X POST "http://127.0.0.1:8787" \
  -H "Content-Type: application/json" \
  -d '{"isbn": "9788934985822", "title": "아몬드", "gyeonggiTitle": "아몬드"}'
```

## 📝 사용법

### API 엔드포인트

- **메서드**: `POST`
- **URL**: `http://127.0.0.1:8787` (로컬) 또는 `https://library-checker.byungwook-an.workers.dev` (프로덕션)
- **Content-Type**: `application/json`

### 요청 형식

```json
{
  "isbn": "9788934985822",
  "title": "아몬드",
  "gyeonggiTitle": "아몬드"
}
```

### 응답 형식

```json
{
  "gwangjuPaper": {
    "title": "도서 제목",
    "availability": [
      {
        "libraryName": "광주시립중앙도서관",
        "callNo": "813.6-소32아",
        "baseCallNo": "813.6-소32아",
        "loanStatus": "대출가능",
        "dueDate": "-"
      }
    ]
  },
          "gyeonggiEbookEdu": [
    {
      "libraryName": "성남도서관",
      "도서명": "아몬드",
      "저자": "손원평",
      "출판사": "창비",
      "발행일": "2017-03-31",
      "loanStatus": "대출가능"
    }
  ],
  "gyeonggiEbookLib": {
    "libraryName": "경기도 전자도서관",
    "totalCount": 1,
    "availableCount": 1,
    "unavailableCount": 0,
    "owned_count": 1,
    "subscription_count": 0,
    "books": [
      {
        "type": "소장형",
        "title": "소장형 전자책",
        "status": "대출가능"
      }
    ]
  }
}
```

## 🔧 개발자 정보

### 프로젝트 구조

```
library-checker/
├── src/
│   └── index.ts          # 메인 Workers 스크립트
├── wrangler.jsonc        # Workers 설정
├── package.json          # 의존성 및 스크립트
├── .dev.vars            # 로컬 개발용 환경 변수
├── .env.example         # 환경 변수 예제
└── README.md            # 이 파일
```

### 주요 기능

- **CORS 지원**: 모든 도메인에서 접근 가능
- **에러 처리**: 각 도서관별 개별 에러 처리
- **타임아웃**: 15초 타임아웃으로 안정성 확보
- **스케줄된 작업**: Supabase Keep-Alive (3일마다 실행)

### 배포

```bash
# 프로덕션 배포
npm run deploy
```

## 🔄 프론트엔드 연동

React 앱의 `services/unifiedLibrary.service.ts`에서 자동으로 로컬/프로덕션 엔드포인트를 선택합니다:

- **개발 환경**: `http://127.0.0.1:8787`
- **프로덕션 환경**: `https://library-checker.byungwook-an.workers.dev`

## 📊 모니터링

Wrangler Dashboard에서 실시간 로그와 성능 지표를 확인할 수 있습니다:

```bash
wrangler tail
```

---

*마지막 업데이트: 2026-07-05*

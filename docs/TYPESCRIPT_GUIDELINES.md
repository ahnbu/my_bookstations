# TypeScript 코딩 가이드라인

이 가이드라인은 반복적인 TypeScript 에러를 방지하고 코드베이스의 타입 안정성을 유지하기 위해 작성되었습니다.

## 🚨 주의사항: 복잡한 타입 정의

### ❌ 피해야 할 패턴
```typescript
// 복잡한 z.infer 체인 - TypeScript 컴파일러가 추론하기 어려움
export interface ComplexType extends z.infer<typeof ComplexSchema> {
  additionalField: SomeOtherComplexType;
}

// 깊은 중첩 타입 - "excessively deep type instantiation" 에러 유발
export type DeepType = ComplexInterface & {
  nested: {
    deeper: {
      evenDeeper: SomeInferredType;
    };
  };
};
```

### ✅ 권장하는 패턴
```typescript
// 직접적인 타입 정의 - 명확하고 추론하기 쉬움
export type SimpleType = {
  field1: string;
  field2: number;
  field3?: boolean;
};

// 타입 별칭 사용으로 복잡도 감소
export type BookData = AladdinBookItem & {
  toechonStock: StockInfo;
  otherStock: StockInfo;
  addedDate: number;
  readStatus: ReadStatus;
  rating: number;
};
```

## 📦 외부 라이브러리 타입 호환성

### JSON/JSONB 타입과의 호환성
```typescript
// ❌ Interface 사용 - Json 타입과 호환성 문제
export interface StockInfo {
  total: number;
  available: number;
}

// ✅ Type alias 사용 - Json 타입과 호환
export type StockInfo = {
  total: number;
  available: number;
};
```

### Supabase 타입 캐스팅
```typescript
// ✅ 안전한 타입 캐스팅
const { data, error } = await supabase
  .from('user_library')
  .insert([{ user_id: session.user.id, book_data: newBookData as Json }])
  .select('id, book_data')
  .single();

if (data?.book_data) {
  const bookData = data.book_data as BookData; // 런타임에서 안전한 캐스팅
}
```

## 🔄 Store 간 의존성 관리

### ✅ 건전한 의존성 구조
```
useUIStore (기본 UI 상태)
    ↑
useAuthStore (인증 상태)
    ↑  
useBookStore (비즈니스 로직)
```

### ❌ 순환 의존성 방지
```typescript
// 피해야 할 패턴
// useAuthStore.ts
import { useBookStore } from './useBookStore'; // 순환 의존성!

// useBookStore.ts  
import { useAuthStore } from './useAuthStore';
```

### ✅ 의존성 조정은 컴포넌트에서
```typescript
// App.tsx에서 store 간 조정
useEffect(() => {
  if (session) {
    fetchUserLibrary(); // 로그인 시 라이브러리 로드
  } else {
    clearLibrary(); // 로그아웃 시 라이브러리 클리어
  }
}, [session, fetchUserLibrary, clearLibrary]);
```

## 🔍 Zod 스키마와 TypeScript 타입

### 외부 API 타입은 Zod 스키마 기반
```typescript
// ✅ 외부 API 데이터는 Zod로 검증 후 타입 추론
export type AladdinBookItem = z.infer<typeof AladdinBookItemSchema>;

// 서비스에서 사용
const validationResult = AladdinAPIResponseSchema.safeParse(rawData);
if (validationResult.success) {
  const data: AladdinAPIResponse = validationResult.data;
}
```

### 내부 애플리케이션 타입은 직접 정의
```typescript
// ✅ 내부 로직용 타입은 직접 정의
export type ReadStatus = '읽지 않음' | '읽는 중' | '완독';
export type SortKey = 'title' | 'author' | 'addedDate' | 'rating' | 'readStatus';
```

## 🔧 타입 에러 디버깅 전략

### 1. 컴파일러 에러 메시지 분석
- `not assignable to never` → 타입 추론 실패, 단순한 타입으로 교체 고려
- `excessively deep type instantiation` → 복잡한 타입 체인 단순화 필요
- `not assignable to type 'Json'` → 타입 구조를 Json 호환으로 변경

### 2. 단계별 해결
1. **타입 단순화**: 복잡한 intersection이나 extends 제거
2. **의존성 확인**: 순환 참조나 불필요한 의존성 제거  
3. **외부 타입 분리**: 라이브러리 타입과 앱 타입 명확히 분리

## 🎯 베스트 프랙티스

1. **타입 우선 설계**: 복잡한 로직보다는 단순하고 명확한 타입 구조 선택
2. **점진적 타이핑**: 한 번에 모든 타입을 완벽하게 만들려 하지 말고 점진적으로 개선
3. **검증과 타입 분리**: 런타임 검증(Zod)과 컴파일타임 타입(TypeScript)의 역할 명확히 구분
4. **의존성 최소화**: Store 간, 타입 간 의존성을 최소화하여 복잡도 감소

---

*문서 최종 수정일: 2025-08-01 20:50*
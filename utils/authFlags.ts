// utils/authFlags.ts
//
// "이 브라우저에서 로그인한 적이 있는가"를 기록·조회한다.
//
// 비로그인 화면을 두 갈래로 가르는 근거다.
//   - 로그인 이력 없음 → 데모 서재(포트폴리오용 예시 20권)
//   - 로그인 이력 있음 → 로그인 안내 화면 (로그아웃·세션 만료)
//
// 로그아웃해도 지우지 않는다. 지우면 기존 사용자가 로그아웃할 때마다
// 내 서재 자리에 남의 책 20권이 뜬다.
//
// 개인 식별 정보를 담지 않는다. 불리언 하나뿐이다.

const HAS_SIGNED_IN_KEY = 'hasSignedIn';

// localStorage는 사파리 프라이빗 모드 등에서 접근이 막힐 수 있으므로 예외를 삼킨다.
export function markSignedIn(): void {
  try {
    localStorage.setItem(HAS_SIGNED_IN_KEY, 'true');
  } catch {
    // 저장 실패 시 데모가 보일 뿐이므로 앱을 멈추지 않는다
  }
}

export function hasSignedInBefore(): boolean {
  try {
    return localStorage.getItem(HAS_SIGNED_IN_KEY) === 'true';
  } catch {
    return false;
  }
}

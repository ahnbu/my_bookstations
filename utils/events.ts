// 앱 전역 이벤트 상수 정의

/**
 * 홈 버튼 클릭 시 전체 앱 상태를 초기화하는 이벤트
 * 모든 필터, 검색어, 정렬, 선택된 책, 열린 모달 등을 초기 상태로 리셋
 */
export const HOME_RESET_EVENT = 'app:home-reset';

/**
 * 홈 리셋 이벤트 타입 정의
 */
export interface HomeResetEvent extends CustomEvent {
  type: typeof HOME_RESET_EVENT;
}

/**
 * 홈 리셋 이벤트를 발생시키는 헬퍼 함수
 */
export const dispatchHomeReset = (): void => {
  window.dispatchEvent(new CustomEvent(HOME_RESET_EVENT));
};

/**
 * 홈 리셋 이벤트 리스너를 등록하는 헬퍼 함수
 * @param handler 이벤트 핸들러 함수
 * @returns cleanup 함수
 */
export const addHomeResetListener = (handler: () => void): (() => void) => {
  const eventHandler = () => handler();
  window.addEventListener(HOME_RESET_EVENT, eventHandler);

  // cleanup 함수 반환
  return () => {
    window.removeEventListener(HOME_RESET_EVENT, eventHandler);
  };
};
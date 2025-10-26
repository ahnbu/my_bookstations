import React from 'react';
import { useUIStore } from '../stores/useUIStore';

const WelcomeModal: React.FC = () => {
  const { isWelcomeModalOpen, closeWelcomeModal } = useUIStore();

  // 관리자 설정에서 환영 메시지 설정 로드
  const getWelcomeMessageSettings = () => {
    try {
      const savedSettings = localStorage.getItem('adminWelcomeMessageSettings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (error) {
      console.error('환영 메시지 설정 로드 실패:', error);
    }
    // 기본값 반환
    return {
      enabled: true,
      content: `마이 북스테이션에
오신 것을 환영합니다.

이 서비스는
경기도 광주시의
책을 좋아하는 사람들이
지역 도서관과 전자도서관 재고를
간편하게 찾아볼 수 있도록
만든 것입니다.

맨 위 검색 창에
원하는 책 제목을 입력하고
"내 서재 추가"를 눌러보세요.

그러면 해당 책이
관내 도서관에 있는지
도서관 전자책이 있는지
알 수 있습니다.

💡 가끔 재고 확인에
오류가 나기도 하니
재고가 없는 경우는
책 오른쪽 끝에 있는
새로고침 버튼을 눌러보세요.`
    };
  };

  const welcomeSettings = getWelcomeMessageSettings();

  // ESC 키로 모달 닫기
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isWelcomeModalOpen) {
        closeWelcomeModal();
      }
    };

    if (isWelcomeModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isWelcomeModalOpen, closeWelcomeModal]);

  // "다시 보지 않기" 버튼 클릭 핸들러
  const handleDontShowAgain = () => {
    localStorage.setItem('hasVisited', 'true');
    closeWelcomeModal();
  };

  // "닫기" 버튼 클릭 핸들러 (재방문 시 다시 표시)
  const handleClose = () => {
    closeWelcomeModal();
  };

  // 관리자가 환영 메시지를 비활성화한 경우 또는 모달이 닫혀있는 경우 렌더링하지 않음
  if (!isWelcomeModalOpen || !welcomeSettings.enabled) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-primary border border-secondary rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col">

        {/* 컨텐츠 */}
        <div className="p-6 space-y-4">
          <div className="text-center space-y-4">
            <div className="text-sm text-secondary leading-relaxed whitespace-pre-line">
              {welcomeSettings.content}
            </div>
          </div>
        </div>

        {/* 하단 버튼 
        <div className="flex gap-3 p-6 border-t border-secondary">*/}
        <div className="flex gap-3 p-6">

          <button
            onClick={handleDontShowAgain}
            className="btn-base flex-1 btn-secondary"
          >
            다시 보지 않기
          </button>
          <button
            onClick={handleClose}
            className="btn-base flex-1 btn-primary"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
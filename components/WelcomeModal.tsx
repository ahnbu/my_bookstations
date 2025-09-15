import React from 'react';
import { useUIStore } from '../stores/useUIStore';

const WelcomeModal: React.FC = () => {
  const { isWelcomeModalOpen, closeWelcomeModal } = useUIStore();

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

  if (!isWelcomeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-primary border border-secondary rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col">
        {/* 헤더 
        <div className="flex items-center justify-between p-6 border-b border-secondary">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📚</span>
            <div>
              <h2 className="text-xl font-bold text-primary">환영합니다!</h2>
              <p className="text-sm text-secondary">마이 북스테이션에 처음 방문하셨군요</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-secondary hover:text-primary transition-colors p-2 hover:bg-secondary rounded-full"
            title="닫기 (ESC)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div> */}

        {/* 컨텐츠 */}
        <div className="p-6 space-y-4">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold text-primary">
              마이 북스테이션에 <br/>
              오신 것을 환영합니다.</h3>

            <div className="space-y-3 text-sm text-secondary leading-relaxed">
              <p>
                이 서비스는<br/>
                경기도 광주시의<br/> 
                책을 좋아하는 사람들이<br/>
                지역 도서관과 전자도서관 재고를<br/>
                간편하게 찾아볼 수 있도록<br/>
                만든 것입니다.
              </p>

              <p>
                맨 위 검색 창에<br/>
                원하는 책 제목을 입력하고<br/>
                "내 서재 추가"를 눌러보세요.
              </p>

              <p>
                그러면 해당 책이<br/>
                관내 도서관에 있는지<br/>
                도서관 전자책이 있는지<br/>
                알 수 있습니다.<br/> <br/> 
              </p>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mt-4">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <span className="font-semibold">💡</span> 
                  가끔 재고 확인에<br/>
                  오류가 나기도 하니<br/>
                  재고가 없는 경우는<br/>
                  책 오른쪽 끝에 있는<br/>
                  새로고침 버튼을 눌러보세요.<br/>
                </p>
              </div>
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
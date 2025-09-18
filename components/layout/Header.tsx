
import React from 'react';
import Auth from '../Auth';
import { useBookStore } from '../../stores/useBookStore';
import { useUIStore } from '../../stores/useUIStore';
import { dispatchHomeReset } from '../../utils/events';

const Header: React.FC = () => {
  const { unselectBook } = useBookStore();
  const { closeBookSearchListModal } = useUIStore();

  const handleLogoClick = () => {
    // 전역 홈 리셋 이벤트 발생 - 모든 컴포넌트가 초기 상태로 리셋됨
    dispatchHomeReset();

    // 기존 로직 유지 (중복이지만 안전장치로)
    unselectBook(); // 선택된 책 해제
    closeBookSearchListModal(); // 검색 모달 닫기

    // 부드럽게 페이지 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="flex justify-between items-center mb-10">
      {/* 브랜드 로고 */}
      <button 
        onClick={handleLogoClick}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity duration-200 group"
        title="홈으로 돌아가기"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#60A5FA" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="min-w-6 min-h-6"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 hidden sm:block group-hover:from-blue-300 group-hover:to-teal-200 transition-all duration-200">
          마이 북스테이션
        </h1>
      </button>
      
      {/* 로그인 버튼 */}
      <Auth />
    </header>
  );
};

export default Header;

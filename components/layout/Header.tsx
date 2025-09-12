
import React from 'react';
import Auth from '../Auth';

const Header: React.FC = () => {
  return (
    <header className="flex justify-between items-center mb-10">
      {/* 브랜드 로고 */}
      <div className="flex items-center gap-2">
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
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 hidden sm:block">
          마이 북스테이션
        </h1>
      </div>
      
      {/* 로그인 버튼 */}
      <Auth />
    </header>
  );
};

export default Header;

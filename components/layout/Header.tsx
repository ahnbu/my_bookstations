
import React from 'react';
import Auth from '../Auth';

const Header: React.FC = () => {
  return (
    <header className="flex flex-col mb-10">
      <div className="flex justify-end w-full mb-4">
        <Auth />
      </div>
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
          마이 북스테이션
        </h1>
        <p className="mt-3 text-lg text-gray-400 max-w-3xl mx-auto">
          책에 빠진 당신을 위한 올인원 서재 관리
          <br />
          <span className="text-base text-gray-500">책 검색, 도서관 재고 확인에서 개인 서재까지 한 곳에서.</span>
        </p>
      </div>
    </header>
  );
};

export default Header;

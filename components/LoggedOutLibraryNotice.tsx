// components/LoggedOutLibraryNotice.tsx
//
// 로그인 이력이 있는 방문자가 로그아웃했거나 세션이 만료됐을 때 '내 서재' 자리에 뜬다.
//
// 데모 서재를 도입하기 전(커밋 1a6c4d3)의 안내 화면을 그대로 복원한 것이다.
// 이 자리에 데모 20권을 띄우면 기존 사용자가 남의 책을 자기 서재로 오인한다.

import React from 'react';

const LoggedOutLibraryNotice: React.FC = () => (
  <div
    className="mt-12 animate-fade-in text-center text-secondary p-8 bg-elevated rounded-lg shadow-inner"
    data-testid="logged-out-notice"
  >
    <h2 className="text-2xl font-bold mb-4 text-primary">내 서재</h2>
    <p>로그인 후 '내 서재' 기능을 사용해보세요.</p>
    <p className="text-sm mt-2">관심있는 책을 저장하고, 여러 기기에서 확인하세요.</p>
  </div>
);

export default LoggedOutLibraryNotice;

// components/BookListContainer.tsx
//
// 서재 목록을 담는 컨테이너다. 레이아웃 정본은 이 파일 하나다.
//
// MyLibrary(로그인)와 DemoLibrary(비로그인 예시)가 같은 컨테이너를 쓴다.
// 데모가 컨테이너를 따로 지어서 그리드가 1열로 늘어졌던 사고(_docs/20260818_03_...)의 재발을 막는다.
//
// 데이터·콜백·스토어를 모르는 순수 프레젠테이션 컴포넌트로 유지한다.
// 스피너·빈 결과 안내처럼 col-span-full이 필요한 블록은 children으로 넘겨
// 그리드 컨테이너의 직접 자식 위치를 유지한다.

import React from 'react';
import { ViewType } from '../types';

interface BookListContainerProps {
  viewType: ViewType;
  gridColumns: number;
  children: React.ReactNode;
  'data-testid'?: string;
}

const BookListContainer: React.FC<BookListContainerProps> = ({
  viewType,
  gridColumns,
  children,
  'data-testid': dataTestId,
}) => {
  if (viewType === 'card') {
    return (
      <div className="space-y-4 max-w-4xl mx-auto" data-testid={dataTestId}>
        {children}
      </div>
    );
  }

  return (
    <div
      className="grid gap-4 max-w-4xl mx-auto"
      style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
};

export default BookListContainer;

// components/DemoModeBanner.tsx
//
// "이 화면은 예시다"라는 메타 안내다. 서비스 본체가 아니라 별도 층이다.
//
// App.tsx에서 main 바깥 최상단에 렌더한다. main 안에 넣으면 max-w-4xl 안으로 들어가
// 서비스 콘텐츠처럼 읽히고, 안내와 본체가 다시 섞인다.
//
// 배치 제약
//   - z-40: 모달(z-50)과 토스트(z-[100]) 아래여야 한다. 모달 위로 띠가 뚫고 나오면 안 된다
//   - sticky top-0: 책 목록까지 스크롤해도 예시라는 사실이 유지돼야 한다
//   - 문구는 중앙 정렬 + 우측 여백: 토스트가 fixed top-5 right-5라 세로 구간이 겹친다.
//     토스트가 위에 그려지므로 문구가 우측으로 뻗으면 가려진다

import React from 'react';
import { DEMO_SNAPSHOT_DATE } from '../data/demoLibrary';

const DemoModeBanner: React.FC = () => (
  <div
    className="sticky top-0 z-40 w-full bg-blue-600 text-white text-sm text-center px-4 sm:px-64 py-2"
    data-testid="demo-mode-banner"
  >
    로그인 전 미리보기 — 아래 서재는 예시 데이터입니다
    {/* 재고 기준일은 375px에서 줄바꿈을 만들므로 640px 이상에서만 노출한다 */}
    <span className="hidden sm:inline"> (재고 {DEMO_SNAPSHOT_DATE} 기준)</span>
  </div>
);

export default DemoModeBanner;

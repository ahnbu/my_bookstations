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
//
// 색: 로그인 버튼과 같은 파랑(blue-600)을 쓰면 클릭 가능한 CTA처럼 읽힌다.
// 같은 계열에서 채도만 낮춰 "관련은 있되 조작 대상은 아닌" 층으로 보이게 한다.
// 하단 경계선이 서비스 본체와의 경계를 긋는다.
//
// 색은 Tailwind의 dark: variant가 아니라 index.css의 .demo-mode-banner가 담당한다.
// 이 프로젝트는 tailwind.config 없이 CDN만 쓰므로 dark:가 OS 선호를 따르고
// 앱 테마(body의 .dark/.light)와 어긋난다. 자세한 이유는 index.css 주석 참조.

import React from 'react';

const DemoModeBanner: React.FC = () => (
  <div
    className="demo-mode-banner sticky top-0 z-40 w-full text-sm text-center px-4 sm:px-64 py-2"
    data-testid="demo-mode-banner"
  >
    미리보기 - 로그인하시면 나만의 서재를 만듭니다
  </div>
);

export default DemoModeBanner;

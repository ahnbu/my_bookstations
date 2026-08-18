// hooks/useDemoMode.ts
//
// 서재 자리에 무엇을 보여줄지 판정하는 정본이다.
//
// App.tsx(상단 안내 띠)와 MyLibrary.tsx(서재 본문)가 같은 훅을 읽는다.
// 두 곳이 조건을 따로 계산하면 띠만 뜨고 데모는 안 뜨는 상태가 생긴다.

import { useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { hasSignedInBefore } from '../utils/authFlags';

export type LibraryViewMode = 'library' | 'demo' | 'loggedOut';

export function useDemoMode(): LibraryViewMode {
  const session = useAuthStore(state => state.session);

  // localStorage 값은 렌더 도중 바뀌지 않아야 하므로 마운트 시 1회만 읽는다.
  const [signedInBefore] = useState(() => hasSignedInBefore());

  if (session) return 'library';
  return signedInBefore ? 'loggedOut' : 'demo';
}

export default useDemoMode;

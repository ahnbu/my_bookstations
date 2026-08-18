// hooks/useGridColumns.ts
//
// 그리드 뷰의 반응형 컬럼 수를 계산한다.
// MyLibrary와 DemoLibrary가 같은 값을 쓰도록 이 훅 하나만 정본으로 둔다.
// 값을 바꾸려면 여기만 고친다. 호출부에서 숫자를 다시 적지 않는다.

import { useEffect, useState } from 'react';

export function useGridColumns(): number {
  const [gridColumns, setGridColumns] = useState(5);

  // Responsive grid columns (optimized for max-w-4xl container)
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setGridColumns(2);        // 모바일: 2개 (~320px/카드)
      else if (width < 768) setGridColumns(3);   // 태블릿: 3개 (~256px/카드)
      else if (width < 1024) setGridColumns(3);  // 소형 데스크톱: 3개 (~298px/카드)
      else setGridColumns(4);                    // 중형 이상: 4개 (~224px/카드)
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  return gridColumns;
}

export default useGridColumns;

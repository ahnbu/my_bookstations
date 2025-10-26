import React from 'react';
import type { CustomTag } from '../types';
import CustomTagComponent from './CustomTag';
import { useBookStore } from '../stores/useBookStore';

interface TagFilterProps {
  tags: CustomTag[];
  activeTags: Set<string>;
  onTagClick: (tagId: string) => void;
  onClearAll: () => void;
}

const TagFilter: React.FC<TagFilterProps> = ({
  tags,
  activeTags,
  onTagClick,
  onClearAll,
}) => {
  // useBookStore에서 전체 서재 기준 태그 카운트 가져오기
  const { tagCounts } = useBookStore();

  // ✅ [수정] 1순위: 색상, 2순위: 인기도 순으로 정렬
  const tagUsageStats = React.useMemo(() => {
    // 사용량 많은 순으로 정렬
    return tags
      .map(tag => ({
        tag,
        count: tagCounts[tag.id] || 0
      }))
      .filter(item => item.count > 0) // 사용된 태그만 필터링
      .sort((a, b) => {
        // 1. 색상 순서 (보라 'primary' > 연보라 > secondary(회색))
        const colorOrder = { 'primary': 0, 'secondary': 1, 'tertiary': 2 };
        
        // 2. 색상 값을 기준으로 비교합니다.
        const colorDifference = colorOrder[a.tag.color] - colorOrder[b.tag.color];
        
        // 3. 만약 색상이 다르다면, 그 결과를 바로 반환합니다.
        if (colorDifference !== 0) {
          return colorDifference;
        }
        
        // 4. 색상이 같다면, 인기도(count)가 높은 순서로 정렬합니다.
        return b.count - a.count;
      });
  }, [tags, tagCounts]);


  if (tagUsageStats.length === 0) {
    return null; // 태그가 없으면 필터 영역을 표시하지 않음
  }

    // ✅ [추가] 선택된 활성 태그의 이름 목록을 생성하는 로직
  const activeTagNames = Array.from(activeTags)
    .map(id => tags.find(tag => tag.id === id)?.name) // ID로 태그 이름을 찾음
    .filter(Boolean) // 이름이 없는 경우(undefined)를 필터링
    .join(', '); // 쉼표와 공백으로 이름들을 연결

  return (
    <div className="mb-4 p-3 bg-secondary rounded-lg border border-primary">
      <div className="flex flex-wrap items-center gap-2">
        {tagUsageStats.map(({ tag, count }) => (
          <CustomTagComponent
            key={tag!.id}
            tag={tag!}
            isActive={activeTags.has(tag!.id)}
            onClick={() => onTagClick(tag!.id)}
            showCount={count}
            size="sm"
          />
        ))}

        {activeTags.size > 0 && (
          <button
            onClick={onClearAll}
            className="ml-3 px-2 py-1 text-xs text-secondary hover:text-primary transition-colors underline"
            title="모든 태그 필터 해제"
          >
            전체 해제
          </button>
        )}
      </div>

      {activeTags.size > 0 && (
        <div className="mt-2 pt-2 border-t border-primary">
          
          <span className="text-xs text-tertiary">
            태그 필터링 : <span className="font-medium text-secondary">{activeTagNames}</span>
            {/* {activeTags.size}개 태그로 필터링됨 */}
          </span>
        </div>
      )}
    </div>
  );
};

export default TagFilter;
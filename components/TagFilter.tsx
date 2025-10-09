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

  // 태그 사용량 정렬 및 상위 10개만 표시
  const tagUsageStats = React.useMemo(() => {
    // 사용량 많은 순으로 정렬하고 상위 10개만 표시
    return tags
      .map(tag => ({
        tag,
        count: tagCounts[tag.id] || 0
      }))
      .filter(item => item.count > 0) // 사용된 태그만 필터링
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [tags, tagCounts]);

  if (tagUsageStats.length === 0) {
    return null; // 태그가 없으면 필터 영역을 표시하지 않음
  }

  // <span className="text-sm text-secondary mr-2">인기 태그:</span>
  //         <span className="text-sm text-secondary mr-2"></span> 
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
            {activeTags.size}개 태그로 필터링됨
          </span>
        </div>
      )}
    </div>
  );
};

export default TagFilter;
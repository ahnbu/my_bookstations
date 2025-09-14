import React from 'react';
import type { CustomTag, SelectedBook } from '../types';
import CustomTagComponent from './CustomTag';

interface TagFilterProps {
  tags: CustomTag[];
  books: SelectedBook[];
  activeTags: Set<string>;
  onTagClick: (tagId: string) => void;
  onClearAll: () => void;
}

const TagFilter: React.FC<TagFilterProps> = ({
  tags,
  books,
  activeTags,
  onTagClick,
  onClearAll,
}) => {
  // 태그 사용량 계산 및 정렬
  const tagUsageStats = React.useMemo(() => {
    const stats = new Map<string, number>();

    books.forEach(book => {
      book.customTags?.forEach(tagId => {
        stats.set(tagId, (stats.get(tagId) || 0) + 1);
      });
    });

    // 사용량 많은 순으로 정렬하고 상위 10개만 표시
    return Array.from(stats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tagId, count]) => ({
        tag: tags.find(t => t.id === tagId),
        count
      }))
      .filter(item => item.tag); // 태그가 존재하는 것만 필터링
  }, [tags, books]);

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
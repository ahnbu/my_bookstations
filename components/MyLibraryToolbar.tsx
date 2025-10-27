// components/MyLibraryToolbar.tsx

import React, { useState, useRef, useEffect } from 'react';
import { SortKey, CustomTag, ViewType } from '../types';
import { SearchIcon, CloseIcon, HeartIcon, TrashIcon } from './Icons';
import TagFilter from './TagFilter';

const SortArrow: React.FC<{ order: 'asc' | 'desc' }> = ({ order }) => (
  <span className="ml-1 inline-block w-3 h-3 text-xs">
    {order === 'asc' ? '▲' : '▼'}
  </span>
);

interface MyLibraryToolbarProps {
  // Search
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;

  // View
  viewType: ViewType;
  onViewTypeChange: (viewType: ViewType) => void;

  // Tags
  availableTags: CustomTag[];
  activeTags: Set<string>;
  onTagClick: (tagId: string) => void;
  onClearAllTags: () => void;
  
  // Sort
  sortConfig: { key: SortKey; order: 'asc' | 'desc' };
  onSortChange: (key: SortKey) => void;

  // Book Counts & Selection
  selectedBookCount: number;
  filteredBookCount: number;
  totalBookCount: number;
  displayedBookCount: number;
  isAllBooksShown: boolean;
  hasActiveFilters: boolean;
  selectAllChecked: boolean;
  onSelectAllChange: (checked: boolean) => void;
  
  // Actions
  onBulkTagManage: () => void;
  onToggleFavoritesFilter: () => void;
  isFavoritesFilterActive: boolean;
  onDeleteSelected: () => void;
}

const MyLibraryToolbar: React.FC<MyLibraryToolbarProps> = ({
  searchQuery,
  onSearchQueryChange,
  viewType,
  onViewTypeChange,
  availableTags,
  activeTags,
  onTagClick,
  onClearAllTags,
  sortConfig,
  onSortChange,
  selectedBookCount,
  filteredBookCount,
  totalBookCount,
  displayedBookCount,
  isAllBooksShown,
  hasActiveFilters,
  selectAllChecked,
  onSelectAllChange,
  onBulkTagManage,
  onToggleFavoritesFilter,
  isFavoritesFilterActive,
  onDeleteSelected
}) => {
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const mobileSortDropdownRef = useRef<HTMLDivElement>(null);
  const desktopSortDropdownRef = useRef<HTMLDivElement>(null);
  
  // Sort options mapping
  const sortOptions: Record<SortKey, string> = {
    addedDate: '추가순',
    title: '제목순',
    author: '저자순',
    pubDate: '출간일순',
    rating: '별점순',
    readStatus: '읽음순'
  };

  const getCurrentSortName = () => {
    return sortOptions[sortConfig.key] || '정렬';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        mobileSortDropdownRef.current && !mobileSortDropdownRef.current.contains(target) &&
        desktopSortDropdownRef.current && !desktopSortDropdownRef.current.contains(target)
      ) {
        setSortDropdownOpen(false);
      }
    };

    if (sortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sortDropdownOpen]);


  return (
    <div className="mb-6 space-y-3 max-w-4xl mx-auto">
      {/* First Row: Search + View Controls */}
      <div className="flex justify-between items-center gap-3">
        <div className="relative flex-1 sm:flex-initial">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="제목, 저자명으로 내 서재를 검색하세요"
            className="input-base block w-full sm:w-80 pl-3 pr-10 py-2 text-sm"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <SearchIcon className="h-4 w-4 text-tertiary" />
          </div>
          {searchQuery && (
            <button onClick={() => onSearchQueryChange('')} className="absolute inset-y-0 right-0 pr-9 flex items-center" title="검색어 지우기">
              <CloseIcon className="h-4 w-4 text-tertiary hover:text-primary" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-tertiary rounded-lg p-1 flex-shrink-0">
          <button onClick={() => onViewTypeChange('card')} className={`p-2 rounded transition-colors duration-200 ${viewType === 'card' ? 'bg-blue-600 text-white' : 'text-tertiary hover:text-primary hover-surface'}`} title="카드 보기">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zM3 8a1 1 0 000 2h14a1 1 0 100-2H3zM3 12a1 1 0 100 2h14a1 1 0 100-2H3z" clipRule="evenodd" /></svg>
          </button>
          <button onClick={() => onViewTypeChange('grid')} className={`p-2 rounded transition-colors duration-200 ${viewType === 'grid' ? 'bg-blue-600 text-white' : 'text-tertiary hover:text-primary hover-surface'}`} title="그리드 보기">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </button>
        </div>
      </div>

      {/* Second Row: Tag Filter */}
      <TagFilter tags={availableTags} activeTags={activeTags} onTagClick={onTagClick} onClearAll={onClearAllTags} />

      {/* Third Row: Responsive Layout */}
      <div className="space-y-3 md:space-y-0">
        {/* Mobile: First Row */}
        <div className="flex justify-between items-center md:hidden">
          <span className="text-sm text-secondary font-medium">
            총 {hasActiveFilters ? filteredBookCount : totalBookCount}권
            {!isAllBooksShown && !hasActiveFilters && totalBookCount > displayedBookCount ? ` (${displayedBookCount}권 표시)` : ''}
          </span>
          <div className="relative" ref={mobileSortDropdownRef}>
            <button onClick={() => setSortDropdownOpen(!sortDropdownOpen)} className="flex items-center gap-2 px-3 py-2 bg-tertiary text-primary rounded-lg hover-surface transition-colors duration-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <span>{getCurrentSortName()}</span>
              <svg className={`w-4 h-4 transition-transform duration-200 ${sortDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {sortDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-36 bg-elevated border border-secondary rounded-lg shadow-xl z-20 animate-in fade-in duration-200">
                {(Object.entries(sortOptions) as [SortKey, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => { onSortChange(key); setSortDropdownOpen(false); }} className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${sortConfig.key === key ? 'bg-blue-600 text-white' : 'text-primary hover-surface hover:text-primary focus-surface'}`}>
                    <span className="flex items-center justify-between">{label}{sortConfig.key === key && <SortArrow order={sortConfig.order} />}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Second Row */}
        <div className="flex justify-between items-center md:hidden">
          <div className="flex items-center gap-3">
            <label className="flex items-center">
              <input type="checkbox" checked={selectAllChecked} onChange={(e) => onSelectAllChange(e.target.checked)} className="w-4 h-4 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500" title="전체 선택" />
            </label>
            <span className="text-sm text-secondary">{selectedBookCount}권 선택</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onBulkTagManage} disabled={selectedBookCount === 0} className="p-1 btn-base btn-primary rounded-lg" title="선택된 책에 태그 관리"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg></button>
            <button onClick={onToggleFavoritesFilter} className="p-1 btn-base btn-primary rounded-lg transition-colors duration-200" title={isFavoritesFilterActive ? "전체 책 보기" : "좋아하는 책만 보기"}><HeartIcon className={`w-5 h-5 transition-colors duration-200 ${isFavoritesFilterActive ? 'text-red-500 fill-red-500' : 'text-[#131729] fill-[#131729]'}`} /></button>
            <button onClick={onDeleteSelected} disabled={selectedBookCount === 0} className="p-1 btn-base btn-primary rounded-lg" title="선택된 책 삭제"><TrashIcon className="w-5 h-5 text-[#131729]" /></button>
          </div>
        </div>

        {/* Desktop: Single Row Layout */}
        <div className="hidden md:flex justify-between items-center">
          <div className="flex items-center gap-3">
            <label className="flex items-center">
              <input type="checkbox" checked={selectAllChecked} onChange={(e) => onSelectAllChange(e.target.checked)} className="w-5 h-5 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500" title="전체 선택" />
            </label>
            <span className="text-sm text-secondary">{selectedBookCount}개 선택(총 {hasActiveFilters ? filteredBookCount : totalBookCount}권{!isAllBooksShown && !hasActiveFilters && totalBookCount > displayedBookCount ? ` 중 ${displayedBookCount}권 표시` : ''})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={desktopSortDropdownRef}>
              <button onClick={() => setSortDropdownOpen(!sortDropdownOpen)} className="flex items-center gap-2 px-3 py-2 bg-tertiary text-primary rounded-lg hover-surface transition-colors duration-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <span>{getCurrentSortName()}</span>
                <svg className={`w-4 h-4 transition-transform duration-200 ${sortDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {sortDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-36 bg-elevated border border-secondary rounded-lg shadow-xl z-20 animate-in fade-in duration-200">
                  {(Object.entries(sortOptions) as [SortKey, string][]).map(([key, label]) => (
                    <button key={key} onClick={() => { onSortChange(key); setSortDropdownOpen(false); }} className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${sortConfig.key === key ? 'bg-blue-600 text-white' : 'text-primary hover-surface hover:text-primary focus-surface'}`}>
                      <span className="flex items-center justify-between">{label}{sortConfig.key === key && <SortArrow order={sortConfig.order} />}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onBulkTagManage} disabled={selectedBookCount === 0} className="p-1 btn-base btn-primary rounded-lg" title="선택된 책에 태그 관리"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg></button>
            <button onClick={onToggleFavoritesFilter} className="p-1 btn-base btn-primary rounded-lg transition-colors duration-200" title={isFavoritesFilterActive ? "전체 책 보기" : "좋아하는 책만 보기"}><HeartIcon className={`w-4 h-4 transition-colors duration-200 ${isFavoritesFilterActive ? 'text-red-500 fill-red-500' : 'text-[#131729] fill-[#131729]'}`} /></button>
            <button onClick={onDeleteSelected} disabled={selectedBookCount === 0} className="p-1 btn-base btn-primary rounded-lg" title="선택된 책 삭제"><TrashIcon className="w-4 h-4 text-[#131729]" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyLibraryToolbar;
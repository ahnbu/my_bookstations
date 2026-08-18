// components/DemoLibrary.tsx
//
// 로그인 전 방문자에게 보여주는 읽기 전용 예시 서재다.
// 데이터는 data/demoLibrary.json 정적 스냅샷이며 네트워크 요청을 하지 않는다.
//
// 검색·정렬·태그 필터·좋아요 필터·뷰 전환은 로컬 state와 배열 연산으로 실제 동작한다.
// 선택·일괄 태그·삭제와 카드의 편집 동작은 로그인 안내로 연결한다.
//
// MyLibraryListItem과 MyLibraryToolbar는 스토어를 직접 호출하지 않고 props 콜백만 쓰므로,
// 여기서 넘기는 안내용 콜백만으로 읽기 전용이 보장된다.

import React from 'react';
import { SelectedBook, SortKey, ViewType } from '../types';
import MyLibraryListItem from './MyLibraryListItem';
import MyLibraryToolbar from './MyLibraryToolbar';
import BookListContainer from './BookListContainer';
import { useGridColumns } from '../hooks/useGridColumns';
import { createSortComparator } from '../utils/librarySort';
import { useUIStore } from '../stores/useUIStore';
import { DEMO_BOOKS, DEMO_TAGS } from '../data/demoLibrary';

const DemoLibrary: React.FC = () => {
  const setNotification = useUIStore(state => state.setNotification);
  const openAuthModal = useUIStore(state => state.openAuthModal);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; order: 'asc' | 'desc' }>({
    key: 'addedDate',
    order: 'desc',
  });
  const [activeTags, setActiveTags] = React.useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);
  const [viewType, setViewType] = React.useState<ViewType>('card');
  const gridColumns = useGridColumns();

  const notifyLoginNeeded = React.useCallback(() => {
    setNotification({
      message: '예시 화면입니다. 로그인하면 내 서재에서 직접 사용할 수 있어요.',
      type: 'info',
    });
  }, [setNotification]);

  // 전체 20권 기준 정적 카운트. 검색·필터를 적용해도 변하지 않는다(MyLibrary와 같은 의미).
  const tagCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    DEMO_BOOKS.forEach(book => {
      (book.customTags ?? []).forEach(tagId => {
        counts[tagId] = (counts[tagId] || 0) + 1;
      });
    });
    return counts;
  }, []);

  const filteredBooks = React.useMemo(() => {
    let books: SelectedBook[] = [...DEMO_BOOKS];

    // 검색은 MyLibrary와 같이 2자 이상일 때만 적용한다
    const query = searchQuery.trim().toLowerCase();
    if (query.length >= 2) {
      books = books.filter(book =>
        book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query)
      );
    }

    // 태그 필터는 AND 조건 (MyLibrary의 get_books_by_tags RPC 계약과 동일)
    if (activeTags.size > 0) {
      const requiredTagIds: string[] = Array.from(activeTags);
      books = books.filter(book => {
        const bookTags = new Set<string>(book.customTags ?? []);
        return requiredTagIds.every(tagId => bookTags.has(tagId));
      });
    }

    if (showFavoritesOnly) {
      books = books.filter(book => book.isFavorite === true);
    }

    // 정렬 비교자 정본은 utils/librarySort.ts다. MyLibrary와 같은 함수를 쓴다.
    return books.sort(createSortComparator(sortConfig));
  }, [searchQuery, activeTags, showFavoritesOnly, sortConfig]);

  const hasActiveFilters = searchQuery.trim().length >= 2 || activeTags.size > 0 || showFavoritesOnly;

  const handleTagClick = React.useCallback((tagId: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const handleSortChange = React.useCallback((key: SortKey) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key === 'addedDate' || key === 'rating' || key === 'pubDate' ? 'desc' : 'asc' }
    );
  }, []);

  const handleClearFilters = React.useCallback(() => {
    setSearchQuery('');
    setActiveTags(new Set());
    setShowFavoritesOnly(false);
  }, []);

  return (
    <div className="mt-12 animate-fade-in" data-testid="demo-library">
      {/* 안내 문구는 여기 두지 않는다. 메타 안내는 DemoModeBanner(App.tsx 최상단)가 담당한다. */}
      <MyLibraryToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        viewType={viewType}
        onViewTypeChange={setViewType}
        availableTags={DEMO_TAGS}
        activeTags={activeTags}
        onTagClick={handleTagClick}
        onClearAllTags={() => setActiveTags(new Set())}
        tagCountsOverride={tagCounts}
        sortConfig={sortConfig}
        onSortChange={handleSortChange}
        selectedBookCount={0}
        filteredBookCount={filteredBooks.length}
        totalBookCount={DEMO_BOOKS.length}
        displayedBookCount={filteredBooks.length}
        isAllBooksShown={true}
        hasActiveFilters={hasActiveFilters}
        selectAllChecked={false}
        onSelectAllChange={notifyLoginNeeded}
        onBulkTagManage={notifyLoginNeeded}
        onToggleFavoritesFilter={() => setShowFavoritesOnly(prev => !prev)}
        isFavoritesFilterActive={showFavoritesOnly}
        onDeleteSelected={notifyLoginNeeded}
      />

      {filteredBooks.length === 0 ? (
        <div className="mt-8 text-center text-secondary p-8 bg-elevated rounded-lg">
          <h3 className="text-lg font-medium mb-2 text-primary">조건에 맞는 책이 없습니다</h3>
          <p className="text-sm mb-4">검색어나 필터를 바꿔보세요.</p>
          <button onClick={handleClearFilters} className="btn-base btn-secondary">
            필터 초기화
          </button>
        </div>
      ) : (
        <BookListContainer viewType={viewType} gridColumns={gridColumns} data-testid="demo-book-list">
          {filteredBooks.map(book => (
            <MyLibraryListItem
              key={book.id}
              book={{ ...book, isSelected: false }}
              viewType={viewType}
              refreshingIsbn={null}
              refreshingEbookId={null}
              tagCounts={tagCounts}
              editingNoteId={null}
              noteInputValue=""
              tagsOverride={DEMO_TAGS}
              onSelect={notifyLoginNeeded}
              onRefresh={notifyLoginNeeded}
              onOpenDetail={notifyLoginNeeded}
              onToggleFavorite={notifyLoginNeeded}
              onUpdateReadStatus={notifyLoginNeeded}
              onUpdateRating={notifyLoginNeeded}
              onNoteEdit={notifyLoginNeeded}
              onNoteSave={notifyLoginNeeded}
              onNoteCancel={notifyLoginNeeded}
              onNoteChange={notifyLoginNeeded}
              onNoteKeyDown={notifyLoginNeeded}
            />
          ))}
        </BookListContainer>
      )}

      <div className="mt-8 text-center">
        <button
          onClick={() => openAuthModal('signup')}
          className="btn-base btn-primary px-6"
        >
          로그인하고 내 서재 만들기
        </button>
      </div>
    </div>
  );
};

export default DemoLibrary;

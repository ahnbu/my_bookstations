// components/DemoLibrary.tsx
//
// 로그인 전 방문자에게 보여주는 읽기 전용 예시 서재다.
// 데이터는 data/demoLibrary.json 정적 스냅샷이며 네트워크 요청을 하지 않는다.
// MyLibraryListItem은 스토어를 직접 호출하지 않고 props 콜백만 사용하므로,
// 여기서 넘기는 안내용 콜백만으로 읽기 전용이 보장된다.

import React from 'react';
import MyLibraryListItem from './MyLibraryListItem';
import { useUIStore } from '../stores/useUIStore';
import { DEMO_BOOKS, DEMO_TAGS, DEMO_SNAPSHOT_DATE } from '../data/demoLibrary';

const DemoLibrary: React.FC = () => {
  const setNotification = useUIStore(state => state.setNotification);
  const openAuthModal = useUIStore(state => state.openAuthModal);

  const notifyLoginNeeded = React.useCallback(() => {
    setNotification({
      message: '예시 화면입니다. 로그인하면 내 서재에서 직접 사용할 수 있어요.',
      type: 'info',
    });
  }, [setNotification]);

  // 데모 카드의 모든 상호작용은 로그인 안내로 연결한다.
  const noop = React.useCallback(() => {
    notifyLoginNeeded();
  }, [notifyLoginNeeded]);

  return (
    <div className="mt-12 animate-fade-in" data-testid="demo-library">
      <div className="mb-6 p-4 bg-elevated rounded-lg">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="text-2xl font-bold text-primary">내 서재 미리보기</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary whitespace-nowrap">
            예시 서재 · {DEMO_SNAPSHOT_DATE} 기준
          </span>
        </div>
        <p className="text-sm text-secondary">
          위 검색창에서 책을 찾아 '내 서재에 추가'를 누르면, 아래처럼 광주시 도서관과 전자도서관의 재고를 한눈에 볼 수 있습니다.
        </p>
      </div>

      <div className="space-y-4 max-w-4xl mx-auto">
        {DEMO_BOOKS.map(book => (
          <div key={book.id} data-testid="demo-book-card">
          <MyLibraryListItem
            book={{ ...book, isSelected: false }}
            viewType="card"
            refreshingIsbn={null}
            refreshingEbookId={null}
            tagCounts={{}}
            editingNoteId={null}
            noteInputValue=""
            tagsOverride={DEMO_TAGS}
            onSelect={noop}
            onRefresh={noop}
            onOpenDetail={noop}
            onToggleFavorite={noop}
            onUpdateReadStatus={noop}
            onUpdateRating={noop}
            onNoteEdit={noop}
            onNoteSave={noop}
            onNoteCancel={noop}
            onNoteChange={noop}
            onNoteKeyDown={noop}
          />
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => openAuthModal('signup')}
          className="btn-base btn-primary px-6"
        >
          로그인하고 내 서재 만들기
        </button>
        <p className="text-xs text-secondary mt-3">
          위 목록은 예시이며, 재고는 {DEMO_SNAPSHOT_DATE} 기준입니다.
        </p>
      </div>
    </div>
  );
};

export default DemoLibrary;

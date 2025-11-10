// src/components/MyLibraryListItem.tsx

import React from 'react';
import { SelectedBook, ViewType, ReadStatus, CustomTag, TagColor } from '../types';
import { useSettingsStore } from '../stores/useSettingsStore'; // settings를 직접 가져오도록 수정
import { RefreshIcon, HeartIcon, MessageSquareIcon, CheckIcon } from './Icons';
import Spinner from './Spinner';
import StarRating from './StarRating';
import CustomTagComponent from './CustomTag';
import { createLibraryOpenURL } from '../services/unifiedLibrary.service';

// MyLibrary.tsx에 있던 로컬 컴포넌트들을 여기로 이동
// 1. ReadStatusDropdown
interface CustomReadStatusDropdownProps {
  value: ReadStatus;
  onChange: (newStatus: ReadStatus) => void;
  size?: 'sm' | 'md';
}

const ReadStatusDropdown: React.FC<CustomReadStatusDropdownProps> = ({ value, onChange, size = 'md' }) => {
  // ... MyLibrary.tsx에 있던 ReadStatusDropdown 코드 전체를 여기에 붙여넣기 ...
  // (이 컴포넌트는 MyLibraryListItem 내부에서만 사용됩니다)
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const options: ReadStatus[] = ['읽지 않음', '읽는 중', '완독'];

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
  };

  const widthClass = size === 'sm' 
    ? 'w-full sm:w-24'
    : '';

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${widthClass}`}>
      <button
        type="button"
        className={`${size === 'sm' ? 'item-dropdown-btn' : 'input-base'} inline-flex ${size === 'sm' ? 'items-center gap-2' : 'w-full justify-between items-center gap-x-1.5'} ${sizeClasses[size]}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {value}
        <svg className={`-mr-1 h-5 w-5 text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-full origin-top-right rounded-md bg-elevated shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {options.map((option) => (
              <button key={option} onClick={() => { onChange(option); setIsOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${option === value ? 'bg-accent text-primary' : 'text-secondary hover-surface'}`}>
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 2. LibraryTag
interface LibraryTagProps {
  name: string;
  totalBooks: number;
  availableBooks: number;
  searchUrl: string;
  size?: 'sm' | 'md';
  isError?: boolean;
}
const LibraryTag: React.FC<LibraryTagProps> = ({ name, totalBooks, availableBooks, searchUrl, size = 'md', isError = false }) => {
  // const getStatus = () => {
  //   if (isError) return 'unavailable';
  //   if (totalBooks > 0) return 'available';
  //   return 'none';
  // };

  // const status = getStatus();
  // const titleText = isError 
  //   ? `${name} - 정보 조회 실패 (표시된 정보는 과거 데이터일 수 있음)` 
  //   : `${name} - 총 ${totalBooks}권 (availableCount: ${availableBooks}권)`;
  // const displayText = `${name} (${totalBooks}/${availableBooks})`;

  // isError를 무시하고 오직 재고 수량으로만 상태 결정
  const getStatus = () => {
    if (totalBooks > 0) return 'available';
    return 'none';
  };
  const status = getStatus();
  const titleText = `${name} - 총 ${totalBooks}권 (대출가능: ${availableBooks}권)`;
  const displayText = `${name} (${totalBooks}/${availableBooks})`;

  return (
    <a href={searchUrl} target="_blank" rel="noopener noreferrer" className={`library-tag ${size === 'sm' ? 'library-tag-sm' : ''} status-${status} truncate`} title={titleText}>
      <div className={`status-indicator ${status}`}></div>
      <span>{displayText}</span>
    </a>
  );

  // return (
  //   <a href={searchUrl} target="_blank" rel="noopener noreferrer" className={`library-tag ${size === 'sm' ? 'library-tag-sm' : ''} status-${status} truncate`} title={titleText}>
  //     <div className={`status-indicator ${status}`}></div>
  //     <span>{displayText}</span>
  //   </a>
  // );
};

const LibraryTagsGroup: React.FC<{ book: SelectedBook }> = React.memo(({ book }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <LibraryTag name="퇴촌"
                totalBooks={book.stock_gwangju_toechon_total ?? 0}
                availableBooks={book.stock_gwangju_toechon_available ?? 0}
                searchUrl={createLibraryOpenURL("퇴촌", book.title, book.customSearchTitle)}
                // isError={!book.gwangjuPaperInfo || ('error' in book.gwangjuPaperInfo)} />
                isError={!!book.gwangjuPaperInfo && 'error' in book.gwangjuPaperInfo} />

            <LibraryTag name="기타"
                totalBooks={book.stock_gwangju_other_total ?? 0}
                availableBooks={book.stock_gwangju_other_available ?? 0}
                searchUrl={createLibraryOpenURL("기타", book.title, book.customSearchTitle)}
                // isError={!book.gwangjuPaperInfo || ('error' in book.gwangjuPaperInfo)} />
                isError={!!book.gwangjuPaperInfo && 'error' in book.gwangjuPaperInfo} />

            <LibraryTag name="e시립구독"
                totalBooks={book.stock_sirip_subs_total ?? 0}
                availableBooks={book.stock_sirip_subs_available ?? 0}
                searchUrl={createLibraryOpenURL("e시립구독", book.title, book.customSearchTitle)}
                // isError={!book.siripEbookInfo || !!book.siripEbookInfo.errors?.subscription} />
                isError={!!book.siripEbookInfo && !!book.siripEbookInfo.errors?.subscription} />

            <LibraryTag name="e시립소장"
                totalBooks={book.stock_sirip_owned_total ?? 0}
                availableBooks={book.stock_sirip_owned_available ?? 0}
                searchUrl={createLibraryOpenURL("e시립소장", book.title, book.customSearchTitle)}
                // isError={!book.siripEbookInfo || !!book.siripEbookInfo.errors?.owned} />
                isError={!!book.siripEbookInfo && !!book.siripEbookInfo.errors?.owned} />
                
            <LibraryTag name="e경기"
                totalBooks={book.stock_gyeonggi_total ?? 0}
                availableBooks={book.stock_gyeonggi_available ?? 0}
                searchUrl={createLibraryOpenURL("e경기", book.title, book.customSearchTitle)}
                // isError={!book.gyeonggiEbookInfo || ('error' in book.gyeonggiEbookInfo)} />
                isError={!!book.gyeonggiEbookInfo && 'error' in book.gyeonggiEbookInfo} />
            
            <LibraryTag name="e교육"
                totalBooks={book.stock_gyeonggi_edu_total ?? 0}
                availableBooks={book.stock_gyeonggi_edu_available ?? 0}
                searchUrl={createLibraryOpenURL("e교육", book.title, book.customSearchTitle)}
                // isError={!book.gyeonggiEduEbookInfo || (book.gyeonggiEduEbookInfo.errorCount ?? 0) > 0} />
                isError={!!book.gyeonggiEduEbookInfo && (book.gyeonggiEduEbookInfo.errorCount ?? 0) > 0} />

        </div>
    );
});

interface MyLibraryListItemProps {
  book: SelectedBook & { isSelected: boolean };
  viewType: ViewType;
  refreshingIsbn: string | null;
  refreshingEbookId: number | null;
  tagCounts: Record<string, number>;
  editingNoteId: number | null;
  noteInputValue: string;
  
  // Event Handlers
  onSelect: (bookId: number, isSelected: boolean) => void;
  onRefresh: (id: number, isbn13: string, title: string, author: string) => void;
  onOpenDetail: (bookId: number) => void;
  onToggleFavorite: (bookId: number) => void;
  onUpdateReadStatus: (bookId: number, status: ReadStatus) => void;
  onUpdateRating: (bookId: number, rating: number) => void;
  onNoteEdit: (bookId: number, currentNote?: string) => void;
  onNoteSave: (bookId: number) => void;
  onNoteCancel: () => void;
  onNoteChange: (value: string) => void;
  onNoteKeyDown: (e: React.KeyboardEvent, bookId: number) => void;
}

const MyLibraryListItem: React.FC<MyLibraryListItemProps> = React.memo(({
  book,
  viewType,
  refreshingIsbn,
  refreshingEbookId,
  tagCounts,
  editingNoteId,
  noteInputValue,
  onSelect,
  onRefresh,
  onOpenDetail,
  onToggleFavorite,
  onUpdateReadStatus,
  onUpdateRating,
  onNoteEdit,
  onNoteSave,
  onNoteCancel,
  onNoteChange,
  onNoteKeyDown,
}) => {
  const { settings } = useSettingsStore();
  const gridColumns = 4; // 그리드 컬럼 수는 MyLibrary에서 관리하므로, 여기서는 임의의 값을 사용하거나 props로 받아야 합니다.
                         // 이 컴포넌트에서는 gridColumns 값이 레이아웃에 직접 영향을 주지 않으므로 상수로 두어도 괜찮습니다.

  if (viewType === 'card') {
    // MyLibrary.tsx의 카드 뷰 렌더링 JSX
    return (
      <div className="flex items-start gap-4 p-4 mb-4 bg-elevated rounded-lg">
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={book.isSelected}
            onChange={(e) => onSelect(book.id, e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col flex-shrink-0 w-24">
          <div className="relative">
            <img
              src={book.cover}
              alt={book.title}
              className="w-full max-h-full object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onOpenDetail(book.id)}
              title="상세 정보 보기"
            />
            {settings.showFavorites && (
              <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(book.id); }} className="absolute top-1 left-1 p-1 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all duration-200" title={book.isFavorite ? "좋아요 취소" : "좋아요"}>
                <HeartIcon className={`w-4 h-4 transition-colors duration-200 ${book.isFavorite ? 'text-red-500 fill-red-500' : 'text-white hover:text-red-300'}`} />
              </button>
            )}
          </div>
          <div className="flex gap-1 mt-2">
            {(() => {
              const isEbookResult = book.mallType === 'EBOOK';
              const paperBookLink = isEbookResult ? book.subInfo?.paperBookList?.[0]?.link || null : book.link;
              const ebookLink = isEbookResult ? book.link : book.subInfo?.ebookList?.[0]?.link || null;
              const hasBothFormats = paperBookLink && ebookLink;
              const buttonClass = hasBothFormats ? "flex-1 px-1 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors text-center whitespace-nowrap" : "w-full px-2 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors text-center";
              return (
                <>
                  {paperBookLink && <a href={paperBookLink} target="_blank" rel="noopener noreferrer" className={buttonClass}>종이책</a>}
                  {ebookLink && <a href={ebookLink} target="_blank" rel="noopener noreferrer" className={buttonClass}>전자책</a>}
                </>
              );
            })()}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <h2 className="text-lg font-bold text-primary leading-tight flex-1 pr-2 cursor-pointer hover:text-blue-400 transition-colors whitespace-nowrap overflow-hidden text-ellipsis" onClick={() => onOpenDetail(book.id)} title={book.title.replace(/^\[\w+\]\s*/, '')}>
                {book.title.replace(/^\[\w+\]\s*/, '')}
              </h2>
              <button onClick={() => onRefresh(book.id, book.isbn13, book.title, book.author)} disabled={refreshingIsbn === book.isbn13 || refreshingEbookId === book.id} className="flex-shrink-0 p-1 text-tertiary hover:text-primary hover-surface rounded transition-colors disabled:opacity-50 disabled:cursor-wait" title="재고 정보 갱신">
                {refreshingIsbn === book.isbn13 || refreshingEbookId === book.id ? <Spinner /> : <RefreshIcon className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-sm text-secondary">{book.author.replace(/\s*\([^)]*\)/g, '').split(',')[0]} | {book.pubDate.substring(0, 7).replace('-', '년 ')}월</p>
            <div className="flex items-center gap-4 flex-wrap">
              {settings.showReadStatus && <ReadStatusDropdown value={book.readStatus} onChange={(newStatus) => onUpdateReadStatus(book.id, newStatus)} size="sm" />}
              {settings.showRating && <StarRating rating={book.rating} onRatingChange={(newRating) => onUpdateRating(book.id, newRating)} size="md" />}
            </div>
            {settings.showTags && book.customTags && book.customTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {book.customTags.map(tagId => settings.tagSettings.tags.find(t => t.id === tagId)).filter((tag): tag is CustomTag => !!tag).sort((a, b) => { const colorOrder: Record<TagColor, number> = { 'primary': 0, 'secondary': 1, 'tertiary': 2 }; const colorDifference = (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99); if (colorDifference !== 0) return colorDifference; const countA = tagCounts[a.id] || 0; const countB = tagCounts[b.id] || 0; const countDifference = countB - countA; if (countDifference !== 0) return countDifference; return a.name.localeCompare(b.name, 'ko-KR'); }).map(tag => <CustomTagComponent key={tag.id} tag={tag} isActive={false} onClick={() => {}} size="sm" />)}
              </div>
            )}
          </div>
          {settings.showLibraryStock && <hr className="my-3 border-secondary" />}

          {/* 도서관 재고 정보 */}
          {settings.showLibraryStock && <LibraryTagsGroup book={book} />}

          {settings.showBookNotes && book.note && (
            <div className="mt-3 pt-3 border-t border-secondary">
              {editingNoteId === book.id ? (
                <div className="flex items-center gap-2">
                  <MessageSquareIcon className="w-4 h-4 text-secondary flex-shrink-0" />
                  <input type="text" value={noteInputValue} onChange={(e) => onNoteChange(e.target.value)} onKeyDown={(e) => onNoteKeyDown(e, book.id)} onBlur={() => onNoteSave(book.id)} maxLength={50} placeholder="메모를 입력하세요..." className="flex-1 px-2 py-1 text-xs bg-tertiary border border-secondary rounded text-primary focus:ring-1 focus:ring-blue-500 focus:border-blue-500" autoFocus />
                  <button onClick={() => onNoteSave(book.id)} className="p-1 text-secondary hover:text-green-500 transition-colors" title="저장"><CheckIcon className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MessageSquareIcon className="w-4 h-4 text-secondary flex-shrink-0" />
                  <span className="flex-1 text-xs text-secondary truncate cursor-pointer hover:text-primary" onClick={() => onNoteEdit(book.id, book.note || '')} title={book.note || '메모를 추가하려면 클릭하세요'}>{book.note || '메모'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 그리드 뷰 렌더링 JSX
  return (
    <div className="bg-elevated rounded-lg p-3 relative min-w-0">
      <div className="absolute top-2 left-2 z-20 p-1 -m-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={book.isSelected}
          onChange={(e) => { e.stopPropagation(); onSelect(book.id, e.target.checked); }}
          className="w-4 h-4 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500 cursor-pointer relative z-20"
        />
      </div>
      {settings.showFavorites && (
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(book.id); }} className="absolute top-2 right-2 z-20 p-1 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all duration-200" title={book.isFavorite ? "좋아요 취소" : "좋아요"}>
          <HeartIcon className={`w-4 h-4 transition-colors duration-200 ${book.isFavorite ? 'text-red-500 fill-red-500' : 'text-white hover:text-red-300'}`} />
        </button>
      )}
      <div className="text-center mb-3">
        <img
          src={book.cover}
          alt={book.title}
          className="w-full h-40 object-contain rounded mb-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onOpenDetail(book.id)}
          title="상세 정보 보기"
        />
        <div className="flex gap-1 justify-center">
          <a href={book.link} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors">종이책</a>
          {book.subInfo?.ebookList?.[0]?.isbn13 && (
            <a href={book.subInfo.ebookList[0].link} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors">전자책</a>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-start gap-1">
          <h3 className="text-sm font-bold text-primary line-clamp-2 flex-1">
            <span className="cursor-pointer hover:text-blue-400 transition-colors" onClick={() => onOpenDetail(book.id)} title={book.title}>{book.title.replace(/^\[\w+\]\s*/, '')}</span>
          </h3>
          <button onClick={() => onRefresh(book.id, book.isbn13, book.title, book.author)} disabled={refreshingIsbn === book.isbn13 || refreshingEbookId === book.id} className="flex-shrink-0 p-0.5 text-tertiary hover:text-primary hover-surface rounded transition-colors disabled:opacity-50 disabled:cursor-wait" title="재고 정보 갱신">
            {refreshingIsbn === book.isbn13 || refreshingEbookId === book.id ? (<div className="w-3 h-3 flex items-center justify-center"><Spinner /></div>) : (<RefreshIcon className="w-3 h-3" />)}
          </button>
        </div>
        <p className="text-xs text-secondary truncate">{book.author.replace(/\s*\([^)]*\)/g, '').split(',')[0]}</p>
        <p className="text-xs text-secondary">{book.pubDate.substring(0, 7).replace('-', '년 ')}월</p>
        {settings.showRating && (<div className="flex justify-start"><StarRating rating={book.rating} onRatingChange={(newRating) => onUpdateRating(book.id, newRating)} size="md" /></div>)}
        {settings.showReadStatus && (<ReadStatusDropdown value={book.readStatus} onChange={(newStatus) => onUpdateReadStatus(book.id, newStatus)} size="sm" />)}
        {settings.showTags && book.customTags && book.customTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {book.customTags.map(tagId => settings.tagSettings.tags.find(t => t.id === tagId)).filter((tag): tag is CustomTag => !!tag).sort((a, b) => { const colorOrder: Record<TagColor, number> = { 'primary': 0, 'secondary': 1, 'tertiary': 2 }; const colorDifference = (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99); if (colorDifference !== 0) return colorDifference; const countA = tagCounts[a.id] || 0; const countB = tagCounts[b.id] || 0; const countDifference = countB - countA; if (countDifference !== 0) return countDifference; return a.name.localeCompare(b.name, 'ko-KR'); }).map(tag => <CustomTagComponent key={tag.id} tag={tag} isActive={false} onClick={() => {}} size="sm" />)}
          </div>
        )}
        {/* 도서관 재고 정보 */}
        {settings.showLibraryStock && <LibraryTagsGroup book={book} />}
        {settings.showBookNotes && book.note && (
          <div className="mt-2 pt-2 border-t border-secondary">
            {editingNoteId === book.id ? (
              <div className="flex items-center gap-1">
                <MessageSquareIcon className="w-3 h-3 text-secondary flex-shrink-0" />
                <input type="text" value={noteInputValue} onChange={(e) => onNoteChange(e.target.value)} onKeyDown={(e) => onNoteKeyDown(e, book.id)} onBlur={() => onNoteSave(book.id)} maxLength={50} placeholder="메모..." className="flex-1 px-1 py-0.5 text-xs bg-tertiary border border-secondary rounded text-primary focus:ring-1 focus:ring-blue-500 focus:border-blue-500" autoFocus />
                <button onClick={() => onNoteSave(book.id)} className="p-0.5 text-secondary hover:text-green-500 transition-colors" title="저장"><CheckIcon className="w-3 h-3" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <MessageSquareIcon className="w-3 h-3 text-secondary flex-shrink-0" />
                <span className="flex-1 text-xs text-secondary truncate cursor-pointer hover:text-primary" onClick={() => onNoteEdit(book.id, book.note || '')} title={book.note || '메모를 추가하려면 클릭하세요'}>{book.note || '메모...'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default MyLibraryListItem;
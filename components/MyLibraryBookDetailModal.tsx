
// import React, { useEffect, useState, useCallback} from 'react';
import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { ReadStatus, StockInfo, CustomTag, SelectedBook,  GwangjuPaperResult, GwangjuPaperError, GyeonggiEbookResult, TagColor
} from '../types';
import { useBookStore } from '../stores/useBookStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useUIStore } from '../stores/useUIStore'; // [추가]
import { CloseIcon, RefreshIcon, BookOpenIcon, MessageSquareIcon, EditIcon, SaveIcon, TrashIcon } from './Icons';
import Spinner from './Spinner';
import StarRating from './StarRating';
import CustomTagComponent from './CustomTag';
import AuthorButtons from './AuthorButtons';
import { createOptimalSearchTitle, createLibraryOpenURL, fetchBookAvailability} from '../services/unifiedLibrary.service';
import { searchAladinBooks } from '../services/aladin.service';
import { combineRawApiResults } from '../utils/bookDataCombiner';

// 제목 가공 함수 (3단어, 괄호 등 제거 후)
const createSearchSubject = createOptimalSearchTitle;


interface MyLibraryBookDetailModalProps {
  bookId: number;
  onClose: () => void;
}

// [추가] ✅ 재사용 가능한 재고 표시 컴포넌트
// =======================================================
interface StockDisplayProps {
  label: string;
  searchUrl: string;
  totalCount?: number;
  availableCount?: number;
  hasError?: boolean;
  isLoading?: boolean;
}

const StockDisplay: React.FC<StockDisplayProps> = ({
  label,
  searchUrl,
  totalCount, // ✅ 기본값 제거
  availableCount, // ✅ 기본값 제거
  hasError, // ✅ 기본값 제거
  // isLoading = false // ⛔️ 이 prop은 더 이상 받지 않음
}) => {
  // ✅ [핵심 수정] 컴포넌트 내부에서 로딩 상태를 직접 판단합니다.
  // totalCount가 undefined이고, 에러도 없는 상태를 "로딩 중"으로 간주합니다.
  const isLoading = totalCount === undefined && !hasError;

  // 로딩 상태 처리
  if (isLoading) {
    return (
      <div className="flex justify-between items-center">
        <span>{label}:</span>
        <span className="text-tertiary">조회중...</span>
      </div>
    );
  }

  // --- 👇 이하 로직은 totalCount와 availableCount에 기본값을 부여하여 안전하게 실행 ---
  const finalTotalCount = totalCount ?? 0;
  const finalAvailableCount = availableCount ?? 0;

  // 1. 상태 이름 결정 (로직 중앙화)
  type StockStatus = 'available' | 'unavailable' | 'none';
  
  const getStatus = (): StockStatus => {
    if (hasError) return 'unavailable';     // 에러 상태 (빨간색)
    if (availableCount > 0) return 'available'; // 재고 있음 상태 (녹색)
    return 'none';                          // 재고 없음 상태 (회색)
  };
  
  const status: StockStatus = getStatus();

  // 2. 상태 이름에 따른 Tailwind 텍스트 색상 클래스 매핑
  const statusColorClassMap: Record<StockStatus, string> = {
    available: 'text-green-400',
    unavailable: 'text-red-400',
    none: 'text-gray-400', // 또는 text-secondary 등 원하는 회색 계열
  };
  const textColorClass = statusColorClassMap[status];

  // const titleText = `총 ${totalCount}권, 대출가능 ${availableCount}권${hasError ? ' - 현재 정보 갱신 실패' : ''}`;
  const titleText = `총 ${finalTotalCount}권, 대출가능 ${finalAvailableCount}권${hasError ? ' - 현재 정보 갱신 실패' : ''}`;

  return (
    <div className="flex justify-between items-center">
      <span>{label}:</span>
      <div className="flex items-center gap-2">
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          // 3. 매핑된 텍스트 색상 클래스를 적용
          className={`font-medium ${textColorClass} hover:text-blue-400`}
          title={titleText}
        >
          {totalCount} / {availableCount}
        </a>
        {hasError && <span className="font-medium text-red-400" title="정보 갱신 실패">(에러)</span>}
      </div>
    </div>
  );
};

// =======================================================
// 1. LibraryStockSection 컴포넌트 독립적으로 분리
// =======================================================
interface LibraryStockSectionProps {
  book: SelectedBook;
  onApiButtonClick: () => void; // [추가]
  isFetchingJson: boolean; // [추가]
}

// const LibraryStockSection: React.FC<LibraryStockSectionProps> = ({ book }) => {
const LibraryStockSection: React.FC<LibraryStockSectionProps> = ({ book, onApiButtonClick, isFetchingJson }) => {
    const { 
        refreshBookInfo: refreshAllBookInfo, 
        refreshingIsbn, 
        refreshingEbookId,
        updateCustomSearchTitle
    } = useBookStore();

    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(book.customSearchTitle || '');

    useEffect(() => {
        setValue(book.customSearchTitle || '');
    }, [book.customSearchTitle]);

    const handleEdit = () => {
        // 편집 시작 시, input의 초기값을 설정
        // 커스텀 검색어가 있으면 그것을, 없으면 기본 검색어를 사용
        setValue(book.customSearchTitle || createSearchSubject(book.title));
        setIsEditing(true);
    };
    
    const handleCancel = () => {
        setValue(book.customSearchTitle || '');
        setIsEditing(false);
    };
    const handleSave = async () => {
        await updateCustomSearchTitle(book.id, value);
        setIsEditing(false);
    };
    const handleDelete = async () => {
        await updateCustomSearchTitle(book.id, '');
        setValue('');
        setIsEditing(false);
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };
    
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-semibold text-primary">도서관 재고</h4>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onApiButtonClick}
                        disabled={isFetchingJson}
                        className="px-3 py-1.5 text-xs font-semibold bg-tertiary text-secondary rounded-md hover:bg-secondary disabled:opacity-50"
                        title="DB에 저장된 최신 API 응답 결과 보기"
                    >
                        {isFetchingJson ? <Spinner size="sm" /> : 'API'}
                    </button>
                    <button
                        onClick={() => refreshAllBookInfo(book.id, book.isbn13, book.title, book.author)}
                        disabled={refreshingIsbn === book.isbn13 || refreshingEbookId === book.id}
                        className="p-2 text-secondary hover:text-primary rounded-full hover-surface transition-colors disabled:opacity-50 disabled:cursor-wait"
                        title="모든 재고 정보 새로고침"
                    >
                        {(refreshingIsbn === book.isbn13 || refreshingEbookId === book.id) ? <Spinner /> : <RefreshIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* 커스텀 검색어 UI */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-secondary">커스텀 검색어</label>
                    <div className="flex items-center gap-2">
                        {!isEditing && (
                            <button onClick={handleEdit} className="p-1.5 text-secondary hover:text-primary rounded-md hover:bg-tertiary transition-colors" title="커스텀 검색어 편집">
                                <EditIcon className="w-4 h-4" />
                            </button>
                        )}
                        {book.customSearchTitle && !isEditing && (
                            <button onClick={handleDelete} className="p-1.5 text-secondary hover:text-red-500 rounded-md hover:bg-tertiary transition-colors" title="커스텀 검색어 삭제">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
                {isEditing ? (
                    <div className="space-y-3">
                        <div className="relative">
                            <input type="text" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="" className="w-full px-3 py-2 text-sm bg-tertiary border border-secondary rounded-md text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500" autoFocus />
                            {/* <div className="absolute top-full left-0 text-xs text-tertiary mt-1">Ctrl+Enter: 저장, Esc: 취소</div> */}
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"><SaveIcon className="w-4 h-4" />저장</button>
                            <button onClick={handleCancel} className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"><CloseIcon className="w-4 h-4" />취소</button>
                        </div>
                    </div>
                ) : (
                    <div className="min-h-[44px] p-3 bg-tertiary border border-secondary rounded-md">
                        {book.customSearchTitle ? (
                            <div className="flex items-start gap-2 cursor-pointer hover:bg-opacity-80 rounded p-1 -m-1 transition-colors" onClick={handleEdit} title="커스텀 검색어를 입력하세요(Ctrl+Enter: 저장, Esc: 취소)">
                                <p className="text-sm text-primary leading-relaxed break-words">{book.customSearchTitle}</p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-tertiary cursor-pointer hover:text-secondary transition-colors rounded p-1 -m-1" onClick={handleEdit} title="기본 검색어가 정확하지 않을 경우, 클릭하여 직접 지정하세요">
                                <span className="text-sm">{createSearchSubject(book.title)}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 실제 재고 표시 UI */}
              {/* [수정] ✅ 실제 재고 표시 UI를 StockDisplay 컴포넌트로 교체 */}
            <div className="space-y-2 text-sm text-secondary bg-elevated p-4 rounded-md">
                <StockDisplay
                    label="퇴촌"
                    searchUrl={createLibraryOpenURL('퇴촌', book.title, book.customSearchTitle)}
                    // totalCount={book.toechonStock?.total_count}
                    // availableCount={book.toechonStock?.available_count}
                    // undefined를 전달하는 이유는 StockDisplay 컴포넌트가 undefined 값을 "로딩 중" 상태로 해석하도록 개선되었기 때문입니다. 이는 조회중... 무한 반복 버그를 해결한 좋은 로직
                    totalCount={book.gwangjuPaperInfo && 'total_count_toechon' in book.gwangjuPaperInfo ? book.gwangjuPaperInfo.total_count_toechon : undefined}
                    availableCount={book.gwangjuPaperInfo && 'available_count_toechon' in book.gwangjuPaperInfo ? book.gwangjuPaperInfo.available_count_toechon : undefined}
                    hasError={book.gwangjuPaperInfo ? 'error' in book.gwangjuPaperInfo : false}
                    // isLoading={!book.toechonStock && !book.gwangjuPaperInfo}
                />
                <StockDisplay
                    label="기타"
                    searchUrl={createLibraryOpenURL('기타', book.title, book.customSearchTitle)}
                    // totalCount={book.otherStock?.total_count}
                    // availableCount={book.otherStock?.available_count}
                    totalCount={book.gwangjuPaperInfo && 'total_count_other' in book.gwangjuPaperInfo ? book.gwangjuPaperInfo.total_count_other : undefined}
                    availableCount={book.gwangjuPaperInfo && 'available_count_other' in book.gwangjuPaperInfo ? book.gwangjuPaperInfo.available_count_other : undefined}
                    hasError={book.gwangjuPaperInfo ? 'error' in book.gwangjuPaperInfo : false}
                    // isLoading={!book.otherStock && !book.gwangjuPaperInfo}
                />
                <StockDisplay
                    label="전자책(교육)"
                    searchUrl={createLibraryOpenURL('e교육', book.title, book.customSearchTitle)}
                    totalCount={book.GyeonggiEduEbookInfo?.total_count_summary}
                    availableCount={book.GyeonggiEduEbookInfo?.available_count_summary}
                    hasError={(book.GyeonggiEduEbookInfo?.error_count ?? 0) > 0}
                    // isLoading={!book.GyeonggiEduEbookInfo}
                />
                <StockDisplay
                    label="전자책(시립구독)"
                    searchUrl={createLibraryOpenURL('e시립구독', book.title, book.customSearchTitle)}
                    totalCount={book.siripEbookInfo?.details?.subscription?.total_count}
                    availableCount={book.siripEbookInfo?.details?.subscription?.available_count}
                    hasError={book.siripEbookInfo ? ('error' in book.siripEbookInfo || !!book.siripEbookInfo.details?.subscription?.error) : false}
                    // isLoading={!book.siripEbookInfo}
                />
                <StockDisplay
                    label="전자책(시립소장)"
                    searchUrl={createLibraryOpenURL('e시립소장', book.title, book.customSearchTitle)}
                    totalCount={book.siripEbookInfo?.details?.owned?.total_count}
                    availableCount={book.siripEbookInfo?.details?.owned?.available_count}
                    hasError={book.siripEbookInfo ? ('error' in book.siripEbookInfo || !!book.siripEbookInfo.details?.owned?.error) : false}
                    // isLoading={!book.siripEbookInfo}
                />
                <StockDisplay
                    label="전자책(경기)"
                    searchUrl={createLibraryOpenURL('e경기', book.title, book.customSearchTitle)}
                    totalCount={book.gyeonggiEbookInfo && !('error' in book.gyeonggiEbookInfo) ? book.gyeonggiEbookInfo.total_count_summary : undefined}
                    availableCount={book.gyeonggiEbookInfo && !('error' in book.gyeonggiEbookInfo) ? book.gyeonggiEbookInfo.available_count_summary : undefined}
                    hasError={book.gyeonggiEbookInfo ? 'error' in book.gyeonggiEbookInfo : false}
                />
            </div>

            {/* 시간 정보 UI - 시간 정보 있을 때만, 없으면 NaN이 아니라 빈값 제시*/}
            {book.lastUpdated && ( // ✅ book.lastUpdated를 직접 확인
                <div className="text-xs text-tertiary pt-2 mt-2 text-right">
                    {formatDate(book.lastUpdated)} 기준
                </div>
            )}
        </div>
    );
};

// 도서관 재고 외 상세 모달
const MyLibraryBookDetailModal: React.FC<MyLibraryBookDetailModalProps> = ({ bookId, onClose }) => {

    const { openJsonViewerModal } = useUIStore();
    const { getBookById, updateReadStatus, updateRating, refreshingIsbn, refreshingEbookId, refreshBookInfo: refreshAllBookInfo, addTagToBook, removeTagFromBook, setAuthorFilter, updateBookNote, updateCustomSearchTitle, fetchRawBookData} = useBookStore();

    // [핵심 1] useBookStore에서 업데이트된 책 정보를 실시간으로 구독합니다.
    const updatedBookFromStore = useBookStore(state => {
        const allBooks = [...state.myLibraryBooks, ...state.librarySearchResults, ...state.libraryTagFilterResults];
        // 중복 ID가 있을 경우 최신 정보가 담긴 객체를 사용하기 위해 Map을 사용
        return Array.from(new Map(allBooks.map(b => [b.id, b])).values()).find(b => b.id === bookId);
    });
    
    const { settings } = useSettingsStore();

    // [수정] book 상태를 로컬 state로 관리
    const [book, setBook] = useState<SelectedBook | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // [추가] ✅ JSON 뷰어 모달 관련 상태를 부모로 이동
    const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
    const [rawBookData, setRawBookData] = useState<object | null>(null);
    const [isFetchingJson, setIsFetchingJson] = useState(false);

    // ✅ 1. 스크롤 컨테이너와 위치 저장을 위한 Ref 생성
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<number>(0);

    // ✅ API 버튼 - Supabase DB 조회 방식
    const handleApiButtonClick = async () => {
      if (!book) return;
      setIsFetchingJson(true);
      try {
        // 1. useBookStore의 fetchRawBookData를 호출하여 DB에서 데이터를 가져옵니다.
        const data = await fetchRawBookData(book.id);
        
        // 2. 가져온 데이터를 JsonViewerModal로 전달합니다.
        if (data) {
          // ✅ [신규] 여기서 키 순서를 재정렬합니다.
          // 1. 원하는 최상위 키 순서를 배열로 정의합니다. (네트워크 탭 기준)
          const desiredKeyOrder = [
            'title', 'author', 'isbn13', 'pubDate', 'publisher', 'link', 'cover', 
            'priceStandard', 'priceSales', 'description', 'subInfo', 'mallType','lastUpdated',
            'addedDate', 'readStatus', 'rating', 'isFavorite', 'customTags', 'customSearchTitle',
            'gwangjuPaperInfo', 
            'GyeonggiEduEbookInfo', 
            'gyeonggiEbookInfo', 
            'siripEbookInfo',
          ];

          // 2. 원하는 순서대로 새로운 객체를 생성합니다.
          const reorderedData: { [key: string]: any } = {};
          const dataKeys = new Set(Object.keys(data));

          // 원하는 순서의 키부터 reorderedData에 추가
          desiredKeyOrder.forEach(key => {
            if (dataKeys.has(key)) {
              reorderedData[key] = data[key as keyof typeof data];
              dataKeys.delete(key);
            }
          });

          // 나머지 키들을 (알파벳 순으로) 추가하여 데이터 누락 방지
          Array.from(dataKeys).sort().forEach(key => {
            reorderedData[key] = data[key as keyof typeof data];
          });

          // 3. 순서가 재정렬된 객체를 JSON 뷰어 모달로 전달합니다.
          openJsonViewerModal(reorderedData, `[API] ${book.title}`);
          // ✅ 제목에 [DB] 프리픽스를 붙여 데이터 출처를 명확히 합니다.
          // openJsonViewerModal(data, `[API] ${book.title}`);
        } else {
          // 데이터가 없는 경우를 처리합니다.
          openJsonViewerModal({ error: "DB에서 저장된 API 데이터를 찾을 수 없습니다." }, `[DB] ${book.title}`);
        }
      } catch (error) {
        console.error("DB 원본 데이터 조회 실패:", error);
        const errorData = { error: error instanceof Error ? error.message : String(error) };
        openJsonViewerModal(errorData, `[DB 조회 실패] ${book.title}`);
      } finally {
        setIsFetchingJson(false);
      }
    };

    // [수정] bookId가 변경될 때마다 데이터 가져옴
    useEffect(() => {
        const fetchBook = async () => {
            setIsLoading(true);
            const fetchedBook = await getBookById(bookId);
            setBook(fetchedBook);
            setIsLoading(false);
            if (!fetchedBook) {
                // 책을 못 찾으면 모달 닫기
                onClose();
            }
        };

        // bookId가 유효할 때만 fetch 실행
        if (bookId) {
            fetchBook();
        }
    }, [bookId, getBookById, onClose]);

    // [핵심 2] 스토어의 데이터 변경을 로컬 상태에 동기화하는 useEffect
    useEffect(() => {
        // updatedBookFromStore가 존재하고, 현재 로컬 book 상태와 다를 경우 업데이트
        if (updatedBookFromStore && book !== updatedBookFromStore) {
            setBook(updatedBookFromStore);
        }
    }, [updatedBookFromStore, book]);

    // ✅ 3. 'book' 상태가 변경되어 리렌더링된 후, 저장된 스크롤 위치로 복원
    useLayoutEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollPositionRef.current;
        }
    }, [book]); // 'book'이 변경될 때마다 이 효과를 실행

    // ==================
    // 메모 기능 Start 
    // ==================
    
    // 메모 편집 상태 관리
    const [editingNote, setEditingNote] = useState(false);
    const [noteValue, setNoteValue] = useState('');
    
    // 태그 추가삭제 낙관적 UI를 위한 상태 및 콜백 함수
    // const [processingTags, setProcessingTags] = useState<Set<string>>(new Set());

        // ================================================================
    // ✅ [추가 시작] 태그 추가/삭제(CRUD)를 위한 상태 및 핸들러
    // ================================================================
    const [processingTags, setProcessingTags] = useState<Set<string>>(new Set());

    // --- 태그 추가(Create) 핸들러 ---
    const handleAddTag = useCallback(async (tagId: string) => {
      // ✅ 2. 상태 업데이트 직전에 현재 스크롤 위치를 저장
      if (scrollContainerRef.current) {
        scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      }

      // book 데이터가 없거나 이미 처리 중이면 중복 실행 방지
      if (!book || processingTags.has(tagId)) return;

      // 1. 즉시 UI를 '처리 중' 상태로 변경 (Optimistic UI)
      setProcessingTags(prev => new Set(prev).add(tagId));
      try {
        // 2. 실제 데이터베이스 작업 요청
        await addTagToBook(book.id, tagId);
      } catch (error) {
        console.error("태그 추가 실패:", error);
        // 필요하다면 여기서 사용자에게 에러 알림
      } finally {
        // 3. 작업 완료 후 '처리 중' 상태 해제
        setProcessingTags(prev => {
          const next = new Set(prev);
          next.delete(tagId);
          return next;
        });
      }
    }, [book, addTagToBook, processingTags]);

    // --- 태그 삭제(Delete) 핸들러 ---
    const handleRemoveTag = useCallback(async (tagId: string) => {
      // ✅ 2. 상태 업데이트 직전에 현재 스크롤 위치를 저장
      if (scrollContainerRef.current) {
        scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      }
      // book 데이터가 없거나 이미 처리 중이면 중복 실행 방지
      if (!book || processingTags.has(tagId)) return;
      
      // 1. 즉시 UI를 '처리 중' 상태로 변경 (Optimistic UI)
      setProcessingTags(prev => new Set(prev).add(tagId));
      try {
        // 2. 실제 데이터베이스 작업 요청
        await removeTagFromBook(book.id, tagId);
      } catch (error) {
        console.error("태그 제거 실패:", error);
      } finally {
        // 3. 작업 완료 후 '처리 중' 상태 해제
        setProcessingTags(prev => {
          const next = new Set(prev);
          next.delete(tagId);
          return next;
        });
      }
    }, [book, removeTagFromBook, processingTags]);
    // ================================================================
    // ✅ [추가 끝]
    // ================================================================

    // 메모 값 초기화
    useEffect(() => {
        if (book) {
            setNoteValue(book.note || '');
        }
    }, [book]);

    if (!book) return null; // Render nothing while closing or if book not found

    const handleAuthorClick = (authorName: string) => {
        if (!book) return; // [추가] book 객체 null 체크
        if (!authorName) return;
        // 현재 모달 닫기
        onClose();
        // MyLibrary에서 저자로 필터링
        setAuthorFilter(authorName);
    };

    // 메모 편집 시작
    const handleNoteEdit = () => {
        if (!book) return; // [추가] book 객체 null 체크
        setEditingNote(true);
    };

    // 메모 저장
    const handleNoteSave = async () => {
        if (!book) return; // [추가] book 객체 null 체크
        try {
            await updateBookNote(book.id, noteValue);
            setEditingNote(false);
        } catch (error) {
            console.error('메모 저장 실패:', error);
        }
    };

    // 메모 편집 취소
    const handleNoteCancel = () => {
        if (!book) return; // [추가] book 객체 null 체크
        setNoteValue(book.note || '');
        setEditingNote(false);
    };

    // 메모 삭제
    const handleNoteDelete = async () => {
        if (!book) return; // [추가] book 객체 null 체크
        try {
            await updateBookNote(book.id, '');
            setNoteValue('');
            setEditingNote(false);
        } catch (error) {
            console.error('메모 삭제 실패:', error);
        }
    };

    // 키보드 이벤트 처리
    const handleNoteKeyDown = (e: React.KeyboardEvent) => {
        if (!book) return; // [추가] book 객체 null 체크
        if (e.key === 'Enter' && e.ctrlKey) {
            handleNoteSave();
        } else if (e.key === 'Escape') {
            handleNoteCancel();
        }
    };

    // =======================================================
    // [추가] 로딩 및 Null 체크 UI
    // =======================================================
    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
                <div className="bg-elevated rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-fade-in">
                    <div className="flex justify-center items-center h-96">
                        <Spinner />
                    </div>
                </div>
            </div>
        );
    }

    if (!book) {
        // 책을 찾지 못했거나 에러가 발생한 경우, 아무것도 렌더링하지 않음 (useEffect에서 onClose가 호출됨)
        return null; 
    }

    // [수정] ✅ mallType을 기준으로 종이책/전자책 링크를 정확히 할당
    const isEbookResult = book.mallType === 'EBOOK';

    const paperBookLink = isEbookResult
    ? book.subInfo?.paperBookList?.[0]?.link || null
    : book.link;
    
    const ebookLink = isEbookResult
    ? book.link
    : book.subInfo?.ebookList?.[0]?.link || null;

    // 레이아웃 로직 변수 정의
    // const hasEbookLink = book.subInfo?.ebookList?.[0]?.link; // ⛔️ 이 줄 삭제 또는 주석 처리
    const hasLeftContent = settings.showRating || settings.showReadStatus || settings.showTags || settings.showBookNotes;
    const hasRightContent = settings.showLibraryStock;
    const isLibraryStockOnly = !hasLeftContent && hasRightContent;

    // [추가] 재고 표시 로직을 별도의 컴포넌트로 추출
    // 리팩토링 : 재고정보 코드가 1단표시, 2단표시 중복 표시 해결

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-elevated rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-fade-in">
                <div className="flex justify-between items-center p-4 border-b border-primary">
                  <h2 className="text-xl font-bold text-primary truncate pr-8">도서 상세 정보</h2>
                  <button onClick={onClose} className="absolute top-4 right-4 text-secondary hover:text-primary">
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>
                
                {/* <div className="p-6 overflow-y-auto"> */}
                <div ref={scrollContainerRef} className="p-6 overflow-y-auto">
                    {/* [복원] 도서 상세 정보 블록 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 flex justify-center items-start">
                        <img src={book.cover.replace('coversum', 'cover')} alt={book.title} className="w-48 h-auto object-cover rounded-lg shadow-lg" />
                        </div>
                        <div className="md:col-span-2 text-secondary">
                        <h3 className="text-2xl font-bold text-primary mb-2 line-clamp-2">{book.title}</h3>
                        <p className="text-lg text-secondary mb-1">
                            <strong>저자:</strong>{' '}
                            <AuthorButtons
                            authorString={book.author}
                            onAuthorClick={handleAuthorClick}
                            isFetchingJson={isFetchingJson}
                            className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                            />
                        </p>
                        <p className="text-md text-tertiary mb-1"><strong>출판사:</strong> {book.publisher}</p>
                        <p className="text-md text-tertiary mb-1"><strong>출간일:</strong> {book.pubDate}</p>
                        <p className="text-md text-tertiary mb-1"><strong>ISBN:</strong> {book.isbn13}</p>
                        {book.subInfo?.ebookList?.[0]?.isbn13 && (
                            <p className="text-md text-tertiary mb-4"><strong>ISBN:</strong> {book.subInfo.ebookList[0].isbn13} (전자책)</p>
                        )}
                        
                        <div className="flex items-baseline mb-4">
                            <p className="text-2xl font-bold text-blue-400">{book.priceSales.toLocaleString()}원</p>
                            <p className="text-md text-tertiary line-through ml-3">{book.priceStandard.toLocaleString()}원</p>
                        </div>

                        <p className="text-sm text-tertiary leading-relaxed mb-6 line-clamp-4">{book.description || "제공된 설명이 없습니다."}</p>

                        <div className="flex flex-wrap gap-4">
                            {/* [수정] ✅ '알라딘 보기'(종이책) 버튼 로직 */}
                            {paperBookLink && (
                            <a
                                href={paperBookLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-300"
                            >
                                <BookOpenIcon className="w-5 h-5" />
                                알라딘 보기
                            </a>
                            )}
                            
                            {/* [수정] ✅ '전자책 보기' 버튼 로직 */}
                            <a
                            href={ebookLink || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => !ebookLink && e.preventDefault()}
                            className={`inline-flex items-center justify-center gap-2 px-5 py-2 bg-sky-500 text-white font-semibold rounded-lg transition-colors duration-300 ${
                                !ebookLink ? 'opacity-50 cursor-not-allowed' : 'hover:bg-sky-600'
                            }`}
                            title={!ebookLink ? "알라딘에서 제공하는 전자책 정보가 없습니다" : "알라딘에서 전자책 보기"}
                            >
                            <BookOpenIcon className="w-5 h-5" />
                            전자책 보기
                            </a>
                        </div>

                        </div>
                    </div>
                
                    {/* 리팩토링 : 재고정보 1단표시, 2단표시 중복 해결*/}                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-secondary rounded-lg p-6">
                        
                        {/* 왼쪽 컬럼: 일반 정보 (별점, 태그 등) */}
                        {hasLeftContent && (
                            <div className="space-y-6">
                                {/* 별정 관리 */}                                
                                {settings.showRating && (
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-2">나의 별점</label>
                                        <StarRating
                                            rating={book.rating}
                                            onRatingChange={(newRating) => updateRating(book.id, newRating)}
                                        />
                                    </div>
                                )}
                                {/* 읽음 상태 관리 */}                                
                                {settings.showReadStatus && (
                                    <div className="w-32">
                                        <label className="block text-sm font-medium text-secondary mb-2">읽음 상태</label>
                                        <select
                                            value={book.readStatus}
                                            onChange={(e) => updateReadStatus(book.id, e.target.value as ReadStatus)}
                                            className="input-base text-sm rounded-md block w-full p-2.5"
                                        >
                                            <option value="읽지 않음">읽지 않음</option>
                                            <option value="읽는 중">읽는 중</option>
                                            <option value="완독">완독</option>
                                        </select>
                                    </div>
                                )}

                                {/* 태그 관리 섹션 */}
                                {settings.showTags && (
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-3">선택된 태그</label>
                                        <div className="space-y-4">
                                          
                                            {/* ================================================================ */}
                                            {/* ✅ [수정 시작] 현재 등록된 태그 (Delete 기능) */}
                                            {/* ================================================================ */}
                                            <div className="flex flex-wrap gap-2">
                                                {book.customTags && book.customTags.length > 0 ? (
                                                    book.customTags
                                                        // 1. tagId 배열을 tag 객체 배열로 변환
                                                        .map(tagId => settings.tagSettings.tags.find(t => t.id === tagId))
                                                        // 2. 혹시 모를 null 값 제거
                                                        .filter((tag): tag is CustomTag => !!tag)
                                                        // ✅ 3. [추가] 일관된 정렬 로직 적용
                                                        .sort((a, b) => {
                                                            const colorOrder: Record<TagColor, number> = { 'primary': 0, 'secondary': 1, 'tertiary': 2 };
                                                            const colorDifference = (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99);
                                                            if (colorDifference !== 0) {
                                                                return colorDifference;
                                                            }
                                                            return a.name.localeCompare(b.name, 'ko-KR');
                                                        })
                                                        // 4. 정렬된 배열을 기반으로 렌더링
                                                        .map(tag => {
                                                            const isProcessing = processingTags.has(tag.id);
                                                            return (
                                                                <CustomTagComponent
                                                                    key={tag.id}
                                                                    tag={tag}
                                                                    showClose={true}
                                                                    size="sm"
                                                                    onClose={() => handleRemoveTag(tag.id)}
                                                                    className={isProcessing ? 'opacity-50 cursor-wait' : ''}
                                                                />
                                                            );
                                                        })
                                                ) : (
                                                    <span className="text-tertiary text-sm">선택된 태그가 없습니다</span>
                                                )}
                                            </div>
                                            {/* ================================================================ */}
                                            {/* ✅ [수정 시작] 추가 가능한 태그 (Create 기능) */}
                                            {/* ================================================================ */}
                                            {settings.tagSettings.tags.filter(tag => !book.customTags?.includes(tag.id)).length > 0 && (
                                                <>
                                                    <div className="text-sm text-secondary">사용 가능한 태그</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {settings.tagSettings.tags
                                                            .filter(tag => !book.customTags?.includes(tag.id))
                                                            // ✅ [추가] 여기에 일관된 정렬 로직을 삽입합니다.
                                                            .sort((a, b) => {
                                                                // 1차: 색상 우선순위
                                                                const colorOrder: Record<TagColor, number> = { 'primary': 0, 'secondary': 1, 'tertiary': 2 };
                                                                const colorDifference = (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99);
                                                                if (colorDifference !== 0) {
                                                                    return colorDifference;
                                                                }
                                                                // 2차: 색상이 같으면 이름 가나다순
                                                                return a.name.localeCompare(b.name, 'ko-KR');
                                                            })
                                                            .map(tag => {
                                                                // 처리 중인지 확인하여 UI에 즉시 반영
                                                                const isProcessing = processingTags.has(tag.id);
                                                                return (
                                                                    <CustomTagComponent
                                                                        key={tag.id}
                                                                        // tag={{...tag, color: 'secondary'}}
                                                                        tag={tag} // ✅ [수정] tag 객체를 그대로 전달하여 원래 색상을 사용하도록 합니다.
                                                                        showAdd={true}
                                                                        size="sm"
                                                                        onAdd={() => handleAddTag(tag.id)}
                                                                        className={isProcessing ? 'opacity-50 cursor-wait' : ''}
                                                                    />
                                                                )
                                                            })
                                                        }
                                                    </div>
                                                </>
                                            )}

                                        </div>
                                    </div>
                                )}

                                {/* 메모 관리 섹션 */}
                                {settings.showBookNotes && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="block text-sm font-medium text-secondary">메모</label>
                                            <div className="flex items-center gap-2">
                                                {!editingNote && (
                                                    <button
                                                        onClick={handleNoteEdit}
                                                        className="p-1.5 text-secondary hover:text-primary rounded-md hover:bg-tertiary transition-colors"
                                                        title="메모 편집 (또는 메모 영역 클릭)"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {book.note && !editingNote && (
                                                    <button
                                                        onClick={handleNoteDelete}
                                                        className="p-1.5 text-secondary hover:text-red-500 rounded-md hover:bg-tertiary transition-colors"
                                                        title="메모 삭제"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {editingNote ? (
                                            /* 편집 모드 */
                                            <div className="space-y-3">
                                                <div className="relative">
                                                    <textarea
                                                        value={noteValue}
                                                        onChange={(e) => setNoteValue(e.target.value)}
                                                        onKeyDown={handleNoteKeyDown}
                                                        maxLength={50}
                                                        placeholder="메모를 입력하세요... (Ctrl+Enter: 저장, Esc: 취소)"
                                                        className="w-full px-3 py-2 text-sm bg-tertiary border border-secondary rounded-md text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                                        rows={3}
                                                        autoFocus
                                                    />
                                                    <div className="absolute bottom-2 right-2 text-xs text-tertiary">
                                                        {noteValue.length}/50
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={handleNoteSave}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                                                    >
                                                        <SaveIcon className="w-4 h-4" />
                                                        저장
                                                    </button>
                                                    <button
                                                        onClick={handleNoteCancel}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
                                                    >
                                                        <CloseIcon className="w-4 h-4" />
                                                        취소
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* 표시 모드 */
                                            <div className="min-h-[60px] p-3 bg-tertiary border border-secondary rounded-md">
                                                {book.note ? (
                                                    <div
                                                        className="flex items-start gap-2 cursor-pointer hover:bg-opacity-80 rounded p-1 -m-1 transition-colors"
                                                        onClick={handleNoteEdit}
                                                        title="클릭하여 메모를 편집하세요"
                                                    >
                                                        <MessageSquareIcon className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                                                        <p className="text-sm text-primary leading-relaxed break-words">
                                                            {book.note}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="flex items-center gap-2 text-tertiary cursor-pointer hover:text-secondary transition-colors rounded p-1 -m-1"
                                                        onClick={handleNoteEdit}
                                                        title="클릭하여 메모를 추가하세요"
                                                    >
                                                        <MessageSquareIcon className="w-4 h-4" />
                                                        <span className="text-sm">클릭하여 메모를 추가하세요.</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 오른쪽 컬럼: 도서관 재고 정보 */}
                        {hasRightContent && (
                            <div className="space-y-6">
                                {/* <LibraryStockSection book={book} /> */}
                                {/* [수정] ✅ 자식 컴포넌트에 상태와 핸들러를 props로 전달 */}
                                <LibraryStockSection 
                                    book={book} 
                                    onApiButtonClick={handleApiButtonClick}
                                    isFetchingJson={isFetchingJson}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyLibraryBookDetailModal;

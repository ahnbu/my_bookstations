
import React, { useEffect, useState} from 'react';
import { ReadStatus, StockInfo, CustomTag, SelectedBook} from '../types';
import { useBookStore } from '../stores/useBookStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { CloseIcon, RefreshIcon, BookOpenIcon, MessageSquareIcon, EditIcon, SaveIcon, TrashIcon } from './Icons';
import Spinner from './Spinner';
import StarRating from './StarRating';
import CustomTagComponent from './CustomTag';
import AuthorButtons from './AuthorButtons';
import { 
  GwangjuPaperResult,
  GwangjuPaperError,
  GyeonggiEbookResult,
  createOptimalSearchTitle,
  createLibraryOpenURL
} from '../services/unifiedLibrary.service';

// 제목 가공 함수 (3단어, 괄호 등 제거 후)
const createSearchSubject = createOptimalSearchTitle;

interface MyLibraryBookDetailModalProps {
  bookId: number;
  onClose: () => void;
}

// =======================================================
// 1. LibraryStockSection 컴포넌트 독립적으로 분리
// =======================================================
interface LibraryStockSectionProps {
  book: SelectedBook;
}

const LibraryStockSection: React.FC<LibraryStockSectionProps> = ({ book }) => {
    const { 
        refreshAllBookInfo, 
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
                <button
                    onClick={() => refreshAllBookInfo(book.id, book.isbn13, book.title)}
                    disabled={refreshingIsbn === book.isbn13 || refreshingEbookId === book.id}
                    className="p-2 text-secondary hover:text-primary rounded-full hover-surface transition-colors disabled:opacity-50 disabled:cursor-wait"
                    title="모든 재고 정보 새로고침"
                >
                    {(refreshingIsbn === book.isbn13 || refreshingEbookId === book.id) ? <Spinner /> : <RefreshIcon className="w-5 h-5" />}
                </button>
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
            <div className="space-y-2 text-sm text-secondary bg-elevated p-4 rounded-md">
                {renderStockInfo('퇴촌', book.title, book.customSearchTitle, book.toechonStock, book.gwangjuPaperInfo)}
                {renderStockInfo('기타', book.title, book.customSearchTitle, book.otherStock, book.gwangjuPaperInfo)}
                
                <div className="flex justify-between items-center">
                    <span>전자책(교육):</span>
                    {(() => {
                        const info = book.ebookInfo;
                        const searchUrl = createLibraryOpenURL('e교육', book.title, book.customSearchTitle);
                        if (!info) return <span className="text-tertiary">정보없음</span>;
                        // const hasError = info.details.some(d => 'error' in d);
                        const hasError = (info.summary.error_count ?? 0) > 0;
                        const { total_count, available_count } = info.summary;
                        return (
                            <div className="flex items-center gap-2">
                                <a href={searchUrl} target="_blank" rel="noopener noreferrer" className={`font-medium ${available_count > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`} title={`총 ${total_count}권, 대출가능 ${available_count}권${hasError ? ' - 현재 정보 갱신 실패' : ''}`}>
                                    {total_count} / {available_count}
                                </a>
                                {hasError && <span className="font-medium text-red-400" title="정보 갱신 실패">(에러)</span>}
                            </div>
                        );
                    })()}
                </div>
                <div className="flex justify-between items-center">
                    <span>전자책(시립구독):</span>
                    {(() => {
                        const info = book.siripEbookInfo;
                        const searchUrl = createLibraryOpenURL('e시립구독', book.title, book.customSearchTitle);
                        if (!info) return <span className="text-tertiary">정보없음</span>;
                        const hasError = 'error' in info || !!info.details?.subscription?.error;
                        const total_count = info.details?.subscription?.total_count ?? 0;
                        const available_count = info.details?.subscription?.available_count ?? 0;
                        return (
                            <div className="flex items-center gap-2">
                                <a href={searchUrl} target="_blank" rel="noopener noreferrer" className={`font-medium ${available_count > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`} title={`총 ${total_count}권, 대출가능 ${available_count}권${hasError ? ' - 현재 정보 갱신 실패' : ''}`}>
                                    {total_count} / {available_count}
                                </a>
                                {hasError && <span className="font-medium text-red-400" title="정보 갱신 실패">(에러)</span>}
                            </div>
                        );
                    })()}
                </div>
                <div className="flex justify-between items-center">
                    <span>전자책(시립소장):</span>
                    {(() => {
                        const info = book.siripEbookInfo;
                        const searchUrl = createLibraryOpenURL('e시립소장', book.title, book.customSearchTitle);
                        if (!info) return <span className="text-tertiary">정보없음</span>;
                        const hasError = 'error' in info || !!info.details?.owned?.error;
                        const total_count = info.details?.owned?.total_count ?? 0;
                        const available_count = info.details?.owned?.available_count ?? 0;
                        return (
                            <div className="flex items-center gap-2">
                                <a href={searchUrl} target="_blank" rel="noopener noreferrer" className={`font-medium ${available_count > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`} title={`총 ${total_count}권, 대출가능 ${available_count}권${hasError ? ' - 현재 정보 갱신 실패' : ''}`}>
                                    {total_count} / {available_count}
                                </a>
                                {hasError && <span className="font-medium text-red-400" title="정보 갱신 실패">(에러)</span>}
                            </div>
                        );
                    })()}
                </div>
                <div className="flex justify-between items-center">
                    <span>전자책(경기):</span>
                    {(() => {
                        const info = book.gyeonggiEbookInfo;
                        const searchUrl = createLibraryOpenURL('e경기', book.title, book.customSearchTitle);
                        if (!info) {
                            return (
                                <button onClick={() => refreshAllBookInfo(book.id, book.isbn13, book.title)} className="font-medium text-blue-400 hover:text-blue-300" disabled={refreshingEbookId === book.id}>
                                    {refreshingEbookId === book.id ? '로딩...' : '조회'}
                                </button>
                            );
                        }
                        const hasError = 'error' in info;
                        const displayInfo = book.filteredGyeonggiEbookInfo || book.gyeonggiEbookInfo;
                        const { total_count, available_count } = (displayInfo && !('error' in displayInfo) ? displayInfo : {total_count: 0, available_count: 0});
                        return (
                            <div className="flex items-center gap-2">
                                <a href={searchUrl} target="_blank" rel="noopener noreferrer" className={`font-medium ${available_count > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`} title={`총 ${total_count}권, 대출가능 ${available_count}권${hasError ? ' - 현재 정보 갱신 실패' : ''}`}>
                                    {total_count} / {available_count}
                                </a>
                                {hasError && <span className="font-medium text-red-400" title="정보 갱신 실패">(에러)</span>}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* 시간 정보 UI */}
            {book.ebookInfo && (
                <div className="text-xs text-tertiary pt-2 mt-2 text-right">
                    {formatDate(book.ebookInfo.lastUpdated)} 기준
                </div>
            )}
        </div>
    );
};

    // // 기존 코드
    // const book = useBookStore(state => state.myLibraryBooks.find(b => b.id === bookId));
    // const { settings } = useSettingsStore();

    // // 모달 열린 상태에서 책이 삭제되면, 모달을 닫는다
    // useEffect(() => {
    //     if (!book) {
    //         onClose();
    //     }
    // }, [book, onClose]);

// 도서관 재고 표시
const renderStockInfo = (libraryName: '퇴촌' | '기타', bookTitle: string, customSearchTitle: string, stockInfo?: StockInfo, paperInfo?: GwangjuPaperResult | GwangjuPaperError) => {
    const subject = customSearchTitle || createSearchSubject(bookTitle);
    const searchUrl = createLibraryOpenURL(libraryName, bookTitle, customSearchTitle);    
    // const searchUrl = libraryName === '퇴촌 도서관'
    //     ? `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodeURIComponent(subject)}`
    //     : `https://lib.gjcity.go.kr/lay1/program/S1T446C461/jnet/resourcessearch/resultList.do?searchType=SIMPLE&searchKey=TITLE&searchLibrary=ALL&searchKeyword=${encodeURIComponent(subject)}`;
    
    // 1. 에러 상태 확인
    const hasError = paperInfo && 'error' in paperInfo;

    // 2. 정보가 아직 로드되지 않은 초기 상태
    if (!stockInfo && !paperInfo) {
        return (
            <div className="flex justify-between items-center">
                <span>{libraryName}:</span>
                <div className="flex items-center gap-2"><Spinner size="sm" /><span className="text-tertiary">확인중...</span></div>
            </div>
        );
    }
    
    // 3. 렌더링 (에러 여부와 관계없이 기존 데이터 기반)
    const total_count = stockInfo?.total_count ?? 0;
    const available_count = stockInfo?.available_count ?? 0;
    const statusColor = available_count > 0 ? 'text-green-400' : 'text-red-400';
    const statusText = available_count > 0 ? '대출가능' : '대출불가';

    return (
        <div className="flex justify-between items-center">
            <span>{libraryName}:</span>
            <div className="flex items-center gap-2">
                <a
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`font-medium ${statusColor} hover:text-blue-400 hover:underline cursor-pointer transition-colors`}
                    title={`${libraryName}에서 '${subject}' 검색 | ${statusText} (총 ${total_count}권, 대출가능 ${available_count}권)${hasError ? ' - 현재 정보 갱신 실패' : ''}`}
                >
                    {total_count} / {available_count}
                </a>
                {/* 에러가 있을 때만 (에러) 텍스트 추가 */}
                {hasError && <span className="font-medium text-red-400" title="정보 갱신에 실패했습니다. 표시된 정보는 과거 데이터일 수 있습니다.">(에러)</span>}
            </div>
        </div>
    );
};

// 도서관 재고 외 상세 모달
const MyLibraryBookDetailModal: React.FC<MyLibraryBookDetailModalProps> = ({ bookId, onClose }) => {
    const { getBookById, updateReadStatus, updateRating, refreshingIsbn, refreshEBookInfo, refreshingEbookId, refreshAllBookInfo, addTagToBook, removeTagFromBook, setAuthorFilter, updateBookNote,updateCustomSearchTitle} = useBookStore();

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


    // [수정] bookId가 변경될 때마다 데이터를 가져오는 useEffect
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

    
    // ==================
    // 메모 기능 Start 
    // ==================
    
    // 메모 편집 상태 관리
    const [editingNote, setEditingNote] = useState(false);
    const [noteValue, setNoteValue] = useState('');

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

    // 레이아웃 로직 변수 정의
    const hasEbookLink = book.subInfo?.ebookList?.[0]?.link;
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
                
                <div className="p-6 overflow-y-auto">
                    {/* [복원] 도서 상세 정보 블록 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 flex justify-center items-start">
                        <img src={book.cover.replace('coversum', 'cover')} alt={book.title} className="w-48 h-auto object-cover rounded-lg shadow-lg" />
                        </div>
                        <div className="md:col-span-2 text-secondary">
                        <h3 className="text-2xl font-bold text-primary mb-2">{book.title}</h3>
                        <p className="text-lg text-secondary mb-1">
                            <strong>저자:</strong>{' '}
                            <AuthorButtons
                            authorString={book.author}
                            onAuthorClick={handleAuthorClick}
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
                            <a
                            href={book.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-300"
                            >
                            <BookOpenIcon className="w-5 h-5" />
                            알라딘 보기
                            </a>
                            <a
                            href={hasEbookLink || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => !hasEbookLink && e.preventDefault()}
                            className={`inline-flex items-center justify-center gap-2 px-5 py-2 bg-sky-500 text-white font-semibold rounded-lg transition-colors duration-300 ${
                                !hasEbookLink ? 'opacity-50 cursor-not-allowed' : 'hover:bg-sky-600'
                            }`}
                            title={!hasEbookLink ? "알라딘에서 제공하는 전자책 정보가 없습니다" : "알라딘에서 전자책 보기"}
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
                                            {/* 현재 등록된 태그들 (primary 색상, X 버튼) */}
                                            <div className="flex flex-wrap gap-2">
                                                {book.customTags && book.customTags.length > 0 ? (
                                                    book.customTags.map(tagId => {
                                                        const tag = settings.tagSettings.tags.find(t => t.id === tagId);
                                                        return tag ? (
                                                            <CustomTagComponent
                                                                key={tag.id}
                                                                tag={{...tag, color: 'primary'}}
                                                                showClose={true}
                                                                onClose={() => removeTagFromBook(book.id, tag.id)}
                                                                size="sm"
                                                            />
                                                        ) : null;
                                                    })
                                                ) : (
                                                    <span className="text-tertiary text-sm">선택된 태그가 없습니다</span>
                                                )}
                                            </div>

                                            {/* 추가 가능한 태그들 (secondary 색상, + 버튼) */}
                                            {settings.tagSettings.tags.filter(tag => !book.customTags?.includes(tag.id)).length > 0 && (
                                                <>
                                                    <div className="text-sm text-secondary">사용 가능한 태그</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {settings.tagSettings.tags
                                                            .filter(tag => !book.customTags?.includes(tag.id))
                                                            .map(tag => (
                                                                <CustomTagComponent
                                                                    key={tag.id}
                                                                    tag={{...tag, color: 'secondary'}}
                                                                    showAdd={true}
                                                                    onAdd={() => addTagToBook(book.id, tag.id)}
                                                                    size="sm"
                                                                />
                                                            ))
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
                                <LibraryStockSection book={book} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyLibraryBookDetailModal;

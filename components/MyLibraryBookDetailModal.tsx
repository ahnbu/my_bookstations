
import React, { useEffect, useState } from 'react';
import { ReadStatus, StockInfo, CustomTag } from '../types';
import { useBookStore } from '../stores/useBookStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { CloseIcon, RefreshIcon, BookOpenIcon, MessageSquareIcon, EditIcon, SaveIcon, TrashIcon } from './Icons';
import Spinner from './Spinner';
import StarRating from './StarRating';
import CustomTagComponent from './CustomTag';
import AuthorButtons from './AuthorButtons';
import { getStatusClass, getStatusEmoji, processGyeonggiEbookEduTitle, processGyeonggiEbookTitle, createGyeonggiEbookSearchURL, generateLibraryDetailURL, isLibraryStockClickable } from '../services/unifiedLibrary.service';
import { filterGyeonggiEbookByIsbn } from '../utils/isbnMatcher';

// Use the standardized title processing function from ebook.service
const createSearchSubject = processGyeonggiEbookEduTitle;

interface MyLibraryBookDetailModalProps {
  bookId: number;
  onClose: () => void;
}

// 도서관 재고

// const renderStockInfo = (libraryName: string, stock?: StockInfo, bookTitle: string, detailedStockInfo?: any) => {
//     if (typeof stock === 'undefined') {
//         return <div className="flex justify-between items-center"><span>{libraryName}:</span> <div className="flex items-center gap-2"><Spinner /><span className="text-tertiary">확인중...</span></div></div>;
//     }
//     if (!stock) {
//         return <div className="flex justify-between items-center"><span>{libraryName}:</span> <span className="text-tertiary">정보 없음</span></div>;
//     }
//     const { total, available } = stock;
//     const statusColor = available > 0 ? 'text-green-400' : 'text-red-400';
//     const statusText = available > 0 ? '대출가능' : '대출불가';
    
//     const subject = createSearchSubject(bookTitle);
//     let searchUrl = '';
//     let searchTitle = '';
    
//     // 퇴촌도서관의 경우 상세 재고 정보에서 URL 파라미터 확인
//     if (libraryName === '퇴촌 도서관' && detailedStockInfo?.gwangju_paper?.availability) {
//         const toechonItem = detailedStockInfo.gwangju_paper.availability.find((item: any) => 
//             item.소장도서관 === '퇴촌도서관' && 
//             item.recKey && 
//             item.bookKey && 
//             item.publishFormCode
//         );
        
//         if (toechonItem) {
//             searchUrl = generateLibraryDetailURL(toechonItem.recKey, toechonItem.bookKey, toechonItem.publishFormCode);
//             searchTitle = `퇴촌도서관 상세 페이지로 이동`;
//             // console.log('MyLibraryBookDetailModal 퇴촌도서관 상세 URL 생성:', searchUrl); // 성능 개선을 위해 주석 처리
//         } else {
//             // 파라미터가 없으면 향상된 검색 URL 사용 (제목 + 저자)
//             const authorName = bookTitle.includes(' - ') ? '' : ` ${bookTitle.split(' by ')[1] || ''}`.trim();
//             const enhancedKeyword = authorName ? `${subject} ${authorName}` : subject;
//             searchUrl = `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodeURIComponent(enhancedKeyword)}`;
//             searchTitle = `퇴촌 도서관에서 '${enhancedKeyword}' 검색`;
//             // console.log('MyLibraryBookDetailModal 퇴촌도서관 URL 파라미터 없음, 향상된 검색 URL 사용:', enhancedKeyword); // 성능 개선을 위해 주석 처리
//         }
//     } else if (libraryName === '기타 도서관') {
//         searchUrl = `https://lib.gjcity.go.kr/lay1/program/S1T446C461/jnet/resourcessearch/resultList.do?searchType=SIMPLE&searchKey=TITLE&searchLibrary=ALL&searchKeyword=${encodeURIComponent(subject)}`;
//         searchTitle = `광주시립도서관에서 '${subject}' 검색`;
//         // 기타 도서관은 툴팁 없이 표시
//         return (
//             <div className="flex justify-between items-center">
//                 <span>{libraryName}:</span>
//                 <a
//                     href={searchUrl}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className={`font-medium ${statusColor} hover:text-blue-400 hover:underline cursor-pointer transition-colors`}
//                 >
//                     {total} / {available}
//                 </a>
//             </div>
//         );
//     }

//     return (
//         <div className="flex justify-between items-center">
//             <span>{libraryName}:</span>
//             {searchUrl ? (
//                 <a
//                     href={searchUrl}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className={`font-medium ${statusColor} hover:text-blue-400 hover:underline cursor-pointer transition-colors`}
//                     title={`${searchTitle} - ${statusText} 총 ${total}권 소장, 대출가능 ${available}권`}
//                 >
//                     {total} / {available}
//                 </a>
//             ) : (
//                 <span className={`font-medium ${statusColor}`} title={`${statusText} 총 ${total}권 소장, 대출가능 ${available}권`}>
//                     {total} / {available}
//                 </span>
//             )}
//         </div>
//     );
// };

// MyLibraryBookDetailModal.tsx 파일의 renderStockInfo 함수를 아래 코드로 교체하세요.

const renderStockInfo = (libraryName: string, bookTitle: string, stock?: StockInfo) => {
    if (typeof stock === 'undefined') {
        return <div className="flex justify-between items-center"><span>{libraryName}:</span> <div className="flex items-center gap-2"><Spinner /><span className="text-tertiary">확인중...</span></div></div>;
    }
    if (!stock) {
        return <div className="flex justify-between items-center"><span>{libraryName}:</span> <span className="text-tertiary">정보 없음</span></div>;
    }
    const { total, available } = stock;
    const statusColor = available > 0 ? 'text-green-400' : 'text-red-400';
    const statusText = available > 0 ? '대출가능' : '대출불가';
    
    const subject = createSearchSubject(bookTitle);
    let searchUrl = '';
    let searchTitle = '';
    
    // [수정] 퇴촌 도서관 링크 생성 로직을 MyLibrary.tsx와 동일하게 단순화
    if (libraryName === '퇴촌 도서관') {
        searchUrl = `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodeURIComponent(subject)}`;
        searchTitle = `퇴촌 도서관에서 '${subject}' 검색`;
    } else if (libraryName === '기타 도서관') {
        searchUrl = `https://lib.gjcity.go.kr/lay1/program/S1T446C461/jnet/resourcessearch/resultList.do?searchType=SIMPLE&searchKey=TITLE&searchLibrary=ALL&searchKeyword=${encodeURIComponent(subject)}`;
        searchTitle = `광주시립도서관에서 '${subject}' 검색`;
    }

    // searchUrl이 없는 경우를 대비한 방어 코드 (이론적으로는 이제 발생하지 않음)
    if (!searchUrl) {
      return (
        <div className="flex justify-between items-center">
            <span>{libraryName}:</span>
            <span className={`font-medium ${statusColor}`} title={`${statusText} | 총 ${total}권, 대출가능 ${available}권`}>
                {total} / {available}
            </span>
        </div>
      );
    }

    return (
        <div className="flex justify-between items-center">
            <span>{libraryName}:</span>
            <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()} // 이벤트 버블링 방지
                className={`font-medium ${statusColor} hover:text-blue-400 hover:underline cursor-pointer transition-colors`}
                title={`${searchTitle} | ${statusText} (총 ${total}권, 대출가능 ${available}권)`}
            >
                {total} / {available}
            </a>
        </div>
    );
};

const MyLibraryBookDetailModal: React.FC<MyLibraryBookDetailModalProps> = ({ bookId, onClose }) => {
    const { updateReadStatus, updateRating, refreshingIsbn, refreshEBookInfo, refreshingEbookId, refreshAllBookInfo, addTagToBook, removeTagFromBook, setAuthorFilter, updateBookNote } = useBookStore();
    const book = useBookStore(state => state.myLibraryBooks.find(b => b.id === bookId));
    const { settings } = useSettingsStore();

    // 메모 편집 상태 관리
    const [editingNote, setEditingNote] = useState(false);
    const [noteValue, setNoteValue] = useState('');

    // If the book is deleted while the modal is open, close the modal.
    useEffect(() => {
        if (!book) {
            onClose();
        }
    }, [book, onClose]);

    // 메모 값 초기화
    useEffect(() => {
        if (book) {
            setNoteValue(book.note || '');
        }
    }, [book]);

    if (!book) return null; // Render nothing while closing or if book not found

    const handleAuthorClick = (authorName: string) => {
        if (!authorName) return;

        // 현재 모달 닫기
        onClose();

        // MyLibrary에서 저자로 필터링
        setAuthorFilter(authorName);
    };

    // 메모 편집 시작
    const handleNoteEdit = () => {
        setEditingNote(true);
    };

    // 메모 저장
    const handleNoteSave = async () => {
        try {
            await updateBookNote(book.id, noteValue);
            setEditingNote(false);
        } catch (error) {
            console.error('메모 저장 실패:', error);
        }
    };

    // 메모 편집 취소
    const handleNoteCancel = () => {
        setNoteValue(book.note || '');
        setEditingNote(false);
    };

    // 메모 삭제
    const handleNoteDelete = async () => {
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
        if (e.key === 'Enter' && e.ctrlKey) {
            handleNoteSave();
        } else if (e.key === 'Escape') {
            handleNoteCancel();
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    };

    const hasEbookLink = book.subInfo?.ebookList?.[0]?.link;

    // 레이아웃 로직 변수 정의
    const hasLeftContent = settings.showRating || settings.showReadStatus || settings.showTags || settings.showBookNotes;
    const hasRightContent = settings.showLibraryStock;
    const isLibraryStockOnly = !hasLeftContent && hasRightContent;

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
                    
                    {/* 내 서재 정보가 하나라도 표시될 때만 섹션을 표시 */}
                    {(hasLeftContent || hasRightContent) && (
                        <div className="mt-6 pt-6 border-t border-primary">
                            <h3 className="text-2xl font-bold text-primary mb-4">내 서재 정보</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-secondary rounded-lg p-6">
                                {/* 왼쪽 컬럼: 일반 요소들 또는 도서관 재고 (도서관 재고만 있을 때) */}
                                <div className="space-y-6">
                                    {/* 도서관 재고만 있는 경우 왼쪽 컬럼에 표시 */}
                                    {isLibraryStockOnly ? (
                                        // 도서관 재고만 있을 때
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
                                            <div className="space-y-2 text-sm text-secondary bg-elevated p-4 rounded-md">
                                                {renderStockInfo('퇴촌 도서관', book.title, book.toechonStock)}
                                                {renderStockInfo('기타 도서관', book.title, book.otherStock)}
                                                {book.subInfo?.ebookList?.[0]?.link && (
                                                    <>
                                                        <div className="flex justify-between items-center">
                                                            <span>전자책(교육):</span>
                                                            {book.ebookInfo ? (
                                                                <a
                                                                    href={`https://lib.goe.go.kr/elib/module/elib/search/index.do?menu_idx=94&author_name=&viewPage=1&search_text=${encodeURIComponent(createSearchSubject(book.title))}&sortField=book_pubdt&sortType=desc&rowCount=20`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`font-medium ${book.ebookInfo.summary.대출가능 > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`}
                                                                    title={`총 재고: ${book.ebookInfo.summary.총개수}권, 대출가능: ${book.ebookInfo.summary.대출가능}권`}
                                                                >
                                                                    {book.ebookInfo.summary.총개수} / {book.ebookInfo.summary.대출가능}
                                                                </a>
                                                            ) : (
                                                                <span className="text-tertiary">정보 없음</span>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span>전자책(시립구독):</span>
                                                            {(() => {
                                                                const siripInfo = book.siripEbookInfo;
                                                                const subscriptionTotalCount = siripInfo?.details?.subscription?.total_count || 0;
                                                                const subscriptionAvailableCount = siripInfo?.details?.subscription?.available_count || 0;

                                                                if (!siripInfo) {
                                                                    return (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                refreshAllBookInfo(book.id, book.isbn13, book.title);
                                                                            }}
                                                                            className="font-medium text-blue-400 hover:text-blue-300"
                                                                            disabled={refreshingEbookId === book.id}
                                                                        >
                                                                            {refreshingEbookId === book.id ? '로딩...' : '조회'}
                                                                        </button>
                                                                    );
                                                                }

                                                                if ('error' in siripInfo) {
                                                                    return <span className="font-medium text-tertiary">정보 없음</span>;
                                                                }

                                                                return (
                                                                    <a
                                                                        href={`https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent((() => {
                                                                            let titleForSearch = book.title;
                                                                            const dashIndex = titleForSearch.indexOf('-');
                                                                            if (dashIndex !== -1) {
                                                                                titleForSearch = titleForSearch.substring(0, dashIndex).trim();
                                                                            }
                                                                            return titleForSearch.split(' ').slice(0, 3).join(' ');
                                                                        })())}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`font-medium ${subscriptionAvailableCount > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`}
                                                                        title={`총 ${subscriptionTotalCount}권 (대출가능: ${subscriptionAvailableCount}권)`}
                                                                    >
                                                                        {subscriptionTotalCount} / {subscriptionAvailableCount}
                                                                    </a>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span>전자책(시립소장):</span>
                                                            {(() => {
                                                                const siripInfo = book.siripEbookInfo;
                                                                const ownedTotalCount = siripInfo?.details?.owned?.total_count || 0;
                                                                const ownedAvailableCount = siripInfo?.details?.owned?.available_count || 0;

                                                                if (!siripInfo) {
                                                                    return (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                refreshAllBookInfo(book.id, book.isbn13, book.title);
                                                                            }}
                                                                            className="font-medium text-blue-400 hover:text-blue-300"
                                                                            disabled={refreshingEbookId === book.id}
                                                                        >
                                                                            {refreshingEbookId === book.id ? '로딩...' : '조회'}
                                                                        </button>
                                                                    );
                                                                }

                                                                if ('error' in siripInfo) {
                                                                    return <span className="font-medium text-tertiary">정보 없음</span>;
                                                                }

                                                                return (
                                                                    <a
                                                                        href={`https://lib.gjcity.go.kr:444/elibrary-front/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent((() => {
                                                                            let titleForSearch = book.title;
                                                                            const dashIndex = titleForSearch.indexOf('-');
                                                                            if (dashIndex !== -1) {
                                                                                titleForSearch = titleForSearch.substring(0, dashIndex).trim();
                                                                            }
                                                                            return titleForSearch.split(' ').slice(0, 3).join(' ');
                                                                        })())}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`font-medium ${ownedAvailableCount > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`}
                                                                        title={`총 ${ownedTotalCount}권 (대출가능: ${ownedAvailableCount}권)`}
                                                                    >
                                                                        {ownedTotalCount} / {ownedAvailableCount}
                                                                    </a>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span>전자책(경기):</span>
                                                            {book.gyeonggiEbookInfo ? (
                                                                'error' in book.gyeonggiEbookInfo ? (
                                                                    <span className="font-medium text-tertiary">정보 없음</span>
                                                                ) : (() => {
                                                                    // ISBN 필터링 적용
                                                                    const filteredGyeonggiInfo = filterGyeonggiEbookByIsbn(book, book.gyeonggiEbookInfo);
                                                                    return (
                                                                        <a
                                                                            href={createGyeonggiEbookSearchURL(book.title)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className={`font-medium ${filteredGyeonggiInfo.available_count > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`}
                                                                            title={`총 ${filteredGyeonggiInfo.total_count}권 (대출가능: ${filteredGyeonggiInfo.available_count}권, 소장형: ${filteredGyeonggiInfo.owned_count}권, 구독형: ${filteredGyeonggiInfo.subscription_count}권)`}
                                                                        >
                                                                            {filteredGyeonggiInfo.total_count} / {filteredGyeonggiInfo.available_count}
                                                                        </a>
                                                                    );
                                                                })()
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        refreshAllBookInfo(book.id, book.isbn13, book.title);
                                                                    }}
                                                                    className="font-medium text-blue-400 hover:text-blue-300"
                                                                    disabled={refreshingEbookId === book.id}
                                                                >
                                                                    {refreshingEbookId === book.id ? '로딩...' : '조회'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {/* 시간 정보 유지 */}
                                            {book.ebookInfo && (
                                                <div className="text-xs text-tertiary pt-2 mt-2">
                                                    {formatDate(book.ebookInfo.lastUpdated)} 기준
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        // 일반 요소들이 있을 때
                                        <>
                                            {settings.showRating && (
                                                <div>
                                                    <label className="block text-sm font-medium text-secondary mb-2">나의 별점</label>
                                                    <StarRating
                                                        rating={book.rating}
                                                        onRatingChange={(newRating) => updateRating(book.id, newRating)}
                                                    />
                                                </div>
                                            )}
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
                                        </>
                                    )}
                                </div>

                                {/* 오른쪽 컬럼: 도서관 재고 (다른 요소들과 함께 있을 때만) */}
                                <div className="space-y-6">
                                    {!isLibraryStockOnly && hasRightContent && (
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
                                            <div className="space-y-2 text-sm text-secondary bg-elevated p-4 rounded-md">
                                                {renderStockInfo('퇴촌 도서관', book.title, book.toechonStock)}
                                                {renderStockInfo('기타 도서관', book.title, book.otherStock)}
                                                {book.subInfo?.ebookList?.[0]?.link && (
                                                    <>
                                                        <div className="flex justify-between items-center">
                                                            <span>전자책(교육):</span>
                                                            {book.ebookInfo ? (
                                                                <a
                                                                    href={`https://lib.goe.go.kr/elib/module/elib/search/index.do?menu_idx=94&author_name=&viewPage=1&search_text=${encodeURIComponent(createSearchSubject(book.title))}&sortField=book_pubdt&sortType=desc&rowCount=20`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`font-medium ${book.ebookInfo.summary.대출가능 > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`}
                                                                    title={`총 재고: ${book.ebookInfo.summary.총개수}권, 대출가능: ${book.ebookInfo.summary.대출가능}권`}
                                                                >
                                                                    {book.ebookInfo.summary.총개수} / {book.ebookInfo.summary.대출가능}
                                                                </a>
                                                            ) : (
                                                                <span className="text-tertiary">정보 없음</span>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span>전자책(시립구독):</span>
                                                            {(() => {
                                                                const siripInfo = book.siripEbookInfo;
                                                                const subscriptionTotalCount = siripInfo?.details?.subscription?.total_count || 0;
                                                                const subscriptionAvailableCount = siripInfo?.details?.subscription?.available_count || 0;

                                                                if (!siripInfo) {
                                                                    return (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                refreshAllBookInfo(book.id, book.isbn13, book.title);
                                                                            }}
                                                                            className="font-medium text-blue-400 hover:text-blue-300"
                                                                            disabled={refreshingEbookId === book.id}
                                                                        >
                                                                            {refreshingEbookId === book.id ? '로딩...' : '조회'}
                                                                        </button>
                                                                    );
                                                                }

                                                                if ('error' in siripInfo) {
                                                                    return <span className="font-medium text-tertiary">정보 없음</span>;
                                                                }

                                                                return (
                                                                    <a
                                                                        href={`https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent((() => {
                                                                            let titleForSearch = book.title;
                                                                            const dashIndex = titleForSearch.indexOf('-');
                                                                            if (dashIndex !== -1) {
                                                                                titleForSearch = titleForSearch.substring(0, dashIndex).trim();
                                                                            }
                                                                            return titleForSearch.split(' ').slice(0, 3).join(' ');
                                                                        })())}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`font-medium ${subscriptionAvailableCount > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`}
                                                                        title={`총 ${subscriptionTotalCount}권 (대출가능: ${subscriptionAvailableCount}권)`}
                                                                    >
                                                                        {subscriptionTotalCount} / {subscriptionAvailableCount}
                                                                    </a>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span>전자책(시립소장):</span>
                                                            {(() => {
                                                                const siripInfo = book.siripEbookInfo;
                                                                const ownedTotalCount = siripInfo?.details?.owned?.total_count || 0;
                                                                const ownedAvailableCount = siripInfo?.details?.owned?.available_count || 0;

                                                                if (!siripInfo) {
                                                                    return (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                refreshAllBookInfo(book.id, book.isbn13, book.title);
                                                                            }}
                                                                            className="font-medium text-blue-400 hover:text-blue-300"
                                                                            disabled={refreshingEbookId === book.id}
                                                                        >
                                                                            {refreshingEbookId === book.id ? '로딩...' : '조회'}
                                                                        </button>
                                                                    );
                                                                }

                                                                if ('error' in siripInfo) {
                                                                    return <span className="font-medium text-tertiary">정보 없음</span>;
                                                                }

                                                                return (
                                                                    <a
                                                                        href={`https://lib.gjcity.go.kr:444/elibrary-front/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent((() => {
                                                                            let titleForSearch = book.title;
                                                                            const dashIndex = titleForSearch.indexOf('-');
                                                                            if (dashIndex !== -1) {
                                                                                titleForSearch = titleForSearch.substring(0, dashIndex).trim();
                                                                            }
                                                                            return titleForSearch.split(' ').slice(0, 3).join(' ');
                                                                        })())}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`font-medium ${ownedAvailableCount > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`}
                                                                        title={`총 ${ownedTotalCount}권 (대출가능: ${ownedAvailableCount}권)`}
                                                                    >
                                                                        {ownedTotalCount} / {ownedAvailableCount}
                                                                    </a>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span>전자책(경기):</span>
                                                            {book.gyeonggiEbookInfo ? (
                                                                'error' in book.gyeonggiEbookInfo ? (
                                                                    <span className="font-medium text-tertiary">정보 없음</span>
                                                                ) : (() => {
                                                                    // ISBN 필터링 적용
                                                                    const filteredGyeonggiInfo = filterGyeonggiEbookByIsbn(book, book.gyeonggiEbookInfo);
                                                                    return (
                                                                        <a
                                                                            href={createGyeonggiEbookSearchURL(book.title)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className={`font-medium ${filteredGyeonggiInfo.available_count > 0 ? 'text-green-400' : 'text-red-400'} hover:text-blue-400`}
                                                                            title={`총 ${filteredGyeonggiInfo.total_count}권 (대출가능: ${filteredGyeonggiInfo.available_count}권, 소장형: ${filteredGyeonggiInfo.owned_count}권, 구독형: ${filteredGyeonggiInfo.subscription_count}권)`}
                                                                        >
                                                                            {filteredGyeonggiInfo.total_count} / {filteredGyeonggiInfo.available_count}
                                                                        </a>
                                                                    );
                                                                })()
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        refreshAllBookInfo(book.id, book.isbn13, book.title);
                                                                    }}
                                                                    className="font-medium text-blue-400 hover:text-blue-300"
                                                                    disabled={refreshingEbookId === book.id}
                                                                >
                                                                    {refreshingEbookId === book.id ? '로딩...' : '조회'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {/* 시간 정보 유지 */}
                                            {book.ebookInfo && (
                                                <div className="text-xs text-tertiary pt-2 mt-2">
                                                    {formatDate(book.ebookInfo.lastUpdated)} 기준
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyLibraryBookDetailModal;

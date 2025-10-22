import React from 'react';
import { CloseIcon } from './Icons';
import Spinner from './Spinner';
import { useBookStore } from '../stores/useBookStore';
import { useUIStore } from '../stores/useUIStore';
import { AladdinBookItem } from '../types'; // [추가] 명확한 타입을 위해 import

const BookSearchListModal: React.FC = () => {
  const { isBookSearchListModalOpen, closeBookSearchListModal, setNotification, openMyLibraryBookDetailModal } = useUIStore();
  const { searchResults, selectBook, myLibraryBooks, hasMoreResults, isLoadingMore, loadMoreSearchResults, myLibraryIsbnSet, isBookInLibrary } = useBookStore();
  const handleBookClick = (book: AladdinBookItem) => { // [수정] any 대신 AladdinBookItem 타입 사용

  // // ▼▼▼▼▼▼▼▼▼▼ [디버깅 로그 #3] - 렌더링 시점의 Set 상태 확인 ▼▼▼▼▼▼▼▼▼▼
  // console.log(`[MODAL-DEBUG-3] Modal is rendering. Current ISBN Set size: ${myLibraryIsbnSet.size}`);
  // // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // 중복 책 체크
    const duplicateBook = myLibraryBooks.find(libraryBook => libraryBook.isbn13 === book.isbn13);

    if (duplicateBook) {
      // // [개선 제안] 확인창을 띄워 사용자에게 선택권 제공
      // if (window.confirm('이미 서재에 추가된 책입니다.\n상세 정보를 보시겠습니까?')) {
      //   closeBookSearchListModal();
      //   openMyLibraryBookDetailModal(duplicateBook.id);
      // }
      // 이미 추가된 책인 경우 해당 책의 상세 모달 열기
      closeBookSearchListModal(); // 검색 결과 모달 닫기
      openMyLibraryBookDetailModal(duplicateBook.id); // 상세 모달 열기
      return;
    }

    // 중복이 아닌 경우에만 책 선택
    selectBook(book);
  };

  if (!isBookSearchListModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-elevated rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-primary">
          <h2 className="text-xl font-bold text-primary">도서 검색 결과</h2>
          <button onClick={closeBookSearchListModal} className="text-secondary hover:text-primary">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {searchResults.length > 0 ? (
            <div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {searchResults.map((book) => {

                  // const isDuplicate = myLibraryBooks.some(libraryBook => libraryBook.isbn13 === book.isbn13);
                  const normalizedIsbn = (book.isbn13 || '').toString().trim();
                  const isDuplicate = isBookInLibrary(normalizedIsbn);

                  // // ▼▼▼▼▼▼▼▼▼▼ [디버깅 로그 #4] - 각 책에 대한 중복 검사 추적 ▼▼▼▼▼▼▼▼▼▼
                  // console.log(`[MODAL-DEBUG-4] Checking duplication for ISBN: ${book.isbn13}, Title: ${book.title}`);
                  // console.log(`  -> Result: ${isDuplicate}`);
                  // // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲


                  return (
                  <li
                    key={book.isbn13}
                    onClick={() => handleBookClick(book)}
                    className={`bg-secondary rounded-lg p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-300 relative ${
                      isDuplicate
                        ? 'opacity-80 hover:bg-tertiary hover:shadow-lg transform hover:-translate-y-1'
                        : 'hover:bg-tertiary hover:shadow-lg transform hover:-translate-y-1'
                    }`}
                    title={isDuplicate ? '이미 서재에 추가된 책입니다. 클릭하면 상세 정보를 볼 수 있습니다.' : '클릭하여 서재에 추가'}
                  >
                    {isDuplicate && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-semibold">
                        추가됨
                      </div>
                    )}
                    <img src={book.cover.replace('coversum', 'cover')} alt={book.title} className="w-32 h-48 object-cover rounded shadow-md mb-4" />
                    
                    {/* [종이책][전자책] */}                  
                    <div className="flex gap-1 w-32 mb-3">
                      {(() => {
                        const isEbookResult = book.mallType === 'EBOOK';
                        
                        const paperBookLink = isEbookResult
                          ? book.subInfo?.paperBookList?.[0]?.link || null
                          : book.link;
                          
                        const ebookLink = isEbookResult
                          ? book.link
                          : book.subInfo?.ebookList?.[0]?.link || null;

                        const hasPaper = !!paperBookLink;
                        const hasEbook = !!ebookLink;
                        const hasBoth = hasPaper && hasEbook;

                        const buttonClass = hasBoth
                          ? "flex-1 px-1 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-tertiary hover:text-primary transition-colors text-center whitespace-nowrap"
                          : "w-full px-2 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-tertiary hover:text-primary transition-colors text-center";

                        return (
                          <>
                            {hasPaper && (
                              <a href={paperBookLink!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={buttonClass}>
                                종이책
                              </a>
                            )}
                            {hasEbook && (
                              <a href={ebookLink!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={buttonClass}>
                                전자책
                              </a>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <h3 className="text-sm font-semibold text-primary mb-1 line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-tertiary line-clamp-2">{book.author.replace(/\s*\([^)]*\)/g, '')}</p>
                    <p className="text-xs text-tertiary mt-1">{book.pubDate}</p>
                  </li>
                  );
                })}
              </ul>

              {/* 더 보기 버튼 영역 */}
              {(hasMoreResults || isLoadingMore) && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMoreSearchResults}
                    disabled={isLoadingMore}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    {isLoadingMore ? (
                      <>
                        <Spinner />
                        추가 로딩 중...
                      </>
                    ) : (
                      '더 많은 책 보기'
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-tertiary py-8">검색 결과가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookSearchListModal;

import React, { useMemo, useState, useEffect } from 'react';
import { PlusIcon, BookOpenIcon, RefreshIcon, CloseIcon } from './Icons';
import { useBookStore } from '../stores/useBookStore';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';
import { SelectedBook, ReadStatus, StockInfo } from '../types';
import Spinner from './Spinner';
import AuthorButtons from './AuthorButtons';

const createSearchSubject = (title: string): string => {
  const chunks = title.split(' ');
  if (chunks.length <= 3) {
    return title;
  }
  return chunks.slice(0, 3).join(' ');
};

const BookDetails: React.FC = () => {
  const {
    selectedBook,
    addToLibrary,
    myLibraryBooks,
    unselectBook,
    updateReadStatus,
    updateRating,
    refreshingIsbn,
    refreshBookInfo: refreshAllBookInfo,
    searchBooks,
  } = useBookStore();
  const { closeBookSearchListModal, openBookSearchListModal } = useUIStore();
  const { session } = useAuthStore();
  
  // 개발 환경에서만 디버깅 로그 출력
  useEffect(() => {
    if (import.meta.env.DEV) {
      // console.log('BookDetails - selectedBook changed:', selectedBook);
    }
  }, [selectedBook]);
  
  // 로딩 상태 추가
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const isBookInLibrary = useMemo(() => {
    if (!selectedBook) return false;
    return myLibraryBooks.some(b => b.isbn13 === selectedBook.isbn13);
  }, [selectedBook, myLibraryBooks]);

  const isFromLibrary = selectedBook ? 'id' in selectedBook : false;
  const bookFromLibrary = isFromLibrary ? (selectedBook as SelectedBook) : null;
  const hasEbookLink = selectedBook?.subInfo?.ebookList?.[0]?.link;

  const handleAddClick = async () => {
    if (isAdding || isBookInLibrary || !selectedBook) return;

    setIsAdding(true);
    setIsLoading(true);
    try {
      await addToLibrary();
      // 책 추가 성공 후 모달 닫기
      closeBookSearchListModal();
      console.log('도서가 서재에 성공적으로 추가되었습니다.');
    } catch (error) {
      console.error('도서 추가 중 오류 발생:', error);
    } finally {
      setIsAdding(false);
      setIsLoading(false);
    }
  }

  const handleAuthorClick = async (authorName: string) => {
    if (!authorName) return;

    try {
      setIsLoading(true);

      // 알라딘 API로 저자 검색 (Author 타입으로)
      await searchBooks(authorName, 'Author');

      // 검색 결과가 있으면 모달 열기
      const searchResults = useBookStore.getState().searchResults;
      if (searchResults.length > 0) {
        openBookSearchListModal();
      } else {
        console.log(`'${authorName}' 저자의 검색 결과가 없습니다.`);
      }
    } catch (error) {
      console.error('저자 검색 중 오류 발생:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 도서가 선택되지 않은 경우
  if (!selectedBook) {
    return null; // 안내 텍스트 대신 아무것도 표시하지 않음
  }

  // selectedBook이 있지만 필수 속성이 없는 경우 처리
  if (!selectedBook.title || !selectedBook.author) {
    return (
      <div className="text-center text-tertiary mt-16 p-8 bg-secondary rounded-lg shadow-inner">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-600 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-red-400 mb-2">도서 정보 불완전</h3>
          <p className="text-lg text-tertiary mb-2">선택된 도서 정보가 불완전합니다.</p>
          <p className="text-sm text-tertiary">다른 도서를 선택하거나 다시 검색해주세요.</p>
        </div>
        
        <div className="mt-6 p-4 bg-tertiary rounded-lg text-left">
          <p className="text-xs text-tertiary mb-2">문제가 있는 도서 정보:</p>
          <p className="text-xs text-tertiary">title: {selectedBook.title || '없음'}</p>
          <p className="text-xs text-tertiary">author: {selectedBook.author || '없음'}</p>
          <p className="text-xs text-tertiary">isbn13: {selectedBook.isbn13 || '없음'}</p>
          <p className="text-xs text-tertiary">cover: {selectedBook.cover || '없음'}</p>
        </div>
        
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={() => unselectBook()}
            className="px-4 py-2 bg-secondary text-primary rounded-lg hover-surface transition-colors"
          >
            도서 선택 해제
          </button>
          <button
            onClick={() => unselectBook()}
            className="px-4 py-2 bg-blue-600 text-primary rounded-lg hover:bg-blue-500 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  // selectedBook이 있지만 cover 이미지가 없는 경우 처리
  if (!selectedBook.cover) {
    return (
      <div className="text-center text-tertiary mt-16 p-8 bg-secondary rounded-lg shadow-inner">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-600 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-yellow-400 mb-2">도서 표지 이미지 누락</h3>
          <p className="text-lg text-tertiary mb-2">도서 표지 이미지를 불러올 수 없습니다.</p>
          <p className="text-sm text-tertiary">다른 도서를 선택하거나 다시 검색해주세요.</p>
        </div>
        
        <div className="mt-6 p-4 bg-tertiary rounded-lg text-left">
          <p className="text-xs text-tertiary mb-2">도서 정보:</p>
          <p className="text-xs text-tertiary">제목: {selectedBook.title}</p>
          <p className="text-xs text-tertiary">저자: {selectedBook.author}</p>
          <p className="text-xs text-tertiary">ISBN: {selectedBook.isbn13}</p>
        </div>
        
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={() => unselectBook()}
            className="px-4 py-2 bg-secondary text-primary rounded-lg hover-surface transition-colors"
          >
            도서 선택 해제
          </button>
          <button
            onClick={() => unselectBook()}
            className="px-4 py-2 bg-blue-600 text-primary rounded-lg hover:bg-blue-500 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-8 p-4 bg-elevated rounded-lg shadow-xl animate-fade-in max-w-4xl mx-auto">
      <button
        onClick={() => unselectBook()}
        className="absolute top-4 right-4 text-tertiary hover:text-primary transition-colors z-20"
        title="닫기"
      >
        <CloseIcon className="w-6 h-6" />
      </button>

      {isLoading && (
        <div className="absolute inset-0 bg-elevated/80 flex items-center justify-center rounded-lg z-10">
          <div className="text-center">
            <Spinner className="w-8 h-8 mx-auto mb-2" />
            <p className="text-secondary">처리 중...</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 flex justify-center items-start">
          <img 
            src={selectedBook.cover.replace('coversum', 'cover')} 
            alt={selectedBook.title} 
            className="w-40 h-auto object-cover rounded-lg shadow-lg"
            onError={(e) => {
              console.error('이미지 로딩 실패:', selectedBook.cover);
              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjI4OCIgdmlld0JveD0iMCAwIDE5MiAyODgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMjg4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik05NiAxNDRDMTA2LjA1OSAxNDQgMTE0IDEzNi4wNTkgMTE0IDEyNkMxMTQgMTE1Ljk0MSAxMDYuMDU5IDEwOCA5NiAxMDhDODUuOTQxIDExMCA3OCAxMTcuOTQxIDc4IDEyOEM3OCAxMzguMDU5IDg1Ljk0MSAxNDYgOTYgMTQ2WiIgZmlsbD0iIzZCNzM4MCIvPgo8cGF0aCBkPSJNNjQgMTY4VjE5MkgxMjhWMTY4QzEyOCAxNTcuOTQxIDEyMC4wNTkgMTUwIDExMCAxNTBINzRDNjMuOTQxIDE1MCA1NiAxNTcuOTQxIDU2IDE2OFoiIGZpbGw9IiM2QjczODAiLz4KPC9zdmc+';
            }}
          />
        </div>
        <div className="md:col-span-2 text-secondary">
          
          <h2 className="text-2xl font-bold text-primary mb-3 pr-12">{selectedBook.title}</h2>
          <p className="text-base text-secondary mb-2">
            <strong>저자:</strong>{' '}
            {selectedBook.author ? (
              <AuthorButtons
                authorString={selectedBook.author}
                onAuthorClick={handleAuthorClick}
                className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer transition-colors"
              />
            ) : (
              <span className="text-gray-400">정보없음</span>
            )}
          </p>
          <p className="text-sm text-tertiary mb-2">
            <strong>출판사:</strong> {selectedBook.publisher || '정보없음'}
          </p>
          <p className="text-sm text-tertiary mb-2">
            <strong>출간일:</strong> {selectedBook.pubDate || '정보없음'}
          </p>
          <p className="text-sm text-tertiary mb-2">
            <strong>ISBN:</strong> {selectedBook.isbn13 || '정보없음'}
          </p>
          {selectedBook.subInfo?.ebookList?.[0]?.isbn13 && (
            <p className="text-sm text-tertiary mb-4">
              <strong>전자책 ISBN:</strong> {selectedBook.subInfo.ebookList[0].isbn13}
            </p>
          )}
          
          {selectedBook.priceSales && selectedBook.priceStandard && (
            <div className="flex items-baseline mb-4">
              <p className="text-xl font-bold text-blue-400">{selectedBook.priceSales.toLocaleString()}원</p>
              <p className="text-sm text-tertiary line-through ml-3">{selectedBook.priceStandard.toLocaleString()}원</p>
            </div>
          )}

          {/*
          <p className="text-sm text-tertiary leading-relaxed mb-6">
            {selectedBook.description || "제공된 설명이 없습니다."}
          </p>
          */}
          
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <button
              onClick={handleAddClick}
              disabled={!session || isBookInLibrary || isAdding}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-primary font-semibold rounded-lg hover:bg-indigo-700 transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-wait text-sm"
            >
              {!session ? (
                '로그인 후 추가'
              ) : isBookInLibrary ? (
                '추가 완료'
              ) : isAdding ? (
                <>
                  <Spinner className="w-4 h-4" />
                  추가 중...
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4" />
                  내 서재 추가
                </>
              )}
            </button>
            <a
              href={selectedBook.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-primary font-semibold rounded-lg hover:bg-green-700 transition-colors duration-300 text-sm"
            >
              <BookOpenIcon className="w-4 h-4" />
              알라딘 보기
            </a>
            <a
              href={hasEbookLink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => !hasEbookLink && e.preventDefault()}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 text-primary font-semibold rounded-lg transition-colors duration-300 text-sm ${
                !hasEbookLink ? 'opacity-50 cursor-not-allowed' : 'hover:bg-sky-600'
              }`}
              title={!hasEbookLink ? "알라딘에서 제공하는 전자책 정보가 없습니다" : "알라딘에서 전자책 보기"}
            >
              <BookOpenIcon className="w-4 h-4" />
              전자책 보기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDetails;

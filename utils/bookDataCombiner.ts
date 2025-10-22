// 파일 위치: utils/bookDataCombiner.ts

import {
  AladdinBookItem,
  LibraryApiResponse,
  GyeonggiEduEbookResult,
  GyeonggiEbookResult,
  GwangjuPaperResult,
  ApiCombinedBookData, // ✅ 새로 정의한 명시적 타입 임포트
} from '../types';
import { filterGyeonggiEbookByIsbn } from './isbnMatcher';


/**
 * [RAW 데이터 확인용]
 * 알라딘 API 결과와 도서관 API 결과를 가공 없이 단순 병합합니다.
 * 이 함수는 API 테스트나 상세 모달의 'API 보기' 기능에서
 * 시스템이 받은 원본 데이터를 그대로 확인하는 용도로 사용됩니다.
 *
 * @param aladinBook - 알라딘 API 응답 (단일 책)
 * @param libraryResult - 통합 도서관 API 응답
 * @returns {object} - 두 API 응답이 단순히 합쳐진 객체
 */
export function combineRawApiResults(
  aladinBook: AladdinBookItem,
  libraryResult: LibraryApiResponse
): object {
  return {
    _source_aladin_api: aladinBook,
    _source_library_api: libraryResult,
  };
}


/**
 * [DB 저장용]
 * 알라딘 API 결과와 도서관 API 결과를 조합하여,
 * 사용자 정보(별점, 메모 등)가 제외된 "순수한 API 정보 객체"를 생성합니다.
 * 이 객체는 API 테스트, 상세 모달 API 보기, DB 업데이트 시 API 최신 정보를 구성하는 데 사용됩니다.
 *
 * @param aladinBook - 알라딘 API 응답 (단일 책)
 * @param libraryResult - 통합 도서관 API 응답
 * @returns {object} - 알라딘과 도서관 API 정보가 조합된 객체 (사용자 정보 없음)
 */

export function createBookDataFromApis( // ✅ 이름 변경
  aladinBook: AladdinBookItem,
  libraryResult: LibraryApiResponse
): ApiCombinedBookData { // ✅ 반환 타입 변경

  // 1. 최종 객체를 `ApiCombinedBookData` 타입에 맞춰 구성 시작
  const combined: ApiCombinedBookData = {
    ...aladinBook,

    // 도서관 API 원본 정보 할당
    gwangjuPaperInfo: libraryResult.gwangju_paper,
    // ebookInfo: libraryResult.gyeonggi_ebook_edu,
    ebookInfo: (libraryResult.gyeonggi_ebook_edu && 'book_list' in libraryResult.gyeonggi_ebook_edu)
             ? libraryResult.gyeonggi_ebook_edu as GyeonggiEduEbookResult
             : null,
    gyeonggiEbookInfo: libraryResult.gyeonggi_ebook_library,
    siripEbookInfo: libraryResult.sirip_ebook,
  };

    // ▼▼▼▼▼▼▼▼▼▼ 이 부분을 아래 코드로 교체하세요 ▼▼▼▼▼▼▼▼▼▼
  // 광주 종이책 재고 요약 (toechonStock, otherStock)
  if (libraryResult.gwangju_paper && 'summary_total_count' in libraryResult.gwangju_paper) {
    // API 성공 시에만 재고 정보를 생성
    const paperResult = libraryResult.gwangju_paper as GwangjuPaperResult;
    combined.toechonStock = {
      total_count: paperResult.toechon_total_count,
      available_count: paperResult.toechon_available_count,
    };
    combined.otherStock = {
      total_count: paperResult.other_total_count,
      available_count: paperResult.other_available_count,
    };
  }
  // 💣 else 블록을 완전히 제거하여, 실패 시 toechonStock과 otherStock이 undefined가 되도록 함
  // ▲▲▲▲▲▲▲▲▲▲ 여기까지 교체 ▲▲▲▲▲▲▲▲▲▲
  
  if (libraryResult.gyeonggi_ebook_library && !('error' in libraryResult.gyeonggi_ebook_library)) {
    combined.filteredGyeonggiEbookInfo = filterGyeonggiEbookByIsbn(
      aladinBook,
      libraryResult.gyeonggi_ebook_library as GyeonggiEbookResult
    );
  } else if (libraryResult.gyeonggi_ebook_library) {
    combined.filteredGyeonggiEbookInfo = libraryResult.gyeonggi_ebook_library;
  }
  
  // 3. 타입에 맞는 최종 객체 반환
  return combined;
}
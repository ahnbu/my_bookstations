// 파일 위치: utils/bookDataCombiner.ts

import {
  AladdinBookItem,
  LibraryApiResponse,
  GyeonggiEduEbookResult,
  GyeonggiEbookResult,
  GwangjuPaperResult,
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
export function combineApiResults(
  aladinBook: AladdinBookItem,
  libraryResult: LibraryApiResponse
): object { // 반환 타입을 범용적인 object로 하여 유연성을 확보합니다.

  // 1. 알라딘 API 결과를 베이스로 객체를 생성합니다.
  const combined: any = { ...aladinBook };

  // 2. 도서관 재고 API의 원본 응답을 그대로 추가합니다.
  combined.gwangjuPaperInfo = libraryResult.gwangju_paper;
  combined.ebookInfo = libraryResult.gyeonggi_ebook_edu; // 키 이름 변경: gyeonggi_ebook_edu -> ebookInfo
  combined.gyeonggiEbookInfo = libraryResult.gyeonggi_ebook_library;
  combined.siripEbookInfo = libraryResult.sirip_ebook;

  // 3. 화면 표시에 용이하도록 파생/요약 데이터를 계산하여 추가합니다.

  // 광주 종이책 재고 요약 (toechonStock, otherStock)
  if (libraryResult.gwangju_paper && 'summary_total_count' in libraryResult.gwangju_paper) {
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

  // 경기도 교육청 전자책 요약 (기존 gyeonggi_ebook_edu -> 새로운 ebookInfo 객체로 재구성)
  if (libraryResult.gyeonggi_ebook_edu && 'book_list' in libraryResult.gyeonggi_ebook_edu) {
    const eduResult = libraryResult.gyeonggi_ebook_edu as GyeonggiEduEbookResult;
    combined.ebookInfo = { // 기존 BookData의 ebookInfo 구조와 일치시킴
      summary: {
        total_count: eduResult.total_count,
        available_count: eduResult.available_count,
        unavailable_count: eduResult.unavailable_count,
        seongnam_count: eduResult.seongnam_count,
        tonghap_count: eduResult.tonghap_count,
        error_count: eduResult.error_count,
        error_lib_detail: eduResult.error_lib_detail,
      },
      details: eduResult.book_list,
      lastUpdated: Date.now(),
    };
  }

  // 경기도 전자도서관 ISBN 필터링 결과 (filteredGyeonggiEbookInfo)
  if (libraryResult.gyeonggi_ebook_library && !('error' in libraryResult.gyeonggi_ebook_library)) {
    combined.filteredGyeonggiEbookInfo = filterGyeonggiEbookByIsbn(
      aladinBook, // 필터링 함수는 AladdinBookItem 타입으로 충분
      libraryResult.gyeonggi_ebook_library as GyeonggiEbookResult
    );
  } else if (libraryResult.gyeonggi_ebook_library) {
    combined.filteredGyeonggiEbookInfo = libraryResult.gyeonggi_ebook_library;
  }

  // 4. 이 함수는 순수 API 조합이므로, 사용자 활동 정보(rating, note 등)는 절대 포함하지 않습니다.
  return combined;
}
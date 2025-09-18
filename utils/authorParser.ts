/**
 * 저자 이름 파싱 및 처리 유틸리티 함수들
 */

/**
 * 저자 문자열을 개별 저자로 분리
 * "A, B, C" 형태의 문자열을 ["A", "B", "C"] 배열로 변환
 * @param authorString - 원본 저자 문자열
 * @returns 개별 저자 이름 배열
 */
export function parseAuthors(authorString: string): string[] {
  if (!authorString || typeof authorString !== 'string') {
    return [];
  }

  return authorString
    .split(',')
    .map(author => author.trim())
    .filter(author => author.length > 0);
}

/**
 * 저자 이름에서 괄호 제거 및 정리
 * "(역자)", "(저자)" 등의 괄호 표기를 제거하고 공백 정리
 * @param authorName - 정리할 저자 이름
 * @returns 정리된 저자 이름
 */
export function getCleanAuthorName(authorName: string): string {
  if (!authorName || typeof authorName !== 'string') {
    return '';
  }

  return authorName
    .replace(/\s*\([^)]*\)/g, '') // 괄호와 괄호 안의 내용 제거
    .trim(); // 앞뒤 공백 제거
}

/**
 * 저자 문자열을 파싱하고 정리하여 검색 가능한 형태로 변환
 * @param authorString - 원본 저자 문자열
 * @returns 정리된 개별 저자 이름 배열
 */
export function parseAndCleanAuthors(authorString: string): string[] {
  const authors = parseAuthors(authorString);
  return authors.map(author => getCleanAuthorName(author));
}
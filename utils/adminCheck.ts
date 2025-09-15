// 관리자 계정 목록
const ADMIN_EMAILS = [
  'byungwook.an@gmail.com'
];

/**
 * 사용자가 관리자인지 확인하는 함수
 * @param email - 사용자 이메일
 * @returns 관리자 여부
 */
export const isAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

/**
 * 관리자 계정 목록을 가져오는 함수
 * @returns 관리자 이메일 목록
 */
export const getAdminEmails = (): string[] => {
  return [...ADMIN_EMAILS];
};
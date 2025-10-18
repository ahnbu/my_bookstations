import React from 'react';
import { parseAndCleanAuthors } from '../utils/authorParser';

interface AuthorButtonsProps {
  /** 저자 문자열 (쉼표로 구분된 여러 저자 가능) */
  authorString: string;
  /** 저자 클릭 시 호출되는 함수 */
  onAuthorClick: (authorName: string) => void;
  /** 버튼 스타일 클래스명 (선택사항) */
  className?: string;
  /** 구분자 스타일 클래스명 (선택사항) */
  separatorClassName?: string;
}

/**
 * 저자 이름을 개별 클릭 가능한 버튼으로 표시하는 공통 컴포넌트
 * 쉼표로 구분된 여러 저자를 파싱하여 각각 클릭 가능한 버튼으로 렌더링
 */
const AuthorButtons: React.FC<AuthorButtonsProps> = ({
  authorString,
  onAuthorClick,
  className = "text-blue-400 hover:text-blue-300 hover:underline cursor-pointer transition-colors",
  separatorClassName = "text-gray-400"
}) => {
  // 저자 문자열을 파싱하여 개별 저자 배열로 변환
  const authors = parseAndCleanAuthors(authorString);

  // 저자가 없는 경우 빈 문자열 반환
  if (authors.length === 0) {
    return <span className="text-gray-400">저자 정보없음</span>;
  }

  // 단일 저자인 경우
  if (authors.length === 1) {
    return (
      <button
        onClick={() => onAuthorClick(authors[0])}
        className={className}
        type="button"
        title={`${authors[0]} 검색`}
      >
        {authors[0]}
      </button>
    );
  }

  // 여러 저자인 경우 쉼표로 구분하여 표시
  return (
    <span>
      {authors.map((author, index) => (
        <React.Fragment key={author}>
          <button
            onClick={() => onAuthorClick(author)}
            className={className}
            type="button"
            title={`${author} 검색`}
          >
            {author}
          </button>
          {index < authors.length - 1 && (
            <span className={separatorClassName}>, </span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
};

export default AuthorButtons;
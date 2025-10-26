// CustomTag_작업후문제있는코드.tsx

import React from 'react';
import type { CustomTag, TagColor } from '../types';
import { CloseIcon, PlusIcon } from './Icons';

interface CustomTagProps {
  tag: CustomTag; // 이 부분이 undefined일 수 있습니다.
  isActive?: boolean;
  onClick?: () => void;
  showCount?: number;
  // size?: 'sm' | 'md';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showClose?: boolean;
  onClose?: () => void;
  showAdd?: boolean;
  onAdd?: () => void;
}

const colorStyles: Record<TagColor, { base: string; active: string }> = {
  primary: {
    base: 'tag-primary',
    active: 'tag-primary opacity-90'
  },
  secondary: {
    base: 'tag-secondary',
    active: 'tag-secondary opacity-90'
  },
  tertiary: { // ✅ [추가] 'tertiary' 색상 스타일 등록
    base: 'tag-tertiary',
    active: 'tag-tertiary opacity-90'
  }
};

const CustomTagComponent: React.FC<CustomTagProps> = ({
  tag,
  isActive = false,
  onClick,
  showCount,
  size = 'sm', // 기존에는 기본값 'md'였음
  className = '',
  showClose = false,
  onClose,
  showAdd = false,
  onAdd
}) => {
  // --- Start: 방어 코드 추가 ---
  if (!tag || !tag.color) {
    // tag prop이 없거나 color 속성이 없는 비정상적인 경우,
    // 렌더링을 시도하지 않거나 기본값으로 렌더링합니다.
    // 여기서는 null을 반환하여 아무것도 그리지 않도록 합니다.
    console.warn('CustomTagComponent received invalid tag prop:', tag);
    return null; 
  }

  const isValidColor = tag.color === 'primary' || tag.color === 'secondary' || tag.color === 'tertiary' ;
  const tagColor = isValidColor ? tag.color : 'secondary'; // 유효하지 않은 색상 값일 경우 'secondary'를 기본값으로 사용
  // --- End: 방어 코드 추가 ---

  const sizeClasses = {
    xs: 'px-1.5 py-0 text-[10px] leading-4',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs'
  };

  const colorClass = isActive
    ? colorStyles[tagColor].active // 수정: tagColor 사용
    : colorStyles[tagColor].base;   // 수정: tagColor 사용

  const baseClasses = `
    inline-flex items-center rounded-md
    focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
    ${sizeClasses[size]}
    ${colorClass}
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // ✅ [핵심 수정 1] 클릭 핸들러 로직 통합
  // onAdd나 onClose가 있으면 우선적으로 실행, 없으면 기존 onClick(필터링) 실행
  const handleClick = (e: React.MouseEvent) => {
    // 이벤트 전파를 막아, 부모 요소의 다른 클릭 이벤트와 충돌 방지
    e.stopPropagation(); 
    
    if (onAdd) {
      onAdd();
    } else if (onClose) {
      onClose();
    } else if (onClick) {
      onClick();
    }
  };

  // ✅ [핵심 수정 2] title 텍스트를 상황에 맞게 동적으로 설정
  const titleText = onAdd
    ? `태그 추가: '${tag.name}'`
    : onClose
      ? `태그 제거: '${tag.name}'`
      : onClick
        ? `클릭하여 '${tag.name}' 태그로 필터링`
        : undefined;

  // ✅ [핵심 수정 3] 최상위 태그를 'span'에서 'button'으로 변경하고, 내부 버튼 제거
   return (
    <button
      type="button"
      className={baseClasses}
      onClick={handleClick}
      title={titleText}
    >
      <span>{tag.name}</span>
      {showCount !== undefined && (
        <span className="ml-1.5 opacity-75">
          ({showCount})
        </span>
      )}
      {/* ❌ 내부 <button>을 제거하고 아이콘만 표시 */}
      {showClose && (
        <CloseIcon className="ml-1 w-3 h-3" />
      )}
      {showAdd && (
        <PlusIcon className="ml-1 w-3 h-3" />
      )}
    </button>
  );
};

export default CustomTagComponent;
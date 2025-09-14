// CustomTag_작업후문제있는코드.tsx

import React from 'react';
import type { CustomTag, TagColor } from '../types';
import { CloseIcon, PlusIcon } from './Icons';

interface CustomTagProps {
  tag: CustomTag; // 이 부분이 undefined일 수 있습니다.
  isActive?: boolean;
  onClick?: () => void;
  showCount?: number;
  size?: 'sm' | 'md';
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
  }
};

const CustomTagComponent: React.FC<CustomTagProps> = ({
  tag,
  isActive = false,
  onClick,
  showCount,
  size = 'md',
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

  const isValidColor = tag.color === 'primary' || tag.color === 'secondary';
  const tagColor = isValidColor ? tag.color : 'secondary'; // 유효하지 않은 색상 값일 경우 'secondary'를 기본값으로 사용
  // --- End: 방어 코드 추가 ---

  const sizeClasses = {
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

  return (
    <span
      className={baseClasses}
      onClick={onClick}
      title={onClick ? `클릭하여 '${tag.name}' 태그로 필터링` : undefined}
    >
      {tag.name}
      {showCount !== undefined && (
        <span className="ml-1 opacity-75">
          ({showCount})
        </span>
      )}
      {showClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          className="ml-1 p-0.5 text-current hover:text-red-400 transition-colors rounded"
          title="태그 제거"
        >
          <CloseIcon className="w-3 h-3" />
        </button>
      )}
      {showAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd?.();
          }}
          className="ml-1 p-0.5 text-current hover:text-green-400 transition-colors rounded"
          title="태그 추가"
        >
          <PlusIcon className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

export default CustomTagComponent;
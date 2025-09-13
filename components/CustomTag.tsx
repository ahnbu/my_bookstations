import React from 'react';
import type { CustomTag, TagColor } from '../types';

interface CustomTagProps {
  tag: CustomTag;
  isActive?: boolean;
  onClick?: () => void;
  showCount?: number;
  size?: 'sm' | 'md';
  className?: string;
}

const colorStyles: Record<TagColor, { base: string; active: string }> = {
  blue: {
    base: 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200',
    active: 'bg-blue-600 border-blue-600 text-white'
  },
  green: {
    base: 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200',
    active: 'bg-green-600 border-green-600 text-white'
  },
  yellow: {
    base: 'bg-yellow-100 border-yellow-300 text-yellow-700 hover:bg-yellow-200',
    active: 'bg-yellow-600 border-yellow-600 text-white'
  },
  red: {
    base: 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200',
    active: 'bg-red-600 border-red-600 text-white'
  },
  purple: {
    base: 'bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200',
    active: 'bg-purple-600 border-purple-600 text-white'
  },
  pink: {
    base: 'bg-pink-100 border-pink-300 text-pink-700 hover:bg-pink-200',
    active: 'bg-pink-600 border-pink-600 text-white'
  },
  gray: {
    base: 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200',
    active: 'bg-gray-600 border-gray-600 text-white'
  }
};

const CustomTagComponent: React.FC<CustomTagProps> = ({
  tag,
  isActive = false,
  onClick,
  showCount,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm'
  };

  const colorClass = isActive
    ? colorStyles[tag.color].active
    : colorStyles[tag.color].base;

  const baseClasses = `
    inline-flex items-center
    border rounded-md font-medium
    transition-all duration-200
    ${sizeClasses[size]}
    ${colorClass}
    ${onClick ? 'cursor-pointer hover:shadow-sm' : ''}
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
    </span>
  );
};

export default CustomTagComponent;
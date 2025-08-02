
import React, { useState } from 'react';
import { StarIcon } from './Icons';

interface StarRatingProps {
  rating: number;
  onRatingChange: (newRating: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const StarRating: React.FC<StarRatingProps> = ({ rating, onRatingChange, size = 'md' }) => {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const paddingClasses = {
    sm: 'px-0.5',
    md: 'px-0.5',
    lg: 'px-1'
  };

  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => onRatingChange(star)}
          className={`${paddingClasses[size]} cursor-pointer`}
          aria-label={`Rate ${star} star`}
        >
          <StarIcon
            className={`${sizeClasses[size]} transition-colors duration-200 ${
              (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

export default StarRating;

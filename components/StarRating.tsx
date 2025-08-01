import React, { useState } from 'react';
import { StarIcon } from './Icons';

interface StarRatingProps {
  rating: number;
  onRatingChange: (newRating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, onRatingChange }) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => onRatingChange(star)}
          className="p-1 cursor-pointer"
          aria-label={`Rate ${star} star`}
        >
          <StarIcon
            className={`w-6 h-6 transition-colors duration-200 ${
              (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

export default StarRating;

'use client';

import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: number;
  readOnly?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function StarRating({
  value,
  onChange,
  max = 5,
  size = 20,
  readOnly = false,
  showLabel = false,
  className = '',
}: StarRatingProps) {
  const [hovered, setHovered] = React.useState(0);

  const display = hovered || value;

  return (
    <div className={['flex items-center gap-1', className].join(' ')}>
      {Array.from({ length: max }, (_, i) => {
        const starVal = i + 1;
        const filled = starVal <= display;
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(starVal)}
            onMouseEnter={() => !readOnly && setHovered(starVal)}
            onMouseLeave={() => !readOnly && setHovered(0)}
            aria-label={`Rate ${starVal} out of ${max}`}
            className={[
              'transition-transform duration-100',
              readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded',
            ].join(' ')}
          >
            <Star
              size={size}
              className={
                filled
                  ? 'fill-amber-400 stroke-amber-400'
                  : 'fill-transparent stroke-slate-300 dark:stroke-slate-600'
              }
            />
          </button>
        );
      })}
      {showLabel && (
        <span className="ml-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}

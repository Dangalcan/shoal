interface StarRatingProps {
  rating: number;       // 0-5, supports decimals
  reviews?: number;
  size?: number;
  showCount?: boolean;
}

export function StarRating({ rating, reviews, size = 14, showCount = true }: StarRatingProps) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const fill = Math.max(0, Math.min(1, rating - i));
    return fill;
  });

  return (
    <span className="star-rating" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {stars.map((fill, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          style={{ display: 'inline', verticalAlign: 'middle' }}
        >
          <defs>
            <linearGradient id={`star-grad-${i}-${rating}`}>
              <stop offset={`${fill * 100}%`} stopColor="#f59e0b" />
              <stop offset={`${fill * 100}%`} stopColor="var(--bg-tertiary, #374151)" />
            </linearGradient>
          </defs>
          <polygon
            points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7"
            fill={`url(#star-grad-${i}-${rating})`}
            stroke="#f59e0b"
            strokeWidth="0.5"
          />
        </svg>
      ))}
      {showCount && reviews !== undefined && (
        <span className="star-rating__count">
          {rating.toFixed(1)} ({reviews.toLocaleString()})
        </span>
      )}
    </span>
  );
}

/** The app icon (public/icon.svg) as an inline mark; keep both in sync. */

const FISH = 'M18 0C10-10-6-10-14 0L-24-8L-21 0L-24 8L-14 0C-6 10 10 10 18 0Z';
const ANGLES = [0, 60, 120, 180, 240, 300];

interface ShoalLogoProps {
  size?: number;
  className?: string;
}

export function ShoalLogo({ size = 24, className }: ShoalLogoProps) {
  return (
    <svg
      viewBox="0 0 180 180"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="180" height="180" rx="40" fill="#0B2233" />
      <g transform="translate(90 90)">
        {ANGLES.map((angle) => (
          <path
            key={angle}
            d={FISH}
            fill={angle === 300 ? '#FCD34D' : '#2DD4BF'}
            transform={`rotate(${angle}) translate(46 0) rotate(90) scale(.95)`}
          />
        ))}
      </g>
    </svg>
  );
}

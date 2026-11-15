const STAR_PATH = 'M8 1.2l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 12l-4.2 2.2.8-4.7L1.2 6.2l4.7-.7z';

/** Five stars filled to `value` (fractions shown as partial fill), with an optional "(count)". */
export function Stars({ value, size = 14, count }: { value: number; size?: number; count?: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        const gradientId = `g${i}-${Math.round(fill * 10)}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId}>
                <stop offset={fill} stopColor="var(--star)" />
                <stop offset={fill} stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d={STAR_PATH}
              fill={`url(#${gradientId})`}
              stroke="var(--star)"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
      {count !== undefined && <span className="star-count">({count})</span>}
    </span>
  );
}

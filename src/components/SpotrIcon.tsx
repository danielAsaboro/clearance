interface SpotrIconProps {
  size?: number;
  className?: string;
}

export default function SpotrIcon({ size = 96, className }: SpotrIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Yellow rounded square background */}
      <rect width="40" height="40" rx="9" fill="#f5d63d" />

      {/* Eye / lens shape at top */}
      <path d="M10 11 Q20 5.5 30 11 Q20 16.5 10 11 Z" fill="black" />
      <circle cx="20" cy="11" r="2.8" fill="#f5d63d" />

      {/* Play triangle (right-pointing, centered) */}
      <path d="M15 18 L26 23 L15 28 Z" fill="black" />

      {/* Left broadcast bars */}
      <rect x="7.5" y="18.5" width="5" height="1.5" rx="0.75" fill="black" />
      <rect x="7.5" y="21.5" width="5" height="1.5" rx="0.75" fill="black" />
      <rect x="7.5" y="24.5" width="5" height="1.5" rx="0.75" fill="black" />

      {/* Right broadcast bars */}
      <rect x="27.5" y="18.5" width="5" height="1.5" rx="0.75" fill="black" />
      <rect x="27.5" y="21.5" width="5" height="1.5" rx="0.75" fill="black" />
      <rect x="27.5" y="24.5" width="5" height="1.5" rx="0.75" fill="black" />
    </svg>
  );
}

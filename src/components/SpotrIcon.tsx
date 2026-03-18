import Image from "next/image";

interface SpotrIconProps {
  size?: number;
  className?: string;
}

export default function SpotrIcon({ size = 96, className }: SpotrIconProps) {
  return (
    <Image
      src="/spotr-logo.png"
      alt="Spotr TV"
      width={size}
      height={size}
      className={`rounded-2xl ${className ?? ""}`}
      priority
    />
  );
}

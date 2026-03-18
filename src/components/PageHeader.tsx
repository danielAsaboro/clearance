"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  backHref: string;
}

export default function PageHeader({ title, backHref }: PageHeaderProps) {
  return (
    <div className="spotr-mobile-shell px-5 pt-4 pb-3">
      <Link
        href={backHref}
        className="flex items-center gap-3 text-white hover:opacity-80 transition-opacity"
      >
        <ArrowLeft className="h-[18px] w-[18px]" />
        <span className="text-[21px] font-semibold tracking-[-0.03em]">{title}</span>
      </Link>
      <div className="spotr-divider mt-4" />
    </div>
  );
}

"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";

interface ShareQRProps {
  url: string;
  label?: string;
  size?: number;
}

export default function ShareQR({ url, label = "Scan to Join", size = 200 }: ShareQRProps) {
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const svgEl = svgContainerRef.current?.querySelector("svg");
    if (!svgEl) return;

    const canvas = document.createElement("canvas");
    const padding = 24;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);
      const a = document.createElement("a");
      a.download = "spotr-qr.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6b6b6b]">
        {label}
      </p>
      <div
        ref={svgContainerRef}
        className="rounded-[14px] bg-white p-4"
      >
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 rounded-[10px] bg-[#232323] px-4 py-2 text-[12px] font-medium text-[#9b9b9b] transition-colors hover:bg-[#2a2a2a] hover:text-white"
      >
        <Download className="h-3.5 w-3.5" />
        Save QR Code
      </button>
    </div>
  );
}

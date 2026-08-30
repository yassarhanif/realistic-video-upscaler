"use client";

import React, { useState } from "react";
import { Download, Play, Check, Sparkles, RefreshCw, Layers } from "lucide-react";

interface VideoPreviewProps {
  originalUrl: string;
  upscaledUrl: string;
  isImage?: boolean;
  onReset: () => void;
  metadata?: {
    processTime?: number;
    framesProcessed?: number;
    scale?: number;
  };
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  originalUrl,
  upscaledUrl,
  isImage = false,
  onReset,
  metadata,
}) => {
  const [activeTab, setActiveTab] = useState<"upscaled" | "original" | "split">("upscaled");
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(upscaledUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-md shadow-xl space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="text-base font-semibold text-white">Hasil Super Resolusi</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
              {metadata?.scale || 4}x Ditingkatkan
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Rekonstruksi fotorealistik telah selesai dengan sukses.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("upscaled")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "upscaled"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Hasil Upscale
          </button>
          <button
            onClick={() => setActiveTab("original")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "original"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setActiveTab("split")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "split"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Berdampingan
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="relative rounded-2xl overflow-hidden bg-black/80 border border-zinc-800 min-h-[360px] flex items-center justify-center">
        {activeTab === "upscaled" && (
          <div className="w-full h-full flex items-center justify-center p-2">
            {isImage ? (
              <img
                src={upscaledUrl}
                alt="Hasil Upscale"
                className="max-h-[500px] w-auto object-contain rounded-lg"
              />
            ) : (
              <video
                src={upscaledUrl}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-[500px] w-full rounded-lg"
              />
            )}
          </div>
        )}

        {activeTab === "original" && (
          <div className="w-full h-full flex items-center justify-center p-2">
            {isImage ? (
              <img
                src={originalUrl}
                alt="Media Original"
                className="max-h-[500px] w-auto object-contain rounded-lg opacity-90"
              />
            ) : (
              <video
                src={originalUrl}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-[500px] w-full rounded-lg opacity-90"
              />
            )}
          </div>
        )}

        {activeTab === "split" && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono font-medium">Original</span>
                <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded">1x</span>
              </div>
              <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-zinc-800">
                {isImage ? (
                  <img src={originalUrl} alt="Original" className="w-full h-full object-contain" />
                ) : (
                  <video src={originalUrl} controls loop playsInline className="w-full h-full object-contain" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono font-medium text-white flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                  Hasil AI
                </span>
                <span className="text-[10px] bg-white text-zinc-950 font-bold px-1.5 py-0.5 rounded">
                  {metadata?.scale || 4}x HD
                </span>
              </div>
              <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-zinc-700">
                {isImage ? (
                  <img src={upscaledUrl} alt="Hasil Upscale" className="w-full h-full object-contain" />
                ) : (
                  <video src={upscaledUrl} controls loop playsInline className="w-full h-full object-contain" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metadata & Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono">
          {metadata?.processTime && (
            <div>
              <span>Waktu Inferensi: </span>
              <span className="text-zinc-200">{metadata.processTime.toFixed(1)}s</span>
            </div>
          )}
          {metadata?.framesProcessed && (
            <div>
              <span>Total Frame: </span>
              <span className="text-zinc-200">{metadata.framesProcessed}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tingkatkan File Lain
          </button>

          <a
            href={upscaledUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Unduh File Hasil
          </a>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { Sparkles, Cpu, HardDrive, Wand2, History } from "lucide-react";

interface HeaderProps {
  activeTab?: "studio" | "history";
  onTabChange?: (tab: "studio" | "history") => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab = "studio", onTabChange }) => {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-950 font-bold shadow-glow">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              Realistic Upscaler
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                v1.0
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Super Resolusi Video & Gambar AI
            </p>
          </div>
        </div>

        {/* Center Nav Switcher (if handler provided) */}
        {onTabChange && (
          <div className="flex items-center p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
            <button
              type="button"
              onClick={() => onTabChange("studio")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "studio"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "history"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat & Berkas</span>
            </button>
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
            <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">R2 Storage</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
            <Cpu className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">RunPod GPU</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>
    </header>
  );
};


import React from "react";
import { Sparkles, Cpu, HardDrive } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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

        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
            <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">R2 Direct</span>
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

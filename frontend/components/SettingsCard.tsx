import React from "react";
import { Sliders, Sparkles } from "lucide-react";

export interface UpscaleSettings {
  scale: number;
  modelName: string;
  faceEnhance: boolean;
  denoiseStrength: number;
}

interface SettingsCardProps {
  settings: UpscaleSettings;
  onChange: (settings: UpscaleSettings) => void;
  disabled?: boolean;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  settings,
  onChange,
  disabled = false,
}) => {
  const update = (partial: Partial<UpscaleSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-5 backdrop-blur-sm shadow-sm transition-all">
      <div className="flex items-center gap-2 pb-4 mb-4 border-b border-zinc-800/80">
        <Sliders className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-medium text-zinc-200">Pengaturan SeedVR 2</h2>
      </div>

      <div className="space-y-5">
        {/* Scale Selector */}
        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-2">
            Target Resolusi Output
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => update({ scale: 2 })}
              className={`py-2.5 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-2 transition-all ${
                settings.scale === 2
                  ? "bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="font-bold text-sm">2x</span>
              <span className="text-[11px] opacity-75">(2K QHD)</span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => update({ scale: 4 })}
              className={`py-2.5 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-2 transition-all ${
                settings.scale === 4
                  ? "bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="font-bold text-sm">4x</span>
              <span className="text-[11px] opacity-75">(4K Ultra HD)</span>
            </button>
          </div>
        </div>

        {/* Dedicated SeedVR2 Engine Card */}
        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-2">
            Mesin AI
          </label>
          <div className="p-3.5 rounded-xl border bg-zinc-950/80 border-zinc-700/80 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-zinc-100 text-sm">ByteDance SeedVR 2</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700 ml-auto">
                ⭐ Ultra Sinematik
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
              Diffusion Transformer mutakhir untuk restorasi video satu langkah (*One-Step DiT*). Menghasilkan ketajaman alami, konsistensi temporal anti-flicker, dan mempertahankan tekstur wajah/pakaian fotorealistik.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

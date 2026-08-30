import React from "react";
import { Sliders, Sparkles, UserCheck, ShieldAlert } from "lucide-react";

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
        <h2 className="text-sm font-medium text-zinc-200">Pengaturan Peningkatan</h2>
      </div>

      <div className="space-y-5">
        {/* Scale Selector */}
        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-2">
            Faktor Skala Target
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => update({ scale: 2 })}
              className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-2 transition-all ${
                settings.scale === 2
                  ? "bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="font-bold text-sm">2x</span>
              <span className="text-[11px] opacity-75">(Cepat / 2K)</span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => update({ scale: 4 })}
              className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-2 transition-all ${
                settings.scale === 4
                  ? "bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="font-bold text-sm">4x</span>
              <span className="text-[11px] opacity-75">(Ultra / 4K)</span>
            </button>
          </div>
        </div>

        {/* AI Model Selection */}
        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-2">
            Arsitektur Model AI
          </label>
          <div className="space-y-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => update({ modelName: "RealESRGAN_x4plus" })}
              className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-3 ${
                settings.modelName === "RealESRGAN_x4plus"
                  ? "bg-zinc-800/80 border-zinc-600 text-white"
                  : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div
                className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                  settings.modelName === "RealESRGAN_x4plus"
                    ? "border-white bg-white"
                    : "border-zinc-600"
                }`}
              >
                {settings.modelName === "RealESRGAN_x4plus" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-zinc-200 flex items-center gap-1.5">
                  RealESRGAN_x4plus
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-700/60 text-zinc-300">
                    Direkomendasikan
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Tekstur fotorealistik RRDBNet 64-block untuk rekaman dunia nyata yang natural.
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => update({ modelName: "realesr-general-x4v3" })}
              className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-3 ${
                settings.modelName === "realesr-general-x4v3"
                  ? "bg-zinc-800/80 border-zinc-600 text-white"
                  : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div
                className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                  settings.modelName === "realesr-general-x4v3"
                    ? "border-white bg-white"
                    : "border-zinc-600"
                }`}
              >
                {settings.modelName === "realesr-general-x4v3" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-zinc-200">
                  realesr-general-x4v3
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Model SRVGGNet ringkas dengan inferensi lebih cepat dan reduksi noise bawaan.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Face Enhancement Toggle */}
        <div className="pt-2 border-t border-zinc-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <label
                  htmlFor="face-enhance"
                  className="text-xs font-medium text-zinc-200 block cursor-pointer"
                >
                  Restorasi Wajah (GFPGAN)
                </label>
                <span className="text-[11px] text-zinc-400 block">
                  Rekonstruksi detail wajah, mata, dan tekstur kulit yang buram
                </span>
              </div>
            </div>

            <button
              id="face-enhance"
              type="button"
              role="switch"
              aria-checked={settings.faceEnhance}
              disabled={disabled}
              onClick={() => update({ faceEnhance: !settings.faceEnhance })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.faceEnhance ? "bg-white" : "bg-zinc-800"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out ${
                  settings.faceEnhance ? "translate-x-4 bg-zinc-950" : "translate-x-0 bg-zinc-400"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

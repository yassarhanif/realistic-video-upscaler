import React, { useState } from "react";
import { Sliders, HelpCircle } from "lucide-react";

export interface UpscaleSettings {
  scale: number;
  modelName: string;
  faceEnhance: boolean;
  denoiseStrength: number;
  batchSize: number;
  uniformBatchSize: boolean;
  colorCorrection: string;
  inputNoiseScale: number;
  latentNoiseScale: number;
  resolution: number;
  maxResolution: number;
  attentionMode: string;
}

interface SettingsCardProps {
  settings: UpscaleSettings;
  onChange: (settings: UpscaleSettings) => void;
  disabled?: boolean;
}

const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-[11px] text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg whitespace-normal w-64 leading-relaxed pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
};

const QuestionMark: React.FC<{ tooltip: string }> = ({ tooltip }) => (
  <Tooltip text={tooltip}>
    <HelpCircle className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-help ml-1.5 transition-colors" />
  </Tooltip>
);

const TextInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
}> = ({ value, onChange, step = 1, min, max, placeholder, disabled }) => (
  <input
    type="number"
    value={value}
    step={step}
    min={min}
    max={max}
    placeholder={placeholder}
    disabled={disabled}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
  />
);

const PillSelector: React.FC<{
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
  disabled?: boolean;
}> = ({ value, options, onChange, disabled }) => (
  <div className="grid grid-cols-4 gap-1.5">
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        disabled={disabled}
        onClick={() => onChange(opt.value)}
        className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all ${
          value === opt.value
            ? "bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm"
            : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const Dropdown: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ value, options, onChange, disabled }) => (
  <select
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

const NumberDropdown: React.FC<{
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
  disabled?: boolean;
}> = ({ value, options, onChange, disabled }) => (
  <select
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(Number(e.target.value))}
    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

const Toggle: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!value)}
    className={`relative w-10 h-5 rounded-full transition-colors ${
      value ? "bg-zinc-100" : "bg-zinc-700"
    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-zinc-950 transition-transform ${
        value ? "translate-x-5" : ""
      }`}
    />
  </button>
);

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

        {/* Quality Section */}
        <div className="space-y-4">
          {/* Denoise Strength */}
          <div>
            <label className="text-xs font-medium text-zinc-400 flex items-center">
              Denoise Strength
              <QuestionMark tooltip="Seberapa agresif membersihkan noise. 0.0 = tanpa pembersihan, 1.0 = maksimal. Rekomendasi: 0.2-0.3 untuk video bersih, 0.5 untuk video noisy." />
            </label>
            <TextInput
              value={settings.denoiseStrength}
              onChange={(v) => update({ denoiseStrength: v })}
              step={0.05}
              min={0}
              max={1}
              disabled={disabled}
            />
          </div>

          {/* Batch Size */}
          <div>
            <label className="text-xs font-medium text-zinc-400 flex items-center">
              Batch Size
              <QuestionMark tooltip="Frame per batch (harus 4n+1). Semakin tinggi = temporal makin konsisten, tapi butuh lebih banyak VRAM. Rekomendasi: 9 atau 13." />
            </label>
            <PillSelector
              value={settings.batchSize}
              options={[
                { value: 5, label: "5" },
                { value: 9, label: "9" },
                { value: 13, label: "13" },
                { value: 17, label: "17" },
              ]}
              onChange={(v) => update({ batchSize: v })}
              disabled={disabled}
            />
          </div>

          {/* Uniform Batch Size */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-400 flex items-center">
              Uniform Batch Size
              <QuestionMark tooltip="Pad batch terakhir agar sama size. Cegah artifact di akhir video. Rekomendasi: aktif." />
            </label>
            <Toggle
              value={settings.uniformBatchSize}
              onChange={(v) => update({ uniformBatchSize: v })}
              disabled={disabled}
            />
          </div>

          {/* Color Correction */}
          <div>
            <label className="text-xs font-medium text-zinc-400 flex items-center">
              Color Correction
              <QuestionMark tooltip="Metode koreksi warna antar frame. LAB = paling umum, wavelet = frequency-based, none = mati." />
            </label>
            <Dropdown
              value={settings.colorCorrection}
              options={[
                { value: "lab", label: "LAB (Default)" },
                { value: "wavelet", label: "Wavelet" },
                { value: "wavelet_adaptive", label: "Wavelet Adaptive" },
                { value: "hsv", label: "HSV" },
                { value: "adain", label: "AdaIN" },
                { value: "none", label: "None" },
              ]}
              onChange={(v) => update({ colorCorrection: v })}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Advanced Section */}
        <div className="pt-3 border-t border-zinc-800/60">
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-4">Advanced</p>

          <div className="space-y-4">
            {/* Input Noise Scale */}
            <div>
              <label className="text-xs font-medium text-zinc-400 flex items-center">
                Input Noise Scale
                <QuestionMark tooltip="Injeksi noise ke input. 0.0 = bersih, 1.0 = banyak noise. Untuk variasi kreatif. Rekomendasi: 0.0." />
              </label>
              <TextInput
                value={settings.inputNoiseScale}
                onChange={(v) => update({ inputNoiseScale: v })}
                step={0.05}
                min={0}
                max={1}
                disabled={disabled}
              />
            </div>

            {/* Latent Noise Scale */}
            <div>
              <label className="text-xs font-medium text-zinc-400 flex items-center">
                Latent Noise Scale
                <QuestionMark tooltip="Injeksi noise ke latent space. Variasi lebih halus. Rekomendasi: 0.0." />
              </label>
              <TextInput
                value={settings.latentNoiseScale}
                onChange={(v) => update({ latentNoiseScale: v })}
                step={0.05}
                min={0}
                max={1}
                disabled={disabled}
              />
            </div>

            {/* Resolution */}
            <div>
              <label className="text-xs font-medium text-zinc-400 flex items-center">
                Resolution
                <QuestionMark tooltip="Target resolusi short-side output dalam pixel." />
              </label>
              <NumberDropdown
                value={settings.resolution}
                options={[
                  { value: 720, label: "720p" },
                  { value: 1080, label: "1080p (Default)" },
                  { value: 1440, label: "1440p" },
                  { value: 2160, label: "2160p (4K)" },
                ]}
                onChange={(v) => update({ resolution: v })}
                disabled={disabled}
              />
            </div>

            {/* Max Resolution */}
            <div>
              <label className="text-xs font-medium text-zinc-400 flex items-center">
                Max Resolution
                <QuestionMark tooltip="Batas maks resolusi. 0 = tanpa batas." />
              </label>
              <TextInput
                value={settings.maxResolution}
                onChange={(v) => update({ maxResolution: v })}
                min={0}
                placeholder="0 = unlimited"
                disabled={disabled}
              />
            </div>

            {/* Attention Mode */}
            <div>
              <label className="text-xs font-medium text-zinc-400 flex items-center">
                Attention Mode
                <QuestionMark tooltip="Backend attention computation. sdpa = default, flash_attn = lebih cepat (butuh GPU support)." />
              </label>
              <Dropdown
                value={settings.attentionMode}
                options={[
                  { value: "sdpa", label: "SDPA (Default)" },
                  { value: "flash_attn_2", label: "Flash Attention 2" },
                  { value: "flash_attn_3", label: "Flash Attention 3" },
                ]}
                onChange={(v) => update({ attentionMode: v })}
                disabled={disabled}
              />
            </div>
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
                Ultra Sinematik
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
              Diffusion Transformer mutakhir untuk restorasi video satu langkah (One-Step DiT). Menghasilkan ketajaman alami, konsistensi temporal anti-flicker, dan mempertahankan tekstur wajah/pakaian fotorealistik.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

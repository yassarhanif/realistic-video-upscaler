"use client";

import React, { useState, useRef, useCallback } from "react";
import { Upload, Film, Image as ImageIcon, X, AlertCircle } from "lucide-react";

export interface SelectedFileMeta {
  file?: File;
  previewUrl: string;
  isImage: boolean;
  name: string;
  size: number;
  existingR2Key?: string;
  existingPublicUrl?: string;
}

interface VideoUploaderProps {
  onFileSelected: (meta: SelectedFileMeta | null) => void;
  selectedFile: SelectedFileMeta | null;
  uploadProgress: number | null; // 0 - 100, or null when idle
  disabled?: boolean;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onFileSelected,
  selectedFile,
  uploadProgress,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setErrorMessage(null);
      const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
      const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);

      if (!isVideo && !isImage) {
        setErrorMessage("Silakan unggah file video (MP4, MOV, WebM) atau gambar (PNG, JPG) yang valid.");
        return;
      }

      // Max file size 500MB
      const maxBytes = 500 * 1024 * 1024;
      if (file.size > maxBytes) {
        setErrorMessage("Ukuran file melebihi batas maksimal 500MB.");
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      onFileSelected({
        file,
        previewUrl,
        isImage,
        name: file.name,
        size: file.size,
      });
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
      }
    },
    [disabled, processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    if (selectedFile?.previewUrl) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setErrorMessage(null);
    onFileSelected(null);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={disabled}
      />

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!selectedFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[260px] ${
            isDragOver
              ? "border-zinc-400 bg-zinc-800/40 scale-[0.99]"
              : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 mb-4 shadow-sm group-hover:scale-105 transition-transform">
            <Upload className="w-6 h-6 text-zinc-300" />
          </div>

          <h3 className="text-sm font-medium text-zinc-200 mb-1">
            Tarik & lepaskan video atau gambar di sini
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            Mendukung MP4, MOV, WebM, PNG, JPG (hingga 500MB)
          </p>

          <button
            type="button"
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
          >
            Pilih File dari Komputer
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 overflow-hidden relative backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300 flex-shrink-0">
                {selectedFile.isImage ? (
                  <ImageIcon className="w-4 h-4" />
                ) : (
                  <Film className="w-4 h-4" />
                )}
              </div>
              <div className="truncate text-left">
                <p className="text-xs font-medium text-zinc-200 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {formatBytes(selectedFile.size)} • {selectedFile.isImage ? "Gambar" : "Video"}
                </p>
              </div>
            </div>

            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Hapus file"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Media Preview */}
          <div className="relative rounded-xl overflow-hidden bg-black/60 aspect-video max-h-[300px] flex items-center justify-center border border-zinc-800/80">
            {selectedFile.isImage ? (
              <img
                src={selectedFile.previewUrl}
                alt={selectedFile.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                src={selectedFile.previewUrl}
                controls
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Direct R2 Upload Progress */}
          {uploadProgress !== null && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Mengunggah langsung ke Cloudflare R2...</span>
                <span className="font-mono text-zinc-200 font-medium">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-200 ease-out rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

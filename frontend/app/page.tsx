"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { VideoUploader, SelectedFileMeta } from "@/components/VideoUploader";
import { SettingsCard, UpscaleSettings } from "@/components/SettingsCard";
import { StatusIndicator, AppProcessStatus } from "@/components/StatusIndicator";
import { VideoPreview } from "@/components/VideoPreview";
import { HistorySection, HistoryItem } from "@/components/HistorySection";
import { Sparkles, ArrowRight, ShieldCheck, Zap, Video, History, Wand2 } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"studio" | "history">("studio");
  const [selectedFile, setSelectedFile] = useState<SelectedFileMeta | null>(null);
  const [settings, setSettings] = useState<UpscaleSettings>({
    scale: 4,
    modelName: "RealESRGAN_x4plus",
    faceEnhance: false,
    denoiseStrength: 0.5,
  });

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [processStatus, setProcessStatus] = useState<AppProcessStatus>("IDLE");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
  const [jobMetadata, setJobMetadata] = useState<any>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleStartUpscale = async () => {
    if (!selectedFile) return;

    setErrorMessage(null);
    let targetFileKey = selectedFile.existingR2Key;
    let targetPublicUrl = selectedFile.existingPublicUrl;

    // If file is newly chosen from computer (not existing on R2), upload to R2 first
    if (!targetFileKey && selectedFile.file) {
      setProcessStatus("UPLOADING");
      setUploadProgress(0);

      try {
        // 1. Request presigned upload URL from R2
        const urlRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: selectedFile.name,
            contentType: selectedFile.file.type || (selectedFile.isImage ? "image/png" : "video/mp4"),
          }),
        });

        if (!urlRes.ok) {
          const err = await urlRes.json();
          throw new Error(err.error || "Gagal membuat URL upload");
        }

        const { uploadUrl, fileKey, publicUrl } = await urlRes.json();
        targetFileKey = fileKey;
        targetPublicUrl = publicUrl;

        // 2. Direct upload to Cloudflare R2 using XMLHttpRequest for real-time progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader("Content-Type", selectedFile.file!.type || (selectedFile.isImage ? "image/png" : "video/mp4"));

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = (event.loaded / event.total) * 100;
              setUploadProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload langsung ke R2 gagal dengan kode status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Koneksi upload langsung ke R2 bermasalah. Periksa konfigurasi CORS R2."));
          xhr.send(selectedFile.file);
        });

        setUploadProgress(100);
      } catch (err: any) {
        console.error("Upload to R2 failed:", err);
        setErrorMessage(err.message || "Upload ke Cloudflare R2 gagal");
        setProcessStatus("FAILED");
        setUploadProgress(null);
        return;
      }
    }

    try {
      setProcessStatus("IN_QUEUE");

      // 3. Trigger RunPod serverless job
      const upscaleRes = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileKey: targetFileKey,
          videoUrl: targetPublicUrl,
          scale: settings.scale,
          modelName: settings.modelName,
          faceEnhance: settings.faceEnhance,
          denoiseStrength: settings.denoiseStrength,
        }),
      });

      if (!upscaleRes.ok) {
        const err = await upscaleRes.json();
        throw new Error(err.error || "Gagal memicu tugas peningkatan AI");
      }

      const { jobId } = await upscaleRes.json();
      setCurrentJobId(jobId);

      // 4. Start polling status
      startPolling(jobId);
    } catch (err: any) {
      console.error("Upscale pipeline failed:", err);
      setErrorMessage(err.message || "Terjadi kesalahan yang tidak terduga");
      setProcessStatus("FAILED");
      setUploadProgress(null);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?jobId=${jobId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Gagal memeriksa status tugas");
        }

        const data = await res.json();

        if (data.status === "IN_PROGRESS") {
          setProcessStatus("IN_PROGRESS");
        } else if (data.status === "COMPLETED") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setProcessStatus("COMPLETED");
          setUpscaledUrl(data.outputUrl || data.output?.output_url);
          setJobMetadata({
            processTime: data.executionTime ? data.executionTime / 1000 : data.output?.process_time,
            framesProcessed: data.output?.frames_processed,
            scale: settings.scale,
          });
        } else if (data.status === "FAILED" || data.status === "CANCELLED" || data.status === "TIMED_OUT") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setProcessStatus("FAILED");
          setErrorMessage(data.error || `Proses berakhir dengan status: ${data.status}`);
        }
      } catch (err: any) {
        console.error("Polling error:", err);
      }
    }, 2500);
  };

  const handleReset = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setSelectedFile(null);
    setUploadProgress(null);
    setProcessStatus("IDLE");
    setCurrentJobId(null);
    setErrorMessage(null);
    setUpscaledUrl(null);
    setJobMetadata(null);
  };

  const handleSelectHistoryForUpscale = (item: HistoryItem) => {
    setSelectedFile({
      name: item.filename,
      size: item.size,
      isImage: item.type === "image",
      previewUrl: item.publicUrl,
      existingR2Key: item.key,
      existingPublicUrl: item.publicUrl,
    });
    setActiveTab("studio");
  };

  const isBusy =
    processStatus === "UPLOADING" ||
    processStatus === "IN_QUEUE" ||
    processStatus === "IN_PROGRESS";

  return (
    <div className="flex flex-col min-h-screen">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full space-y-8">
        {/* Studio View */}
        {activeTab === "studio" ? (
          <>
            {/* Hero Section */}
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                <span>Fotorealistik Real-ESRGAN + Restorasi Wajah GFPGAN</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Peningkatan Super Resolusi Video AI
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
                Tingkatkan footage resolusi rendah menjadi definisi tinggi dengan tekstur alami, bebas artefak berlebih, dan rekonstruksi wajah yang tajam.
              </p>
            </div>

            {/* Dynamic Display Area */}
            {processStatus === "COMPLETED" && upscaledUrl && selectedFile ? (
              <VideoPreview
                originalUrl={selectedFile.previewUrl}
                upscaledUrl={upscaledUrl}
                isImage={selectedFile.isImage}
                onReset={handleReset}
                metadata={jobMetadata}
              />
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Upload Area */}
                  <div className="lg:col-span-7 space-y-4">
                    <VideoUploader
                      onFileSelected={setSelectedFile}
                      selectedFile={selectedFile}
                      uploadProgress={uploadProgress}
                      disabled={isBusy}
                    />
                  </div>

                  {/* Right Column: Settings & Trigger */}
                  <div className="lg:col-span-5 space-y-4">
                    <SettingsCard
                      settings={settings}
                      onChange={setSettings}
                      disabled={isBusy}
                    />

                    {/* Upscale Action Button */}
                    <button
                      type="button"
                      onClick={handleStartUpscale}
                      disabled={!selectedFile || isBusy}
                      className={`w-full py-3.5 px-5 rounded-2xl font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                        !selectedFile || isBusy
                          ? "bg-zinc-800/60 text-zinc-500 border border-zinc-800 cursor-not-allowed"
                          : "bg-white hover:bg-zinc-200 text-zinc-950 font-semibold shadow-glow scale-[1.01]"
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Mulai Peningkatan AI</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>

                {/* Status Indicator (if busy or failed) */}
                {processStatus !== "IDLE" && (
                  <StatusIndicator
                    status={processStatus}
                    jobId={currentJobId}
                    errorMessage={errorMessage}
                    onCancel={handleReset}
                  />
                )}
              </div>
            )}

            {/* Feature Highlights / Trust Badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-10 border-t border-zinc-900">
              <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                  <Zap className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-200">Performa GPU Serverless</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Memproses video di GPU NVIDIA RTX 4090 on-demand berkecepatan tinggi tanpa biaya idle server.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-200">Upload Langsung ke R2</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  File diunggah langsung dari browser ke Cloudflare R2 dengan $0 biaya egress bandwidth.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                  <Video className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-200">Muxing Audio Lossless</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Menjaga kualitas audio asli tersinkronisasi presisi frame demi frame dengan FFmpeg re-encoding.
                </p>
              </div>
            </div>
          </>
        ) : (
          /* History View */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-900 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-zinc-400" />
                  <span>Riwayat & Berkas Cloudflare R2</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Seluruh berkas terunggah dan hasil peningkatan video/gambar yang tersimpan aman di storage Anda.
                </p>
              </div>
            </div>

            <HistorySection onSelectForUpscale={handleSelectHistoryForUpscale} />
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-900/80 py-6 text-center text-xs text-zinc-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Realistic Video Upscaler • RunPod + Cloudflare R2 + Vercel</span>
          <span className="text-[11px] text-zinc-400">Monochrome UI • Photorealistic AI Engine</span>
        </div>
      </footer>
    </div>
  );
}

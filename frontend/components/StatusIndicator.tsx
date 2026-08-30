"use client";

import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Clock, XCircle, Cpu, CloudUpload, Sparkles } from "lucide-react";
import { JobStatusType } from "@/lib/runpod";

export type AppProcessStatus =
  | "IDLE"
  | "UPLOADING"
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

interface StatusIndicatorProps {
  status: AppProcessStatus;
  jobId?: string | null;
  errorMessage?: string | null;
  onCancel?: () => void;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  jobId,
  errorMessage,
  onCancel,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (status === "UPLOADING" || status === "IN_QUEUE" || status === "IN_PROGRESS") {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  if (status === "IDLE") return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const steps = [
    {
      id: "upload",
      title: "Upload Langsung ke R2",
      description: "Mengirimkan file ke storage Cloudflare R2",
      icon: CloudUpload,
      isDone: status !== "UPLOADING",
      isActive: status === "UPLOADING",
    },
    {
      id: "queue",
      title: "Antrean Serverless",
      description: "Mengalokasikan GPU worker RunPod",
      icon: Clock,
      isDone: status === "IN_PROGRESS" || status === "COMPLETED",
      isActive: status === "IN_QUEUE",
    },
    {
      id: "processing",
      title: "Super Resolusi AI",
      description: "Batch inference & rekonstruksi frame",
      icon: Cpu,
      isDone: status === "COMPLETED",
      isActive: status === "IN_PROGRESS",
    },
  ];

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-md shadow-lg space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status === "FAILED" ? (
            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400">
              <XCircle className="w-5 h-5" />
            </div>
          ) : status === "COMPLETED" ? (
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              {status === "UPLOADING" && "Mengunggah ke Cloudflare R2"}
              {status === "IN_QUEUE" && "Menunggu di Antrean RunPod"}
              {status === "IN_PROGRESS" && "Meningkatkan Resolusi & Detail Video"}
              {status === "COMPLETED" && "Peningkatan Resolusi Selesai!"}
              {status === "FAILED" && "Proses Gagal"}
            </h3>
            <p className="text-xs text-zinc-400">
              {jobId ? `Job ID: ${jobId.slice(0, 16)}...` : "Menyiapkan pipeline..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">
              Waktu Berjalan
            </span>
            <span className="text-xs font-mono text-zinc-300 font-semibold">
              {formatTime(elapsedSeconds)}
            </span>
          </div>

          {onCancel && (status === "IN_QUEUE" || status === "IN_PROGRESS") && (
            <button
              onClick={onCancel}
              className="text-xs text-zinc-400 hover:text-red-400 px-2.5 py-1 rounded-lg border border-zinc-800 hover:border-red-900 bg-zinc-950 transition-colors"
            >
              Batalkan
            </button>
          )}
        </div>
      </div>

      {/* Visual Step Timeline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border transition-all ${
                step.isActive
                  ? "bg-zinc-800/80 border-zinc-500 text-white shadow-sm"
                  : step.isDone
                  ? "bg-zinc-950/40 border-zinc-800 text-zinc-400"
                  : "bg-zinc-950/20 border-zinc-900 text-zinc-600 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon
                  className={`w-4 h-4 ${
                    step.isActive
                      ? "text-white animate-pulse"
                      : step.isDone
                      ? "text-emerald-400"
                      : "text-zinc-600"
                  }`}
                />
                <span className="text-xs font-medium">{step.title}</span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-1">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {status === "FAILED" && errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-900/60 text-red-300 text-xs">
          <span className="font-semibold block mb-0.5">Rincian Error:</span>
          <span className="font-mono">{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

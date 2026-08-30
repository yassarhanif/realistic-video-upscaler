"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  FolderOpen,
  Download,
  Copy,
  Check,
  Play,
  RotateCw,
  Search,
  Film,
  Image as ImageIcon,
  ArrowUpRight,
  Clock,
  HardDrive,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";

export interface HistoryItem {
  key: string;
  filename: string;
  publicUrl: string;
  size: number;
  sizeFormatted: string;
  lastModified: string;
  type: "video" | "image";
  category: "input" | "output";
}

interface HistorySectionProps {
  onSelectForUpscale?: (item: HistoryItem) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({ onSelectForUpscale }) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "output" | "input">("output");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<HistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (err) {
      console.error("Gagal memuat riwayat:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleCopy = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: itemToDelete.key }),
      });

      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((i) => i.key !== itemToDelete.key));
        if (previewItem?.key === itemToDelete.key) {
          setPreviewItem(null);
        }
        setItemToDelete(null);
      } else {
        alert(data.error || "Gagal menghapus berkas");
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      alert("Terjadi kesalahan koneksi saat menghapus berkas.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      filterType === "all" ? true : item.category === filterType;
    const matchesSearch =
      item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const outputCount = items.filter((i) => i.category === "output").length;
  const inputCount = items.filter((i) => i.category === "input").length;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Filter Tabs & Search & Refresh */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Filter Switcher */}
        <div className="inline-flex p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterType("output")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === "output"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            <span>Hasil Upscale</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300">
              {outputCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType("input")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === "input"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-zinc-300" />
            <span>File Asli Terunggah</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300">
              {inputCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === "all"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Semua</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300">
              {items.length}
            </span>
          </button>
        </div>

        {/* Right Search & Refresh */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama file..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
            />
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            title="Refresh Riwayat R2"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition active:scale-95"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-zinc-200" : ""}`} />
          </button>
        </div>
      </div>

      {/* Grid of History Cards */}
      {loading ? (
        <div className="py-16 text-center space-y-3 bg-zinc-950/40 border border-zinc-900 rounded-2xl">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-200 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-zinc-400">Memuat berkas dari Cloudflare R2...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center space-y-2 bg-zinc-950/40 border border-zinc-900 rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <HardDrive className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-zinc-300">Belum ada berkas dalam kategori ini</p>
          <p className="text-[11px] text-zinc-500">
            {filterType === "output"
              ? "Hasil super resolusi akan otomatis tersimpan di sini setelah proses selesai."
              : "Berkas yang Anda upload ke R2 akan muncul di sini."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => (
            <div
              key={item.key}
              className="group relative p-4 rounded-xl bg-zinc-950/60 hover:bg-zinc-900/60 border border-zinc-850 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-3.5 shadow-sm"
            >
              {/* Header: Icon + Category Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.category === "output"
                        ? "bg-zinc-900 text-white border border-zinc-700"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    {item.type === "video" ? (
                      <Film className="w-4 h-4" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4
                      className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white transition"
                      title={item.filename}
                    >
                      {item.filename}
                    </h4>
                    <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                      <span>{item.sizeFormatted}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDate(item.lastModified)}
                      </span>
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-md text-[9px] font-medium border uppercase tracking-wider flex-shrink-0 ${
                    item.category === "output"
                      ? "bg-zinc-900 text-zinc-200 border-zinc-700"
                      : "bg-zinc-900/60 text-zinc-400 border-zinc-800"
                  }`}
                >
                  {item.category === "output" ? "Hasil AI" : "Asli"}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-1.5">
                {/* Play / Preview */}
                <button
                  type="button"
                  onClick={() => setPreviewItem(item)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 hover:text-white transition active:scale-95"
                >
                  <Play className="w-3 h-3 text-zinc-400" />
                  <span>Putar</span>
                </button>

                {/* Direct Download */}
                <a
                  href={item.publicUrl}
                  download={item.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition active:scale-95"
                  title="Unduh Berkas"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>

                {/* Copy URL */}
                <button
                  type="button"
                  onClick={() => handleCopy(item.publicUrl, item.key)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition active:scale-95"
                  title="Salin Tautan R2"
                >
                  {copiedKey === item.key ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Re-upscale button for original input files */}
                {item.category === "input" && onSelectForUpscale && (
                  <button
                    type="button"
                    onClick={() => onSelectForUpscale(item)}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition active:scale-95"
                    title="Tingkatkan Lagi dengan AI"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => setItemToDelete(item)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/50 border border-zinc-800 hover:border-red-900/60 text-zinc-500 hover:text-red-400 transition active:scale-95"
                  title="Hapus Berkas dari R2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video / Image Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl space-y-3">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-900">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                    previewItem.category === "output"
                      ? "bg-zinc-900 text-white border-zinc-700"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800"
                  }`}
                >
                  {previewItem.category === "output" ? "Hasil AI 4K" : "Berkas Asli"}
                </span>
                <h3 className="text-xs font-semibold text-zinc-200 truncate">
                  {previewItem.filename}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewItem.publicUrl}
                  download={previewItem.filename}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setItemToDelete(previewItem);
                  }}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/50 border border-zinc-800 hover:border-red-900/60 text-zinc-400 hover:text-red-400 transition"
                  title="Hapus Berkas"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video / Image Player Body */}
            <div className="p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
              {previewItem.type === "video" ? (
                <video
                  src={previewItem.publicUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[65vh] w-auto max-w-full rounded-xl border border-zinc-800 shadow-lg object-contain bg-black"
                />
              ) : (
                <img
                  src={previewItem.publicUrl}
                  alt={previewItem.filename}
                  className="max-h-[65vh] w-auto max-w-full rounded-xl border border-zinc-800 shadow-lg object-contain"
                />
              )}
            </div>

            {/* Modal Footer Info */}
            <div className="px-4 py-3 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-400">
              <span className="truncate max-w-md">R2 Key: {previewItem.key}</span>
              <span>Ukuran: {previewItem.sizeFormatted} • {formatDate(previewItem.lastModified)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center justify-center text-red-400 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">Hapus Berkas dari Cloudflare R2?</h3>
                <p className="text-xs text-zinc-400 break-all leading-relaxed">
                  Berkas <span className="font-mono text-zinc-200">{itemToDelete.filename}</span> ({itemToDelete.sizeFormatted}) akan dihapus permanen dari penyimpanan storage Anda.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? "Menghapus..." : "Ya, Hapus"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

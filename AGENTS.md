# Realistic Video Upscaler: Master Plan & Architecture Guide (AGENTS.md)

Dokumen ini berisi cetak biru (*blueprint*) arsitektur, alur data, spesifikasi teknis, serta panduan langkah demi langkah untuk membangun aplikasi **Realistic Video & Image Upscaler** menggunakan:
- **Frontend & Orchestrator**: Next.js (App Router, Tailwind CSS) dideploy di **Vercel** (Desain minimalis, sleek, bersih, monokrom).
- **Object Storage**: **Cloudflare R2** ($0 egress bandwidth fee) dengan direct-to-storage presigned upload.
- **AI Processing Engine**: **RunPod Serverless** GPU worker berbasis **Real-ESRGAN** (model fotorealistik) + **GFPGAN** (face restoration).

---

## 1. Arsitektur Sistem & Alur Data

```
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|  1. Pilih File & Settings                                                         |
|  2. Minta Presigned URL  -----> [ Vercel API: /api/upload-url ]                   |
|  3. Upload Video Langsung ----> [ Cloudflare R2: input-videos/... ]               |
|  4. Trigger Job          -----> [ Vercel API: /api/upscale ]                      |
|  5. Polling Status       -----> [ Vercel API: /api/status ]                       |
|  6. Preview & Download   <----- [ Cloudflare R2: output-videos/... ]              |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                VERCEL (NEXT.JS)                                   |
|  - Generate R2 Presigned PUT URLs via S3 SDK                                      |
|  - Trigger RunPod Serverless Async Job (POST /v2/{endpoint_id}/run)               |
|  - Relay Job Status (GET /v2/{endpoint_id}/status/{job_id})                       |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             RUNPOD SERVERLESS (GPU)                               |
|  1. Download input video dari Cloudflare R2                                       |
|  2. Ekstrak frame gambar & audio stream menggunakan FFmpeg                        |
|  3. PyTorch Batch Upscale via Real-ESRGAN (RealESRGAN_x4plus / General-x4v3)      |
|  4. Face Restoration via GFPGAN (Opsional, jika wajah terdeteksi & diaktifkan)    |
|  5. Re-encode frame ke H.264 MP4 + muxing audio original via FFmpeg               |
|  6. Upload video hasil ke Cloudflare R2 & return output URL                       |
+-----------------------------------------------------------------------------------+
```

---

## 2. Struktur Proyek

Proyek ini dibagi menjadi dua bagian modular di dalam folder `desktop/upscale`:

```
desktop/upscale/
├── AGENTS.md                   # Dokumen master plan (file ini)
├── worker/                     # Komponen 1: RunPod Serverless Worker (Python/PyTorch/CUDA)
│   ├── Dockerfile              # Dockerfile dengan CUDA 12.4 + pre-baked realistic models
│   ├── handler.py              # Handler video & image upscale (FFmpeg + Real-ESRGAN + R2 upload)
│   ├── schemas/
│   │   └── input.py            # Validasi input schema RunPod
│   ├── start.sh                # Script startup container
│   ├── requirements.txt        # Dependencies (torch, torchvision, basicsr, gfpgan, boto3, ffmpeg-python)
│   └── test_input.json         # Contoh payload lokal untuk testing
└── frontend/                   # Komponen 2: Web App Next.js (Vercel)
    ├── package.json
    ├── tailwind.config.ts
    ├── next.config.mjs
    ├── .env.example
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx            # UI Utama: Minimalist dark/monochrome uploader, settings, & player
    │   ├── api/
    │   │   ├── upload-url/
    │   │   │   └── route.ts    # Generate Presigned PUT URL Cloudflare R2
    │   │   ├── upscale/
    │   │   │   └── route.ts    # Trigger async job RunPod (/run)
    │   │   └── status/
    │   │       └── route.ts    # Polling job status RunPod (/status/{id})
    │   └── globals.css
    ├── components/
    │   ├── VideoUploader.tsx   # Drag & drop upload area dengan progress bar
    │   ├── SettingsCard.tsx    # Setting: Scale (2x, 4x), Model, Face Enhance toggle
    │   ├── VideoPreview.tsx    # Video player sebelum & sesudah upscale
    │   └── StatusIndicator.tsx # Indikator status (Queued, Processing, Done)
    └── lib/
        ├── r2.ts               # Inisialisasi AWS S3 SDK untuk Cloudflare R2
        └── runpod.ts           # Helper client HTTP RunPod Serverless
```

---

## 3. Spesifikasi Teknis Komponen

### Komponen 1: RunPod Realistic Video Worker (`/worker`)

#### A. Model AI yang Digunakan:
1. **`RealESRGAN_x4plus`** (Utama - Realistis):
   - Model RRDBNet 64-block untuk foto dan video dunia nyata, mempertahankan tekstur alami.
2. **`RealESRGAN_x2plus`**:
   - Model 2x upscale cepat untuk footage resolusi sedang ke tinggi (misal 720p -> 1440p).
3. **`realesr-general-x4v3`** (Alternatif Realistis Cepat):
   - Arsitektur SRVGGNetCompact, inference lebih cepat dengan denoise control.
4. **`GFPGANv1.3`** (Face Restoration):
   - Mengembalikan detail mata, bibir, dan struktur wajah yang blur/pecah secara fotorealistik.

#### B. Pipeline Pemrosesan Video di `handler.py`:
1. **Download Video**: Mengambil video dari R2 URL atau presigned URL ke `/tmp/input.mp4`.
2. **Ekstraksi Metadata & Audio**:
   - Menggunakan FFmpeg untuk mengecek total frame, resolusi, FPS, dan ekstraksi audio stream ke `/tmp/audio.aac`.
3. **Frame Processing**:
   - Membaca frame per frame atau per batch (batch size 4-8 tergantung VRAM).
   - Memproses upscale via Real-ESRGAN di CUDA.
   - Jika `face_enhance=True`, jalankan GFPGAN pada frame.
4. **Re-encoding**:
   - Mengirim frame hasil langsung ke pipa FFmpeg (`ffmpeg -f rawvideo -pix_fmt bgr24 ... -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p`).
   - Muxing kembali file audio asli.
5. **Upload ke R2**:
   - Mengunggah output `.mp4` ke Cloudflare R2 menggunakan `boto3`.
   - Mengembalikan URL download public / presigned.

---

### Komponen 2: Cloudflare R2 Storage Setup

1. **Bucket Name**: `video-upscaler` (atau nama pilihan Anda).
2. **CORS Configuration**:
   Wajib dikonfigurasi agar browser frontend dapat melakukan HTTP PUT langsung ke R2:
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
3. **R2 API Credentials**:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `R2_PUBLIC_DOMAIN` (misal: `https://pub-xxxx.r2.dev` atau custom domain)

---

### Komponen 3: Vercel Frontend (`/frontend`)

1. **Desain UI/UX**:
   - **Gaya**: Minimalis, monokrom / dark mode elegan (zinc/neutral palette), tipografi modern, bersih tanpa warna mencolok.
   - **Komponen Utama**:
     - *Hero Area*: Judul bersih + subtitle ringkas.
     - *Upload Dropzone*: Drag-and-drop file video (MP4/MOV/WebM) dengan progress bar langsung ke R2.
     - *Settings Panel*:
       - Scale: `2x` atau `4x` (Pill switcher).
       - Model: `RealESRGAN_x4plus (Realistic General)` atau `realesr-general-x4v3 (Fast Realistic)`.
       - Toggle Switch: `Face Enhancement (GFPGAN)` untuk mempertajam wajah.
     - *Processing State*: Visual progress bar + indikator teks (*Uploading -> In Queue -> Upscaling Frames -> Finalizing Video*).
     - *Result Area*: Clean comparison / video player + tombol **Download Upscaled Video**.

2. **API Routes di Next.js**:
   - `POST /api/upload-url`:
     - Input: `{ filename: string, contentType: string }`
     - Logic: Panggil AWS S3 SDK `@aws-sdk/s3-request-presigner` dengan endpoint Cloudflare R2.
     - Output: `{ uploadUrl: string, fileKey: string, publicUrl: string }`
   - `POST /api/upscale`:
     - Input: `{ fileKey: string, scale: number, model: string, faceEnhance: boolean }`
     - Logic: Kirim payload ke endpoint RunPod Serverless `https://api.runpod.ai/v2/{ENDPOINT_ID}/run`.
     - Output: `{ jobId: string }`
   - `GET /api/status?jobId=xxx`:
     - Input: `jobId`
     - Logic: Cek status ke `https://api.runpod.ai/v2/{ENDPOINT_ID}/status/{jobId}`.
     - Output: `{ status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED", outputUrl?: string, error?: string }`

---

## 4. Panduan Eksekusi Langkah demi Langkah

### Langkah 1: Persiapan Cloudflare R2 (Lewat Web Dashboard)
1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) -> Masuk ke menu **R2**.
2. Klik **Create Bucket**, beri nama: `video-upscaler`.
3. Di dalam Settings Bucket:
   - Aktifkan **Public Access** (atau hubungkan Custom Domain) untuk URL streaming video hasil.
   - Buka tab **CORS Policy**, tempelkan konfigurasi CORS JSON di atas.
4. Buka **R2 -> Manage R2 API Tokens** -> Klik **Create API Token**:
   - Beri izin: `Object Read & Write`.
   - Simpan: `Access Key ID`, `Secret Access Key`, dan `Account ID`.

---

### Langkah 2: Build & Deploy RunPod Worker
1. Masuk ke direktori `worker/`.
2. Build Docker Image (ganti `username` dengan akun Docker Hub Anda):
   ```bash
   docker build -t username/runpod-worker-realistic-video:v1 .
   docker push username/runpod-worker-realistic-video:v1
   ```
3. Buka [RunPod Dashboard](https://www.runpod.io/console/serverless):
   - Masuk ke **Serverless** -> **Templates** -> **New Template**.
   - Masukkan Container Image: `username/runpod-worker-realistic-video:v1`.
   - Masukkan Environment Variables:
     - `R2_ACCOUNT_ID` = `...`
     - `R2_ACCESS_KEY_ID` = `...`
     - `R2_SECRET_ACCESS_KEY` = `...`
     - `R2_BUCKET_NAME` = `video-upscaler`
     - `R2_PUBLIC_DOMAIN` = `https://pub-xxxx.r2.dev`
   - Simpan Template.
4. Buat **Serverless Endpoint**:
   - Pilih Template yang baru dibuat.
   - Pilih GPU (Rekomendasi: **NVIDIA RTX 4090** atau **A5000** untuk rasio kecepatan & harga terbaik).
   - Set `Min Workers = 0` (agar $0 saat idle).
   - Set `Max Workers = 3` (atau sesuai kebutuhan).
   - Simpan dan catat **Endpoint ID** (misal: `abc123xyz`).

---

### Langkah 3: Setup & Deploy Frontend ke Vercel
1. Masuk ke direktori `frontend/`.
2. Buat file `.env.local`:
   ```env
   # Cloudflare R2
   R2_ACCOUNT_ID="your-cloudflare-account-id"
   R2_ACCESS_KEY_ID="your-r2-access-key-id"
   R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
   R2_BUCKET_NAME="video-upscaler"
   NEXT_PUBLIC_R2_PUBLIC_DOMAIN="https://pub-xxxx.r2.dev"

   # RunPod Serverless
   RUNPOD_API_KEY="your-runpod-api-key"
   RUNPOD_ENDPOINT_ID="your-runpod-endpoint-id"
   ```
3. Jalankan pengujian lokal:
   ```bash
   npm install
   npm run dev
   ```
4. Deploy ke Vercel:
   ```bash
   npx vercel
   # Atau push ke GitHub repo dan import di Vercel Dashboard
   ```
   *Pastikan semua Environment Variables di atas dimasukkan ke tab Environment Variables di Vercel Dashboard.*

---

## 5. Estimasi Biaya & Efisiensi

- **Vercel**: Gratis (Hobby Tier) – karena file video tidak melewati server Vercel (direct-to-R2 upload).
- **Cloudflare R2**: Gratis 10GB storage/bulan, **$0 Egress Bandwidth** (bebas streaming/download).
- **RunPod Serverless**: Hanya bayar per detik komputasi GPU (~$0.0002/detik di RTX 4090 = sekitar Rp 300 - Rp 600 per 10 detik video).
- **Idle Cost**: **$0.00** saat tidak ada antrean.

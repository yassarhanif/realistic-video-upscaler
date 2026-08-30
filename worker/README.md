# Panduan Deploy RunPod Serverless Realistic Video Worker

Dokumen ini berisi panduan praktis untuk melakukan build Docker image worker dan menyiapkannya di RunPod Serverless dengan biaya $0 saat idle (`Min Workers = 0`).

---

## 1. Persiapan Akun & Alat
1. **Docker Hub**: Akun gratis di [hub.docker.com](https://hub.docker.com/) untuk menyimpan image container.
2. **RunPod**: Akun di [runpod.io/console/serverless](https://www.runpod.io/console/serverless).
3. **Cloudflare R2**: Bucket R2 yang sudah dibuat beserta Access Key.

---

## 2. Build & Push Docker Image

Jalankan perintah berikut di komputer Anda yang terinstal Docker (atau gunakan GitHub Actions / cloud build):

```bash
cd worker

# 1. Login ke Docker Hub
docker login

# 2. Build Docker image (ganti 'username_docker' dengan username Docker Hub Anda)
docker build -t username_docker/runpod-worker-realistic-video:v1 .

# 3. Push image ke Docker Hub
docker push username_docker/runpod-worker-realistic-video:v1
```

*Catatan: Model weights AI (`RealESRGAN_x4plus`, `RealESRGAN_x2plus`, `realesr-general-x4v3`, `GFPGANv1.3`) sudah otomatis di-download ke dalam image saat proses `docker build`, sehingga GPU RunPod tidak perlu download ulang setiap kali start.*

---

## 3. Konfigurasi di Dashboard RunPod

### Langkah A: Buat Template Serverless
1. Buka **[RunPod Serverless Templates](https://www.runpod.io/console/serverless/user/templates)**.
2. Klik **New Template**.
3. Isi kolom:
   - **Template Name**: `realistic-video-upscaler`
   - **Container Image**: `username_docker/runpod-worker-realistic-video:v1`
   - **Container Disk**: `20 GB` (cukup untuk cache video sementara)
4. Tambahkan **Environment Variables**:
   - `R2_ACCOUNT_ID`: `[Account ID Cloudflare Anda]`
   - `R2_ACCESS_KEY_ID`: `[Access Key ID R2 Anda]`
   - `R2_SECRET_ACCESS_KEY`: `[Secret Access Key R2 Anda]`
   - `R2_BUCKET_NAME`: `video-upscaler`
   - `R2_PUBLIC_DOMAIN`: `https://pub-xxxx.r2.dev` (atau custom domain Anda)
5. Klik **Save Template**.

---

### Langkah B: Buat Serverless Endpoint
1. Buka menu **[RunPod Serverless Endpoints](https://www.runpod.io/console/serverless)**.
2. Klik **New Endpoint**.
3. Isi parameter:
   - **Endpoint Name**: `video-upscaler-endpoint`
   - **Select Template**: Pilih `realistic-video-upscaler` yang baru dibuat.
   - **GPU Type**: Pilih **NVIDIA RTX 4090** (24GB VRAM) atau **RTX A5000** (sangat cepat & hemat).
   - **Active Workers (Min)**: Set ke **`0`** ⚠️ *(Wajib 0 agar $0 biaya saat tidak ada antrean)*.
   - **Max Workers**: Set ke **`2`** atau **`3`**.
   - **Idle Timeout**: Set ke **`5`** detik (agar worker langsung mati setelah selesai).
4. Klik **Deploy**.
5. Salin **Endpoint ID** (misal: `abc123xyz`).

---

## 4. Hubungkan Endpoint ID ke Frontend Next.js

Buka file `frontend/.env.local` dan masukkan:

```env
# RunPod Serverless
RUNPOD_API_KEY="rpa_xxxxxxxxxxxxxxxxxxxx"
RUNPOD_ENDPOINT_ID="abc123xyz"
```

Aplikasi web Next.js Anda kini siap memicu proses super-resolusi video AI secara langsung dan otomatis!

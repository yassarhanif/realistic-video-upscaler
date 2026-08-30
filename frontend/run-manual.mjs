import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Parse .env.local if exists
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [k, ...v] = trimmed.split("=");
      if (k && v) {
        process.env[k.trim()] = v.join("=").replace(/(^"|"$)/g, "").trim();
      }
    }
  });
}

const accountId = process.env.R2_ACCOUNT_ID || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
const bucketName = process.env.R2_BUCKET_NAME || "upscale";
const publicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || "";

const apiKey = process.env.RUNPOD_API_KEY || "";
const endpointId = process.env.RUNPOD_ENDPOINT_ID || "mz6vsspa14jmpx";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

async function main() {
  const filePath = "../vid_contoh.mp4";
  if (!fs.existsSync(filePath)) {
    console.error("File vid_contoh.mp4 not found!");
    process.exit(1);
  }

  const fileStats = fs.statSync(filePath);
  const fileKey = `input-videos/${Date.now()}_vid_contoh.mp4`;
  const fileUrl = `${publicDomain}/${fileKey}`;

  console.log(`[1/3] Mengunggah ${filePath} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB) ke Cloudflare R2...`);

  const fileStream = fs.createReadStream(filePath);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: fileStream,
      ContentType: "video/mp4",
    })
  );

  console.log(`✓ Terunggah ke R2: ${fileUrl}`);

  console.log(`\n[2/3] Memicu RunPod Serverless Job di endpoint ${endpointId}...`);
  const runPayload = {
    input: {
      file_key: fileKey,
      video_url: fileUrl,
      scale: 4,
      model_name: "SeedVR_2_5",
      face_enhance: false,
      denoise_strength: 0.5,
    },
  };

  const runRes = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(runPayload),
  });

  if (!runRes.ok) {
    const errText = await runRes.text();
    console.error("Gagal trigger RunPod:", errText);
    process.exit(1);
  }

  const runData = await runRes.json();
  const jobId = runData.id;
  console.log(`✓ Job ID RunPod berhasil dibuat: ${jobId}`);

  const startTime = Date.now();
  const MAX_RUNTIME_SECONDS = 3600; // 1 hour max for 4x upscaling to 5K resolution

  const pollInterval = setInterval(async () => {
    try {
      const statusRes = await fetch(`https://api.runpod.ai/v2/${endpointId}/status/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const statusData = await statusRes.json();
      const elapsed = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

      console.log(`[+${elapsed.toFixed(1)}s] Status: ${statusData.status} | Worker: ${statusData.workerId || 'In Queue'}`);

      // Auto-cancel watchdog to protect credits on hung jobs
      if (elapsed > MAX_RUNTIME_SECONDS && statusData.status === "IN_PROGRESS") {
        console.warn(`\n⚠️ SAFETY WATCHDOG: Batas waktu proteksi (${MAX_RUNTIME_SECONDS} detik) tercapai. Membatalkan job otomatis untuk mengamankan saldo kredit...`);
        await fetch(`https://api.runpod.ai/v2/${endpointId}/cancel/${jobId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        clearInterval(pollInterval);
        process.exit(1);
      }

      if (statusData.status === "COMPLETED") {
        clearInterval(pollInterval);
        console.log("\n=======================================================");
        console.log("🎉 PROSES AI SUPER RESOLUSI SELESAI DENGAN SUKSES!");
        console.log("=======================================================");
        console.log("Output Details:", statusData.output);
        console.log(`Total Waktu Eksekusi GPU: ${elapsed} detik`);
        console.log(`URL Video Hasil: ${statusData.output?.output_url}`);
      } else if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(statusData.status)) {
        clearInterval(pollInterval);
        console.error("\n❌ PROSES GAGAL / DIBATALKAN:", statusData.error || statusData);
        process.exit(1);
      }
    } catch (e) {
      console.error("Polling error:", e.message);
    }
  }, 2200);
}

main().catch(console.error);

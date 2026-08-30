import { NextRequest, NextResponse } from "next/server";
import { triggerRunPodJob } from "@/lib/runpod";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fileKey,
      videoUrl,
      scale = 4,
      modelName = "SeedVR2_3B",
      denoiseStrength = 0.25,
      batchSize = 9,
      uniformBatchSize = true,
      colorCorrection = "lab",
      inputNoiseScale = 0.0,
      latentNoiseScale = 0.0,
      resolution = 1080,
      maxResolution = 0,
      attentionMode = "sdpa",
    } = body;

    if (!fileKey && !videoUrl) {
      return NextResponse.json(
        { error: "Either fileKey or videoUrl is required" },
        { status: 400 }
      );
    }

    const payload = {
      video_url: videoUrl,
      file_key: fileKey,
      scale: Number(scale) || 4,
      outscale: Number(scale) || 4,
      model_name: modelName,
      denoise_strength: Number(denoiseStrength),
      batch_size: Number(batchSize) || 9,
      uniform_batch_size: Boolean(uniformBatchSize),
      color_correction: String(colorCorrection),
      input_noise_scale: Number(inputNoiseScale) || 0.0,
      latent_noise_scale: Number(latentNoiseScale) || 0.0,
      resolution: Number(resolution) || 1080,
      max_resolution: Number(maxResolution) || 0,
      attention_mode: String(attentionMode),
    };

    const runpodResponse = await triggerRunPodJob(payload);

    return NextResponse.json({
      jobId: runpodResponse.id,
      status: runpodResponse.status,
    });
  } catch (error: any) {
    console.error("Error triggering upscale job:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger upscale job" },
      { status: 500 }
    );
  }
}

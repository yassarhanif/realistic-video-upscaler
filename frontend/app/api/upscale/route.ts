import { NextRequest, NextResponse } from "next/server";
import { triggerRunPodJob } from "@/lib/runpod";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fileKey,
      videoUrl,
      scale = 4,
      modelName = "RealESRGAN_x4plus",
      faceEnhance = false,
      denoiseStrength = 0.5,
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
      face_enhance: Boolean(faceEnhance),
      denoise_strength: Number(denoiseStrength),
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

import { NextRequest, NextResponse } from "next/server";
import { getRunPodJobStatus } from "@/lib/runpod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId query parameter is required" },
        { status: 400 }
      );
    }

    const jobData = await getRunPodJobStatus(jobId);

    // Standardize response for the frontend
    let outputUrl = jobData.output?.output_url;
    
    // If output only contains file_key, construct with public domain if available
    if (!outputUrl && jobData.output?.file_key && process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN) {
      const domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN.replace(/\/+$/, "");
      outputUrl = `${domain}/${jobData.output.file_key}`;
    }

    return NextResponse.json({
      id: jobData.id,
      status: jobData.status,
      outputUrl: outputUrl || null,
      output: jobData.output,
      error: jobData.error,
      delayTime: jobData.delayTime,
      executionTime: jobData.executionTime,
    });
  } catch (error: any) {
    console.error("Error checking job status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve job status" },
      { status: 500 }
    );
  }
}

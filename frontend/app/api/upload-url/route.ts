import { NextRequest, NextResponse } from "next/server";
import { createPresignedUploadUrl } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, contentType } = body;

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    const type = contentType || "video/mp4";
    const result = await createPresignedUploadUrl(filename, type);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error creating presigned URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate presigned upload URL" },
      { status: 500 }
    );
  }
}

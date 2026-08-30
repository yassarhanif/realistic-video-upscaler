import { NextRequest, NextResponse } from "next/server";
import { listR2Objects, deleteR2Object, R2ObjectItem } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all"; // "all" | "inputs" | "outputs"

    let items: R2ObjectItem[] = [];

    if (type === "inputs") {
      const videoInputs = await listR2Objects("input-videos/", 100);
      const imageInputs = await listR2Objects("input-images/", 100);
      items = [...videoInputs, ...imageInputs];
    } else if (type === "outputs") {
      const videoOutputs = await listR2Objects("output-videos/", 100);
      const imageOutputs = await listR2Objects("output-images/", 100);
      items = [...videoOutputs, ...imageOutputs];
    } else {
      const [vIn, iIn, vOut, iOut] = await Promise.all([
        listR2Objects("input-videos/", 100),
        listR2Objects("input-images/", 100),
        listR2Objects("output-videos/", 100),
        listR2Objects("output-images/", 100),
      ]);
      items = [...vOut, ...iOut, ...vIn, ...iIn];
    }

    // Sort by last modified descending
    items.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return NextResponse.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error: any) {
    console.error("Error in GET /api/history:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat riwayat berkas dari R2" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { success: false, error: "Parameter 'key' wajib diisi" },
        { status: 400 }
      );
    }

    // Security check: Only allow deleting objects inside input-* or output-*
    if (!key.startsWith("input-") && !key.startsWith("output-")) {
      return NextResponse.json(
        { success: false, error: "Akses ditolak: Key tidak valid" },
        { status: 403 }
      );
    }

    await deleteR2Object(key);

    return NextResponse.json({
      success: true,
      message: `Berkas ${key} berhasil dihapus dari Cloudflare R2`,
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/history:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus berkas dari R2" },
      { status: 500 }
    );
  }
}


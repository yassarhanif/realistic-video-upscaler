import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
const bucketName = process.env.R2_BUCKET_NAME || "upscale";
const publicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || "";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export interface PresignedUrlResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

export interface R2ObjectItem {
  key: string;
  filename: string;
  publicUrl: string;
  size: number;
  sizeFormatted: string;
  lastModified: string;
  type: "video" | "image";
  category: "input" | "output";
}

/**
 * Format bytes to readable size (e.g. 3.2 MB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Generate a presigned PUT URL for direct browser upload to Cloudflare R2
 */
export async function createPresignedUploadUrl(
  filename: string,
  contentType: string,
  prefix: string = "input-videos"
): Promise<PresignedUrlResult> {
  const timestamp = Date.now();
  const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileKey = `${prefix}/${timestamp}_${sanitizedName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    ContentType: contentType,
  });

  // URL valid for 30 minutes
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 1800 });

  const cleanDomain = publicDomain.replace(/\/+$/, "");
  const publicUrl = cleanDomain ? `${cleanDomain}/${fileKey}` : fileKey;

  return {
    uploadUrl,
    fileKey,
    publicUrl,
  };
}

/**
 * Generate a presigned GET URL for downloading private assets if public domain is not configured
 */
export async function createPresignedDownloadUrl(fileKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  });
  return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

/**
 * List objects from Cloudflare R2 with metadata and formatted public URLs
 */
export async function listR2Objects(prefix: string = "", maxKeys: number = 100): Promise<R2ObjectItem[]> {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await r2Client.send(command);
  const cleanDomain = publicDomain.replace(/\/+$/, "");

  if (!response.Contents) return [];

  const items: R2ObjectItem[] = response.Contents.filter((obj) => obj.Key && obj.Size && obj.Size > 0).map((obj) => {
    const key = obj.Key!;
    const size = obj.Size || 0;
    const lastModified = obj.LastModified ? obj.LastModified.toISOString() : new Date().toISOString();
    const publicUrl = cleanDomain ? `${cleanDomain}/${key}` : key;

    const parts = key.split("/");
    const rawFilename = parts[parts.length - 1];
    // Remove timestamp prefix if present (e.g. 1788063220327_name.mp4)
    const filename = rawFilename.replace(/^\d+_/, "");

    const isVideo = key.endsWith(".mp4") || key.endsWith(".mov") || key.endsWith(".webm") || key.startsWith("input-videos") || key.startsWith("output-videos");
    const isOutput = key.startsWith("output-");

    return {
      key,
      filename,
      publicUrl,
      size,
      sizeFormatted: formatBytes(size),
      lastModified,
      type: isVideo ? "video" : "image",
      category: isOutput ? "output" : "input",
    };
  });

  // Sort descending by last modified (newest first)
  items.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

  return items;
}

/**
 * Delete an object from Cloudflare R2 bucket
 */
export async function deleteR2Object(fileKey: string): Promise<boolean> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  });

  await r2Client.send(command);
  return true;
}



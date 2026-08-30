import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
const bucketName = process.env.R2_BUCKET_NAME || "video-upscaler";
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

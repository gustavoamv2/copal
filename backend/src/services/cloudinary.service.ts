import { v2 as cloudinary } from "cloudinary";
import { config } from "../config";

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

interface UploadResult {
  secure_url: string;
  public_id: string;
  thumbnail_url?: string;
}

export async function uploadToCloudinary(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<UploadResult> {
  const resourceType = mimeType.startsWith("video/") ? "video" : "image";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: "copal",
        use_filename: true,
        unique_filename: true,
        eager: resourceType === "image" ? [{ width: 400, height: 400, crop: "fill" }] : undefined,
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          thumbnail_url: result.eager?.[0]?.secure_url,
        });
      }
    );
    stream.end(buffer);
  });
}

export async function deleteFromCloudinary(storageUrl: string): Promise<void> {
  // Extract public_id from URL
  const parts = storageUrl.split("/");
  const uploadIdx = parts.indexOf("upload");
  if (uploadIdx === -1) return;
  const publicIdWithExt = parts.slice(uploadIdx + 2).join("/");
  const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");
  await cloudinary.uploader.destroy(publicId);
}

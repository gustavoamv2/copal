import multer from "multer";
import { Request } from "express";
import { createError } from "./error.middleware";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const storage = multer.memoryStorage();

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(createError(`File type ${file.mimetype} is not allowed`, 400));
    return;
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

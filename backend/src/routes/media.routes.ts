import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";
import { uploadToCloudinary, deleteFromCloudinary } from "../services/cloudinary.service";
import { createError } from "../middleware/error.middleware";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const { type, page = "1", limit = "30", tag } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      user_id: req.user!.sub,
      ...(type ? { file_type: { startsWith: type } } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    };

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { uploaded_at: "desc" },
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    res.json({ data: assets, total });
  } catch (err) {
    next(err);
  }
});

router.post("/upload", upload.single("file"), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) throw createError("No file provided", 400);

    const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype, req.file.originalname);

    const tags: string[] = req.body.tags
      ? (req.body.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean)
      : [];

    const asset = await prisma.mediaAsset.create({
      data: {
        user_id: req.user!.sub,
        filename: req.file.originalname,
        file_type: req.file.mimetype,
        storage_url: result.secure_url,
        thumbnail_url: result.thumbnail_url ?? null,
        file_size_bytes: req.file.size,
        tags,
      },
    });

    res.status(201).json(asset);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: req.params.id, user_id: req.user!.sub },
    });
    if (!asset) throw createError("Asset not found", 404);

    await deleteFromCloudinary(asset.storage_url);
    await prisma.mediaAsset.delete({ where: { id: req.params.id } });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

// src/routes/social.routes.ts
// Agregar a tu router principal: app.use('/api/social', socialRouter)

import { Router, Response } from 'express';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ayrshareService, SocialPlatform } from '../services/ayrshare.service';
import type { SocialPublishJobData } from '../workers/social-publish.job';
import { prisma } from '../prisma';
import { config } from '../config';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

// Cola BullMQ para publicación asíncrona
const socialQueue = new Queue<SocialPublishJobData>('social-publish', { connection });

const VALID_PLATFORMS: SocialPlatform[] = ['facebook', 'linkedin', 'instagram'];

router.use(requireAuth);

// ─────────────────────────────────────────────
// POST /api/social/publish
// Publica inmediatamente en redes sociales
// ─────────────────────────────────────────────
router.post('/publish', async (req: AuthRequest, res: Response) => {
  const { content, platforms, mediaUrls, instagramType, accounts } = req.body;
  const userId = req.user!.sub;

  // Validaciones
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'El contenido del post es requerido' });
  }

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: 'Debes seleccionar al menos una plataforma' });
  }

  const invalidPlatforms = platforms.filter(p => !VALID_PLATFORMS.includes(p));
  if (invalidPlatforms.length > 0) {
    return res.status(400).json({
      error: `Plataformas inválidas: ${invalidPlatforms.join(', ')}. Válidas: ${VALID_PLATFORMS.join(', ')}`,
    });
  }

  try {
    // Crear registro Post en BD para tracking de métricas
    const dbPost = await prisma.post.create({
      data: {
        user_id: userId,
        title: content.trim().slice(0, 80) || 'Sin título',
        base_caption: content.trim(),
        status: 'pending',
        scheduled_at: null,
      },
    });

    const job = await socialQueue.add(
      'publish-now',
      {
        postId: `post_${Date.now()}`,
        dbPostId: dbPost.id,
        content: content.trim(),
        platforms,
        mediaUrls: mediaUrls || [],
        instagramType: instagramType || 'feed',
        userId,
        accounts: accounts || undefined,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    return res.status(202).json({
      message: 'Post encolado para publicación',
      jobId: job.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ error: message });
  }
});

// ─────────────────────────────────────────────
// POST /api/social/schedule
// Programa un post para publicarse en el futuro
// ─────────────────────────────────────────────
router.post('/schedule', async (req: AuthRequest, res: Response) => {
  const { content, platforms, mediaUrls, scheduledAt } = req.body;
  const userId = req.user!.sub;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'El contenido del post es requerido' });
  }

  if (!scheduledAt || isNaN(Date.parse(scheduledAt))) {
    return res.status(400).json({ error: 'scheduledAt debe ser una fecha válida en formato ISO 8601' });
  }

  const scheduleDate = new Date(scheduledAt);
  if (scheduleDate <= new Date()) {
    return res.status(400).json({ error: 'La fecha programada debe ser en el futuro' });
  }

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: 'Debes seleccionar al menos una plataforma' });
  }

  try {
    const delay = scheduleDate.getTime() - Date.now();

    const job = await socialQueue.add(
      'publish-scheduled',
      {
        postId: `post_${Date.now()}`,
        content: content.trim(),
        platforms,
        mediaUrls: mediaUrls || [],
        scheduledAt,
        userId,
      },
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    return res.status(202).json({
      message: 'Post programado exitosamente',
      jobId: job.id,
      scheduledAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ error: message });
  }
});

// ─────────────────────────────────────────────
// GET /api/social/history
// Obtiene historial de posts publicados
// ─────────────────────────────────────────────
router.get('/history', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await ayrshareService.getHistory(20);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.json({ posts: result.posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ error: message });
  }
});

// ─────────────────────────────────────────────
// GET /api/social/job/:jobId
// Consulta el estado de un job en BullMQ
// ─────────────────────────────────────────────
router.get('/job/:jobId', async (req: AuthRequest, res: Response) => {
  try {
    const job = await socialQueue.getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job no encontrado' });
    }

    const state = await job.getState();
    return res.json({
      jobId: job.id,
      state,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ error: message });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/social/post/:postId
// Elimina un post publicado en Zernio
// ─────────────────────────────────────────────
router.delete('/post/:postId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await ayrshareService.deletePost(req.params.postId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.json({ message: 'Post eliminado exitosamente' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ error: message });
  }
});

export default router;

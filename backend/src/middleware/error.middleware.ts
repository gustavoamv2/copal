import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.statusCode ?? 500;
  const message = status < 500 ? err.message : "Internal server error";

  if (status >= 500) {
    console.error("[ERROR]", err);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" && status >= 500 ? { detail: err.message } : {}),
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Route not found" });
}

export function createError(message: string, statusCode: number): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  return err;
}

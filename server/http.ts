import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);
export const conflict = (message: string) => new HttpError(409, message);

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path.join('.');
    throw badRequest(field ? `${field}: ${first.message}` : (first?.message ?? 'Invalid request'), result.error.flatten());
  }
  return result.data;
}

/** Express 4 does not forward rejected promises, so async handlers go through this. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Invalid request', details: err.flatten() });
  }
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error('[http] unhandled error', err);
  res.status(500).json({ error: 'Something went wrong on our side' });
}

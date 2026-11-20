import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as Request['query'];
    next();
  };
}
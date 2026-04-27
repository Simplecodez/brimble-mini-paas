import { NextFunction, Request, Response } from "express";

export const catchAsync = (
  func: (
    req: Request,
    res: Response,
    next?: NextFunction,
  ) => Promise<Record<string, any> | null>,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await func(req, res, next);

      res.json(result);
    } catch (err) {
      next(err);
    }
  };
};

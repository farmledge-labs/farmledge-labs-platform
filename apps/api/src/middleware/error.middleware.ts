import { Request, Response, NextFunction } from 'express'

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(err.stack)
  res.status(500).json({ success: false, error: 'Something went wrong' })
}

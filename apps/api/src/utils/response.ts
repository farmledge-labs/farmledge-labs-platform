import { Response } from 'express'
import { ApiResponse } from '../types.js'

export const ok = <T>(res: Response, data: T, message?: string) =>
  res.status(200).json({ success: true, data, message } as ApiResponse<T>)

export const created = <T>(res: Response, data: T) =>
  res.status(201).json({ success: true, data } as ApiResponse<T>)

export const badRequest = (res: Response, error: string) =>
  res.status(400).json({ success: false, error } as ApiResponse<undefined>)

export const unauthorized = (res: Response) =>
  res.status(401).json({ success: false, error: 'Unauthorized' } as ApiResponse<undefined>)

export const notFound = (res: Response, error: string) =>
  res.status(404).json({ success: false, error } as ApiResponse<undefined>)

export const serverError = (res: Response, error: string) =>
  res.status(500).json({ success: false, error } as ApiResponse<undefined>)

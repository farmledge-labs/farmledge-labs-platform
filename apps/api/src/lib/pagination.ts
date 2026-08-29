import type { Request } from 'express'

export interface Pagination {
  page: number
  limit: number
  offset: number
}

export interface CursorPagination {
  cursor: string | null
  limit: number
}

export function getPagination(req: Request): Pagination {
  const page = Math.max(
    1,
    Number.parseInt(String(req.query.page ?? '1'), 10) || 1
  )

  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(String(req.query.limit ?? '20'), 10) || 20
    )
  )

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  }
}

export function paginationMeta(
  page: number,
  limit: number,
  total: number
) {
  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
  }
}

export function getCursorPagination(req: Request): CursorPagination {
  const rawLimit = Number.parseInt(
    String(req.query.limit ?? '20'),
    10
  )

  const limit = Math.min(
    100,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 20)
  )

  const cursor =
    typeof req.query.cursor === 'string' && req.query.cursor.trim().length > 0
      ? req.query.cursor.trim()
      : null

  return {
    cursor,
    limit,
  }
}

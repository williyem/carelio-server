export interface PaginatedResult<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

export function buildPaginatedResult<T>(
  docs: T[],
  totalDocs: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(totalDocs / safeLimit) || 1);
  const hasPrevPage = safePage > 1;
  const hasNextPage = safePage < totalPages;

  return {
    docs,
    totalDocs,
    limit: safeLimit,
    totalPages,
    page: safePage,
    pagingCounter: (safePage - 1) * safeLimit + 1,
    hasPrevPage,
    hasNextPage,
    prevPage: hasPrevPage ? safePage - 1 : null,
    nextPage: hasNextPage ? safePage + 1 : null,
  };
}

export function parsePagination(query: {
  page?: unknown;
  limit?: unknown;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

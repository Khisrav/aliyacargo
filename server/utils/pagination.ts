import { createError } from 'h3'

/** PostgREST caps every response at 1000 rows, whatever `.limit()` asks for. */
export const PAGE_SIZE = 1000
const MAX_PAGES = 100

type PageResult<T> = PromiseLike<{ data: T[] | null, error: { message: string } | null }>

/**
 * Read every row a query matches, one page at a time. The query must select `id`
 * and order by it (or another unique key) so pages do not overlap.
 */
export async function fetchAllPages<T extends { id?: number | string }>(load: (from: number, to: number) => PageResult<T>) {
  const rows: T[] = []
  let previousFirstId: number | null = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await load(from, from + PAGE_SIZE - 1)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const batch = data ?? []
    if (!batch.length) break

    const firstId = Number(batch[0]?.id)
    if (previousFirstId != null && firstId === previousFirstId) break
    if (Number.isFinite(firstId)) previousFirstId = firstId

    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  return rows
}

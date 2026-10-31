/** Preserve input order while limiting parallel requests; stop scheduling after cancellation. */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  map: (item: T) => Promise<R>,
  isActive = () => true,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError('Concurrency must be a positive integer')
  const result: R[] = new Array(items.length)
  let next = 0
  let failed = false
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (!failed && isActive()) {
        const index = next++
        if (index >= items.length) return
        try {
          result[index] = await map(items[index])
        } catch (error) {
          failed = true
          throw error
        }
      }
    }),
  )
  return result
}

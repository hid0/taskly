import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  if (id === 'uncategorized') {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete uncategorized' })
  }

  // Kembalikan item yang memakai kategori ini ke 'uncategorized'
  await db
    .update(schema.dailyItems)
    .set({ categoryId: 'uncategorized' })
    .where(eq(schema.dailyItems.categoryId, id))

  await db.delete(schema.categories).where(eq(schema.categories.id, id))

  return { success: true }
})

import { eq, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  await db
    .delete(schema.dailyItems)
    .where(or(eq(schema.dailyItems.id, id), eq(schema.dailyItems.parentId, id)))

  return { success: true }
})

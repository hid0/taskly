import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const updateData: Record<string, any> = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.type !== undefined) updateData.type = body.type
  if (body.isCompleted !== undefined) updateData.isCompleted = body.isCompleted ? 1 : 0
  if (body.categoryId !== undefined) updateData.categoryId = body.categoryId
  if (body.estimatedSessions !== undefined) updateData.estimatedSessions = body.estimatedSessions
  if (body.completedSessions !== undefined) updateData.completedSessions = body.completedSessions
  if (body.loggedSeconds !== undefined) updateData.loggedSeconds = body.loggedSeconds
  if (body.parentId !== undefined) updateData.parentId = body.parentId
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder

  if (Object.keys(updateData).length > 0) {
    await db
      .update(schema.dailyItems)
      .set(updateData)
      .where(eq(schema.dailyItems.id, id))
  }

  return { success: true }
})

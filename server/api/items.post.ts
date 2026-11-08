export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const newItem = {
    id: body.id || crypto.randomUUID(),
    parentId: body.parentId || null,
    date: body.date,
    type: (body.type || 'task') as 'task' | 'note' | 'event',
    title: body.title,
    isCompleted: body.isCompleted ? 1 : 0,
    categoryId: body.categoryId || 'uncategorized',
    estimatedSessions: body.estimatedSessions ?? (body.parentId ? 0 : 4),
    completedSessions: 0,
    loggedSeconds: 0,
    sortOrder: body.sortOrder || 0
  }

  await db.insert(schema.dailyItems).values(newItem)

  return {
    ...newItem,
    isCompleted: Boolean(newItem.isCompleted)
  }
})

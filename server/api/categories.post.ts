export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const newCategory = {
    id: body.id || `cat-${crypto.randomUUID().slice(0, 8)}`,
    name: (body.name || 'New Category').trim().toLowerCase(),
    color: body.color || '#3b82f6'
  }

  await db.insert(schema.categories).values(newCategory)

  return newCategory
})

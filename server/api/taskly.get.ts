import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date: string = (query.date as string) || new Date().toISOString().slice(0, 10)

  // 1. Ambil kategori, jika masih kosong (misal di SQLite lokal), otomatis isi default
  let cats = await db.select().from(schema.categories).orderBy(asc(schema.categories.createdAt))

  if (cats.length === 0) {
    const defaultCats = [
      { id: 'uncategorized', name: 'uncategorized', color: '#cbd5e1' },
      { id: 'cat-work', name: 'work / ngantor', color: '#3b82f6' },
      { id: 'cat-sport', name: 'sport', color: '#94a3b8' },
      { id: 'cat-writing', name: 'writing', color: '#a855f7' },
      { id: 'cat-achievement', name: 'achievement', color: '#22c55e' }
    ]
    await db.insert(schema.categories).values(defaultCats)
    cats = await db.select().from(schema.categories).orderBy(asc(schema.categories.createdAt))
  }

  // 2. Ambil semua task/note/event pada tanggal yang dipilih
  const items = await db
    .select()
    .from(schema.dailyItems)
    .where(eq(schema.dailyItems.date, date))
    .orderBy(asc(schema.dailyItems.sortOrder))

  return {
    categories: cats,
    items: items.map(item => ({
      ...item,
      isCompleted: Boolean(item.isCompleted)
    }))
  }
})

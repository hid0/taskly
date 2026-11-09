import { eq, asc } from 'drizzle-orm'

function getPreviousDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, day!)
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date: string =
    typeof query.date === 'string' && query.date
      ? query.date
      : new Date().toISOString().slice(0, 10)
  const yesterdayDate: string = getPreviousDateString(date)

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

  // 2. Ambil semua task/note/event pada tanggal yang dipilih & tanggal kemarin
  const [items, yesterdayItems] = await Promise.all([
    db
      .select()
      .from(schema.dailyItems)
      .where(eq(schema.dailyItems.date, date))
      .orderBy(asc(schema.dailyItems.sortOrder)),
    db
      .select()
      .from(schema.dailyItems)
      .where(eq(schema.dailyItems.date, yesterdayDate))
      .orderBy(asc(schema.dailyItems.sortOrder))
  ])

  const todayParents = items.filter(i => !i.parentId)

  // Cari parent item kemarin yang belum selesai (atau memiliki sub-item yang belum selesai)
  const yesterdayParents = yesterdayItems.filter(i => !i.parentId)
  const copyableYesterdayParents = yesterdayParents.filter((parent) => {
    const yChildren = yesterdayItems.filter(c => c.parentId === parent.id)
    const isParentOrChildUndone = !parent.isCompleted || yChildren.some(c => !c.isCompleted)
    if (!isParentOrChildUndone) return false

    const matchingTodayParent = todayParents.find(
      tp => tp.title.trim().toLowerCase() === parent.title.trim().toLowerCase()
    )
    if (!matchingTodayParent) return true

    // Jika parent sudah ada di hari ini, cek apakah ada sub-item kemarin yang belum ikut tersalin
    const todayChildTitles = new Set(
      items
        .filter(c => c.parentId === matchingTodayParent.id)
        .map(c => c.title.trim().toLowerCase())
    )
    return yChildren.some(yc => !todayChildTitles.has(yc.title.trim().toLowerCase()))
  })

  return {
    categories: cats,
    items: items.map(item => ({
      ...item,
      isCompleted: Boolean(item.isCompleted)
    })),
    yesterdayDate,
    yesterdayUndoneCount: copyableYesterdayParents.length,
    yesterdayUndoneTitles: copyableYesterdayParents.map((p) => {
      const subCount = yesterdayItems.filter(c => c.parentId === p.id).length
      return subCount > 0 ? `${p.title} (+${subCount} sub-item)` : p.title
    })
  }
})

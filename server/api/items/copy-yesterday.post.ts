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
  const body = await readBody(event)
  const targetDate: string =
    typeof body?.date === 'string' && body.date
      ? body.date
      : new Date().toISOString().slice(0, 10)
  const yesterdayDate: string = getPreviousDateString(targetDate)

  const [todayItems, yesterdayItems] = await Promise.all([
    db
      .select()
      .from(schema.dailyItems)
      .where(eq(schema.dailyItems.date, targetDate))
      .orderBy(asc(schema.dailyItems.sortOrder)),
    db
      .select()
      .from(schema.dailyItems)
      .where(eq(schema.dailyItems.date, yesterdayDate))
      .orderBy(asc(schema.dailyItems.sortOrder))
  ])

  const todayParents = todayItems.filter(i => !i.parentId)
  const yesterdayParents = yesterdayItems.filter(i => !i.parentId)

  const undoneParents = yesterdayParents.filter((parent) => {
    const children = yesterdayItems.filter(c => c.parentId === parent.id)
    return !parent.isCompleted || children.some(c => !c.isCompleted)
  })

  const insertedItems: any[] = []
  let nextSortOrder = todayItems.length + 1

  for (const parent of undoneParents) {
    // Cek apakah parent dengan judul yang sama sudah ada di hari ini
    const existingParent = todayParents.find(
      tp => tp.title.trim().toLowerCase() === parent.title.trim().toLowerCase()
    )

    let targetParentId: string

    if (existingParent) {
      targetParentId = existingParent.id
    } else {
      targetParentId = crypto.randomUUID()
      const newParent = {
        id: targetParentId,
        parentId: null,
        date: targetDate,
        type: parent.type || 'task',
        title: parent.title,
        isCompleted: 0,
        categoryId: parent.categoryId || 'uncategorized',
        estimatedSessions: parent.estimatedSessions || 4,
        completedSessions: 0,
        loggedSeconds: 0,
        sortOrder: nextSortOrder++
      }

      await db.insert(schema.dailyItems).values(newParent)
      insertedItems.push({ ...newParent, isCompleted: false })
    }

    // Salin SEMUA sub-item milik parent tersebut (di-reset menjadi belum selesai untuk hari baru)
    const parentChildren = yesterdayItems.filter(c => c.parentId === parent.id)
    const existingChildTitles = new Set(
      todayItems
        .filter(c => c.parentId === targetParentId)
        .map(c => c.title.trim().toLowerCase())
    )

    for (const child of parentChildren) {
      if (existingChildTitles.has(child.title.trim().toLowerCase())) continue

      const newChild = {
        id: crypto.randomUUID(),
        parentId: targetParentId,
        date: targetDate,
        type: child.type || 'task',
        title: child.title,
        isCompleted: 0,
        categoryId: child.categoryId || parent.categoryId || 'uncategorized',
        estimatedSessions: 0,
        completedSessions: 0,
        loggedSeconds: 0,
        sortOrder: nextSortOrder++
      }
      await db.insert(schema.dailyItems).values(newChild)
      insertedItems.push({ ...newChild, isCompleted: false })
      existingChildTitles.add(child.title.trim().toLowerCase())
    }
  }

  return {
    copiedCount: insertedItems.length,
    items: insertedItems
  }
})

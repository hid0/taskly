export default defineEventHandler(async (event) => {
  const path = getRequestPath(event)

  // Hanya proteksi endpoint API data (/api/taskly, /api/items, /api/categories)
  if (
    path.startsWith('/api/taskly') ||
    path.startsWith('/api/items') ||
    path.startsWith('/api/categories')
  ) {
    const user = await getAuthenticatedUser(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized — Silakan login terlebih dahulu'
      })
    }
    event.context.user = user
  }
})

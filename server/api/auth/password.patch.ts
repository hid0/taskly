import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const newUsername = typeof body?.username === 'string' ? body.username.trim() : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  const updatePayload: Record<string, string> = {}
  if (newUsername) {
    updatePayload.username = newUsername
  }
  if (newPassword) {
    if (newPassword.length < 4) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password baru minimal 4 karakter'
      })
    }
    updatePayload.passwordHash = await hashPassword(newPassword)
  }

  if (Object.keys(updatePayload).length > 0) {
    await db
      .update(schema.users)
      .set(updatePayload)
      .where(eq(schema.users.id, user.id))
  }

  return {
    success: true,
    username: newUsername || user.username
  }
})

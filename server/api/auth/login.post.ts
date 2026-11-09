import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await ensureDefaultUser()

  const body = await readBody(event)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username dan password wajib diisi'
    })
  }

  const userRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))

  const user = userRows[0]
  const inputHash = await hashPassword(password)

  if (!user || user.passwordHash !== inputHash) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Username atau password salah'
    })
  }

  await createUserSession(event, user.id)

  return {
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name
    }
  }
})

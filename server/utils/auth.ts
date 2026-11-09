import { eq, sql } from 'drizzle-orm'

const SESSION_COOKIE_NAME = 'taskly_session'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30 // 30 hari

let tablesEnsured = false

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`taskly_salt_v1_${password}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function ensureDefaultUser() {
  if (!tablesEnsured) {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT DEFAULT 'User' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    tablesEnsured = true
  }

  const existingUsers = await db.select().from(schema.users)
  if (existingUsers.length === 0) {
    const defaultPasswordHash = await hashPassword('admin123')
    await db.insert(schema.users).values({
      id: 'user-admin',
      username: 'admin',
      passwordHash: defaultPasswordHash,
      name: 'Admin'
    })
  }
}

export async function getAuthenticatedUser(event: any) {
  await ensureDefaultUser()
  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (!token) return null

  const sessionRows = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.token, token))

  const session = sessionRows[0]
  if (!session) return null

  if (Date.now() > session.expiresAt) {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token))
    deleteCookie(event, SESSION_COOKIE_NAME)
    return null
  }

  const userRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))

  const user = userRows[0]
  if (!user) return null

  return {
    id: user.id,
    username: user.username,
    name: user.name
  }
}

export async function createUserSession(event: any, userId: string) {
  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`
  const expiresAt = Date.now() + SESSION_DURATION_MS

  await db.insert(schema.sessions).values({
    token,
    userId,
    expiresAt
  })

  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000)
  })

  return token
}

export async function clearUserSession(event: any) {
  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (token) {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token))
  }
  deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
}

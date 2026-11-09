export default defineEventHandler(async (event) => {
  await ensureDefaultUser()
  const user = await getAuthenticatedUser(event)
  return {
    authenticated: Boolean(user),
    user
  }
})

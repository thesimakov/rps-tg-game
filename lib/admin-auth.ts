export function isAdminRequest(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET ?? ""
  if (!secret) return true
  const token = request.headers.get("x-admin-token") ?? ""
  return token === secret
}

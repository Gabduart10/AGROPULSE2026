export function isAdminDomain(): boolean {
  const host = window.location.hostname
  return (
    host.startsWith('admin.') ||
    import.meta.env.VITE_FORCE_ADMIN === 'true'
  )
}

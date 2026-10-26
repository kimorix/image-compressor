export function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(2) + ' MB'
}

export function extOf(type: string): string {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[type] || 'png'
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

// Truncate long names in the list: first 14 chars + … + extension, full name in title.
export function shortName(name: string): string {
  if (name.length <= 20) return name
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : ''
  const stem = ext ? name.slice(0, dot) : name
  return stem.slice(0, 14) + '…' + ext
}

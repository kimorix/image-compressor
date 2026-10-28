// "Download all" on phones: hand every compressed file to the system share
// sheet (Save to Photos / AirDrop / WeChat) when the browser can share files,
// otherwise fall back to the ZIP. Kept free of DOM/Vue so it can be tested
// with a fake navigator.

export interface ShareNavigator {
  canShare?: (data: { files: File[] }) => boolean
  share?: (data: { files: File[] }) => Promise<void>
}

export type ShareOutcome = 'shared' | 'cancelled' | 'fallback'

/** True when this navigator can share exactly these files. */
export function canShareFiles(nav: ShareNavigator | undefined, files: File[]): boolean {
  if (!nav || !files.length || typeof nav.canShare !== 'function' || typeof nav.share !== 'function') return false
  try {
    return nav.canShare({ files }) === true
  } catch {
    return false
  }
}

/**
 * Share the files, or run the fallback. A user dismissing the share sheet
 * (AbortError) is a choice, not a failure: nothing else happens. Any other
 * error (NotAllowedError when activation expired, a too-large payload, …)
 * falls back.
 */
export async function shareFilesOr(
  nav: ShareNavigator | undefined,
  files: File[],
  fallback: () => void | Promise<void>,
): Promise<ShareOutcome> {
  if (!canShareFiles(nav, files)) {
    await fallback()
    return 'fallback'
  }
  try {
    await nav!.share!({ files })
    return 'shared'
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    if (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    await fallback()
    return 'fallback'
  }
}

// Inline SVG paths (24×24, stroke) used by the merge view's buttons.
export const ICON = {
  rotateL: 'M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8M3 3v5h5',
  rotateR: 'M21 12a9 9 0 11-9-9 9.7 9.7 0 016.7 2.8L21 8M21 3v5h-5',
  dup: 'M8 8h12v12H8zM4 16V4h12',
  delete: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  restore: 'M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8M3 3v5h5M12 8v4l3 2',
  close: 'M6 6l12 12M18 6L6 18',
  export: 'M12 4v12m0-12l-5 5m5-5l5 5M5 20h14',
  share: 'M12 15V3m0 0L7 8m5-5l5 5M5 13v7h14v-7',
  download: 'M12 4v12m0 0l-5-5m5 5l5-5M5 20h14',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  up: 'M12 19V5m0 0l-6 6m6-6l6 6',
  down: 'M12 5v14m0 0l-6-6m6 6l6-6',
  sort: 'M7 4v16m0 0l-3-3m3 3l3-3M17 20V4m0 0l-3 3m3-3l3 3',
  check: 'M5 12l5 5L20 7',
} as const
export type IconName = keyof typeof ICON

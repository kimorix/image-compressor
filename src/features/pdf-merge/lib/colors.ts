// Source colour stripes: eight distinguishable hues, cycled per added file.
// Tuned to read on both the light and the dark theme.
export const PALETTE = ['#2563eb', '#0d9488', '#c026d3', '#ea580c', '#16a34a', '#db2777', '#4f46e5', '#ca8a04'] as const

export function colorOf(i: number): string {
  return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]
}

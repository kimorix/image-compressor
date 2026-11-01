// "Image i of n" bookkeeping for the batch image tools, so every running
// state can say which image it is on ("正在压缩 第 3/19 张") instead of
// a bare spinner.
//
// A batch is the set of images started since the tools were last idle:
// starting more while one runs grows it, and once every started image has
// settled the batch resets, so the next run counts from 1 again. Images are
// tracked by id, so a re-run of an image already in the batch (retry,
// "convert again" before it finished) does not count it twice, and a
// removed image leaves the count.

export class BatchProgress {
  started = new Set<string>()
  settled = new Set<string>()

  start(id: string): void {
    this.started.add(id)
    this.settled.delete(id)
  }

  settle(id: string): void {
    if (!this.started.has(id)) return
    this.settled.add(id)
    this.maybeReset()
  }

  remove(id: string): void {
    this.started.delete(id)
    this.settled.delete(id)
    this.maybeReset()
  }

  reset(): void {
    this.started.clear()
    this.settled.clear()
  }

  get total(): number { return this.started.size }
  get done(): number { return this.settled.size }
  get active(): boolean { return this.settled.size < this.started.size }
  /** 1-based index of the image being worked on now (0 when idle). */
  get index(): number { return currentIndex(this.done, this.total) }

  private maybeReset(): void {
    if (this.started.size > 0 && this.settled.size >= this.started.size) this.reset()
  }
}

/** 1-based "image i of n" for `finished` of `total` done (0 when nothing to do). */
export function currentIndex(finished: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(total, Math.max(1, finished + 1))
}

/** 1-based position of an item in its list (0 when absent). */
export function positionOf<T>(list: readonly T[], item: T): number {
  return list.indexOf(item) + 1
}

/** Reading phase: `pending` of `total` still being read. Items are read in
list order, so the one in progress is the first unread. */
export function readIndex(pending: number, total: number): number {
  return currentIndex(total - pending, total)
}

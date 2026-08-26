export class SeededRandom {
  private state: number
  private readonly initialSeed: number

  constructor(seed: number) {
    this.initialSeed = seed >>> 0
    this.state = this.initialSeed
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0

    return this.state / 4294967296
  }

  reset(): void {
   this.state = this.initialSeed
  }
}

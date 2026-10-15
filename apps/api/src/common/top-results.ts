// A bounded max-heap: the worst retained result stays at the root.
// compare(a,b) < 0 means a should appear before b in the final page.
export class TopResults<T> {
  private rows: T[] = [];
  constructor(
    private readonly capacity: number,
    private readonly compare: (a: T, b: T) => number,
  ) {}
  add(row: T) {
    if (this.rows.length < this.capacity) {
      this.rows.push(row);
      let index = this.rows.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (this.compare(this.rows[index], this.rows[parent]) <= 0) break;
        [this.rows[index], this.rows[parent]] = [
          this.rows[parent],
          this.rows[index],
        ];
        index = parent;
      }
      return;
    }
    if (this.compare(row, this.rows[0]) >= 0) return;
    this.rows[0] = row;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1,
        right = left + 1;
      let worst = index;
      if (
        left < this.rows.length &&
        this.compare(this.rows[left], this.rows[worst]) > 0
      )
        worst = left;
      if (
        right < this.rows.length &&
        this.compare(this.rows[right], this.rows[worst]) > 0
      )
        worst = right;
      if (worst === index) break;
      [this.rows[index], this.rows[worst]] = [
        this.rows[worst],
        this.rows[index],
      ];
      index = worst;
    }
  }
  sorted(): T[] {
    return [...this.rows].sort(this.compare);
  }
}

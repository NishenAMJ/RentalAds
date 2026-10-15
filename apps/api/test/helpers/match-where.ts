/**
 * A tiny in-memory evaluator for the subset of Prisma `where` filters the
 * public listing queries use: equality, AND, OR, and gte/lt comparisons.
 */
type Row = Record<string, unknown>;

const compare = (actual: unknown, condition: Record<string, unknown>) =>
  Object.entries(condition).every(([operator, expected]) => {
    const a = actual instanceof Date ? actual.getTime() : actual;
    const b = expected instanceof Date ? expected.getTime() : expected;
    if (a === null || a === undefined) return false;
    if (operator === 'gte') return (a as number) >= (b as number);
    if (operator === 'lt') return (a as number) < (b as number);
    throw new Error(`Unsupported operator in test matcher: ${operator}`);
  });

export function matchesWhere(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND')
      return (value as Row[]).every((part) => matchesWhere(row, part));
    if (key === 'OR')
      return (value as Row[]).some((part) => matchesWhere(row, part));
    if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    )
      return compare(row[key], value as Record<string, unknown>);
    return row[key] === value;
  });
}

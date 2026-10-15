/** Fields only administrators may see. They must never be returned to the renter who owns the request. */
export const INTERNAL_REQUEST_FIELDS = [
  'adminNotes',
  'assignedAdminId',
  'assignedAt',
  'followUpAt',
  'assignedAdmin',
] as const;

type Internal = (typeof INTERNAL_REQUEST_FIELDS)[number];

/** The renter-safe version of a request row. */
export function forRenter<T extends object>(row: T): Omit<T, Internal> {
  const visible = { ...row } as Record<string, unknown>;
  for (const field of INTERNAL_REQUEST_FIELDS) delete visible[field];
  return visible as Omit<T, Internal>;
}

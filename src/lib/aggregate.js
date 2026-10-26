/**
 * Small readers for aggregate response rows. The platform returns group rows as
 * `{ <groupField>, count, sum_<field>, avg_<field> }` plus a distinct column
 * whose exact key name can vary, so these helpers read defensively.
 */
export const rowCount = (row) => Number(row?.count ?? 0) || 0;

export const rowSum = (row, field) => Number(row?.[`sum_${field}`] ?? 0) || 0;

export const rowAvg = (row, field) => {
  const value = row?.[`avg_${field}`];
  return value === null || value === undefined ? null : Number(value);
};

export const rowGroupValue = (row, field) => row?.[field] ?? null;

/** A dateBucket row's day key (`date` / `day` / `bucket` / `_id`). */
export function bucketDay(row) {
  const raw = row?.date ?? row?.day ?? row?.bucket ?? row?._id;
  if (!raw) return null;
  const text = String(raw);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

export const groupRows = (result) => (Array.isArray(result?.rows) ? result.rows : []);
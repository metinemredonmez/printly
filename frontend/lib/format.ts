export const money = (n?: number | null) =>
  n == null
    ? '—'
    : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const num = (n?: number | null) => (n == null ? '—' : Number(n).toLocaleString());

export const shortDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString();
};

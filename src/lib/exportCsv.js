/**
 * Universal CSV Export Helper for Traffic Lume Analytics Tables
 */

export function downloadCsv(filename, headers, rows) {
  if (!rows || rows.length === 0) return;

  const sanitize = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [
    headers.map(sanitize).join(","),
    ...rows.map((row) => (Array.isArray(row) ? row.map(sanitize).join(",") : Object.values(row).map(sanitize).join(","))),
  ];

  const csvContent = "\uFEFF" + csvRows.join("\r\n"); // UTF-8 BOM for Excel compatibility
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format standard BreakdownTable rows into CSV
 */
export function exportBreakdownCsv(title, metric, rows, money = false) {
  const headers = [title || "Label", metric || "Count"];
  if (money) headers.push("Attributed Revenue");

  const formattedRows = (rows || []).map((r) => {
    const row = [r.label || "Unknown", r.value || 0];
    if (money) row.push(r.revenue ? `$${Number(r.revenue).toFixed(2)}` : "$0.00");
    return row;
  });

  const safeTitle = (title || "analytics-export").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const dateStr = new Date().toISOString().split("T")[0];
  downloadCsv(`${safeTitle}-${dateStr}.csv`, headers, formattedRows);
}

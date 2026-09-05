/**
 * Utility function to export tabular data as an Excel-compatible CSV file.
 * Adding UTF-8 BOM (\uFEFF) ensures Excel opens columns and formatting properly.
 */
export function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | undefined | null)[][]
) {
  const csvLines: string[] = [];

  // Header row
  const headerString = headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(',');
  csvLines.push(headerString);

  // Data rows
  for (const row of rows) {
    const rowString = row
      .map((val) => {
        if (typeof val === 'number' && !isNaN(val)) {
          return String(val);
        }
        const str = val === null || val === undefined ? '' : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(',');
    csvLines.push(rowString);
  }

  // Combine with UTF-8 BOM for Microsoft Excel
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

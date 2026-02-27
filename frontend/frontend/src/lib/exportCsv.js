/**
 * CSV export utility for Eden claims data.
 * Handles escaping, BOM for Excel compatibility, and blob download.
 */

const escapeCell = (value) => {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const CLAIM_COLUMNS = [
  { key: 'claim_number', label: 'Claim Number' },
  { key: 'client_name', label: 'Client Name' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'property_address', label: 'Property Address' },
  { key: 'date_of_loss', label: 'Date of Loss' },
  { key: 'claim_type', label: 'Claim Type' },
  { key: 'policy_number', label: 'Policy Number' },
  { key: 'estimated_value', label: 'Estimated Value' },
  { key: 'updated_at', label: 'Last Updated' },
];

export function exportClaimsCsv(claims, filename = 'eden-claims-export.csv') {
  const header = CLAIM_COLUMNS.map((c) => c.label).join(',');
  const rows = claims.map((claim) =>
    CLAIM_COLUMNS.map((col) => {
      let val = claim[col.key];
      if (col.key === 'estimated_value' && val != null) val = Number(val).toFixed(2);
      if (col.key === 'updated_at' && val) val = new Date(val).toLocaleDateString();
      if (col.key === 'date_of_loss' && val) val = new Date(val).toLocaleDateString();
      return escapeCell(val);
    }).join(',')
  );

  // BOM for Excel UTF-8 compatibility
  const csv = '\uFEFF' + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

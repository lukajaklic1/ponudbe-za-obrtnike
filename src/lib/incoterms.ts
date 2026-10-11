// Incoterms® 2020 — fixed international list (official ICC names), so no company-specific code list is needed.
export const INCOTERMS: { code: string; name: string }[] = [
  { code: 'EXW', name: 'Ex Works' },
  { code: 'FCA', name: 'Free Carrier' },
  { code: 'CPT', name: 'Carriage Paid To' },
  { code: 'CIP', name: 'Carriage and Insurance Paid To' },
  { code: 'DAP', name: 'Delivered at Place' },
  { code: 'DPU', name: 'Delivered at Place Unloaded' },
  { code: 'DDP', name: 'Delivered Duty Paid' },
  { code: 'FAS', name: 'Free Alongside Ship' },
  { code: 'FOB', name: 'Free On Board' },
  { code: 'CFR', name: 'Cost and Freight' },
  { code: 'CIF', name: 'Cost, Insurance and Freight' },
]

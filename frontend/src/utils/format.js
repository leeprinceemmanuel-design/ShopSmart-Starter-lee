// File: frontend/src/utils/format.js
// Shows a number as Philippine pesos with 2 decimals, e.g. 1800 -> "₱1,800.00".
export function formatPeso(value) {
  return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

/** I quattro formati del piano (Vincoli globali). Il valore è quello che il database accetta; l'etichetta è quella che si legge. */
export const FORMATS = [
  { value: 'fonte_alla_mano', label: 'Fonte alla mano' },
  { value: 'a_caldo', label: 'A caldo' },
  { value: 'non_ti_hanno_detto', label: 'Quello che non ti hanno detto' },
  { value: 'fuorigioco', label: 'Fuorigioco' },
] as const;

export type FormatValue = (typeof FORMATS)[number]['value'];

export function formatLabel(value: string | null): string | null {
  return FORMATS.find((format) => format.value === value)?.label ?? null;
}

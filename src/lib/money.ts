// Montants : toujours en centimes (entiers) pour éviter les erreurs d'arrondi des nombres à virgule.

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** « 12 », « 12,5 », « 12.50 », « 1 234,56 € » → centimes. null si invalide ou nul. */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[\s  €]/g, '').replace(',', '.');
  const m = /^(\d{1,9})(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

/** 123456 → « 1 234,56 € » */
export function formatAmount(cents: number): string {
  return euros.format(cents / 100);
}

/** 1250 → « 12,50 » ; 1200 → « 12 » (valeur de départ d'un champ de saisie). */
export function amountToInput(cents: number): string {
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  return c === 0 ? String(e) : `${e},${String(c).padStart(2, '0')}`;
}

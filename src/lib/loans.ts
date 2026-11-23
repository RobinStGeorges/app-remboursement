// Logique des remboursements : fonctions pures, testées, sans Firestore.
//
// Données (Firestore) :
//   families/{familyId}/apps/remboursement/prets/{pretId}
//     { libelle, crediteur, montantCentimes, datePret: "AAAA-MM-JJ", createdAt, createdBy, updatedAt }
//   families/{familyId}/apps/remboursement/paiements/{paiementId}
//     { pretId, montantCentimes, description, date: "AAAA-MM-JJ", createdAt, createdBy, updatedAt }
// Un document par paiement : deux téléphones peuvent en ajouter en même temps sans conflit.
// Le reste à payer est recalculé à partir des paiements (aucun compteur à tenir à jour).

import { formatAmount, parseAmount } from './money';
import { isValidISODate } from './dates';

export interface Loan {
  id: string;
  libelle: string;
  crediteur: string;
  totalCents: number;
  datePret: string;
  createdAtMs: number;
}

export interface Payment {
  id: string;
  loanId: string;
  amountCents: number;
  description: string;
  date: string;
  createdAtMs: number;
}

export interface LoanSummary {
  paidCents: number;
  remainingCents: number;
  /** Payé en trop (0 en temps normal). */
  overCents: number;
  done: boolean;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const cents = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
function millis(v: unknown): number {
  if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis: unknown }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return typeof v === 'number' ? v : 0;
}

/** Lecture tolérante : un champ manquant ou abîmé ne fait pas planter l'app. */
export function parseLoan(id: string, data: Record<string, unknown>): Loan {
  return {
    id,
    libelle: str(data.libelle) || 'Sans libellé',
    crediteur: str(data.crediteur) || 'quelqu’un',
    totalCents: cents(data.montantCentimes),
    datePret: isValidISODate(str(data.datePret)) ? str(data.datePret) : '',
    createdAtMs: millis(data.createdAt),
  };
}

export function parsePayment(id: string, data: Record<string, unknown>): Payment | null {
  const loanId = str(data.pretId);
  if (!loanId) return null;
  return {
    id,
    loanId,
    amountCents: cents(data.montantCentimes),
    description: str(data.description),
    date: isValidISODate(str(data.date)) ? str(data.date) : '',
    createdAtMs: millis(data.createdAt),
  };
}

export function summarize(loan: Loan, payments: readonly Payment[]): LoanSummary {
  const paidCents = payments.reduce((s, p) => (p.loanId === loan.id ? s + p.amountCents : s), 0);
  return {
    paidCents,
    remainingCents: Math.max(0, loan.totalCents - paidCents),
    overCents: Math.max(0, paidCents - loan.totalCents),
    done: paidCents >= loan.totalCents,
  };
}

const byDateDesc = (a: { date: string; createdAtMs: number }, b: { date: string; createdAtMs: number }) =>
  b.date.localeCompare(a.date) || b.createdAtMs - a.createdAtMs;

/** Paiements d'un prêt, du plus récent au plus ancien. */
export function paymentsOf(payments: readonly Payment[], loanId: string): Payment[] {
  return payments.filter((p) => p.loanId === loanId).sort(byDateDesc);
}

/** Prêts en cours d'abord (du plus récent au plus ancien), puis les prêts remboursés. */
export function sortLoans(loans: readonly Loan[], payments: readonly Payment[]): Loan[] {
  const done = new Map(loans.map((l) => [l.id, summarize(l, payments).done]));
  return [...loans].sort(
    (a, b) =>
      Number(done.get(a.id)) - Number(done.get(b.id)) ||
      byDateDesc({ date: a.datePret, createdAtMs: a.createdAtMs }, { date: b.datePret, createdAtMs: b.createdAtMs }),
  );
}

/** Phrase affichée en haut de la vue d'un prêt. */
export function remainingMessage(loan: Loan, s: LoanSummary): string {
  if (!s.done) return `Il reste encore ${formatAmount(s.remainingCents)} à rembourser à ${loan.crediteur}`;
  if (s.overCents > 0) return `Tout est remboursé à ${loan.crediteur}, avec ${formatAmount(s.overCents)} de trop`;
  return `Tout est remboursé à ${loan.crediteur} 🎉`;
}

/** Noms de créditeurs déjà utilisés (suggestions de saisie), sans doublon. */
export function knownCreditors(loans: readonly Loan[]): string[] {
  const seen = new Map<string, string>();
  for (const l of loans) {
    const key = l.crediteur.toLocaleLowerCase('fr');
    if (!seen.has(key)) seen.set(key, l.crediteur);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

// ---------- Validation des formulaires ----------

export interface LoanInput {
  libelle: string;
  crediteur: string;
  totalCents: number;
  datePret: string;
}
export interface PaymentInput {
  amountCents: number;
  description: string;
  date: string;
}
export type Validation<T> = { ok: true; value: T } | { ok: false; errors: Partial<Record<keyof T, string>> };

const AMOUNT_ERROR = 'Indiquez une somme supérieure à 0, par exemple 150 ou 12,50.';
const DATE_ERROR = 'Choisissez une date.';

export function validateLoan(raw: { montant: string; libelle: string; crediteur: string; date: string }): Validation<LoanInput> {
  const totalCents = parseAmount(raw.montant);
  const libelle = raw.libelle.trim();
  const crediteur = raw.crediteur.trim();
  const errors: Partial<Record<keyof LoanInput, string>> = {};
  if (totalCents === null) errors.totalCents = AMOUNT_ERROR;
  if (!libelle) errors.libelle = 'Donnez un libellé (par exemple « Voiture »).';
  if (!crediteur) errors.crediteur = 'Indiquez à qui rembourser.';
  if (!isValidISODate(raw.date)) errors.datePret = DATE_ERROR;
  if (Object.keys(errors).length > 0 || totalCents === null) return { ok: false, errors };
  return { ok: true, value: { libelle, crediteur, totalCents, datePret: raw.date } };
}

export function validatePayment(raw: { montant: string; description: string; date: string }): Validation<PaymentInput> {
  const amountCents = parseAmount(raw.montant);
  const errors: Partial<Record<keyof PaymentInput, string>> = {};
  if (amountCents === null) errors.amountCents = AMOUNT_ERROR;
  if (!isValidISODate(raw.date)) errors.date = DATE_ERROR;
  if (Object.keys(errors).length > 0 || amountCents === null) return { ok: false, errors };
  return { ok: true, value: { amountCents, description: raw.description.trim(), date: raw.date } };
}

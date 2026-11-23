import { describe, expect, test } from 'vitest';
import { amountToInput, formatAmount, parseAmount } from '../src/lib/money';
import { formatDate, isValidISODate, todayISO } from '../src/lib/dates';
import {
  knownCreditors,
  parseLoan,
  parsePayment,
  paymentsOf,
  remainingMessage,
  sortLoans,
  summarize,
  validateLoan,
  validatePayment,
  type Loan,
  type Payment,
} from '../src/lib/loans';

/** Intl met des espaces insécables : on les remplace pour comparer. */
const n = (s: string) => s.replace(/[  ]/g, ' ');

describe('montants', () => {
  test('saisies acceptées', () => {
    expect(parseAmount('12')).toBe(1200);
    expect(parseAmount('12,5')).toBe(1250);
    expect(parseAmount('12.05')).toBe(1205);
    expect(parseAmount(' 1 234,56 € ')).toBe(123456);
    expect(parseAmount('0,10')).toBe(10);
    expect(parseAmount('0,1')).toBe(10);
    expect(parseAmount('12,')).toBe(1200);
  });
  test('saisies refusées', () => {
    for (const s of ['', '0', '0,00', '-5', 'abc', '12,345', '1,2,3', '1e3']) expect(parseAmount(s)).toBeNull();
  });
  test('pas d’erreur d’arrondi', () => {
    expect(parseAmount('0,29')).toBe(29);
    expect(parseAmount('1,15')).toBe(115);
  });
  test('affichage', () => {
    expect(n(formatAmount(123456))).toBe('1 234,56 €');
    expect(n(formatAmount(500))).toBe('5,00 €');
    expect(amountToInput(1250)).toBe('12,50');
    expect(amountToInput(1205)).toBe('12,05');
    expect(amountToInput(1200)).toBe('12');
    expect(parseAmount(amountToInput(98765))).toBe(98765);
  });
});

describe('dates', () => {
  test('aujourd’hui en heure locale', () => {
    expect(todayISO(new Date(2026, 2, 29, 23, 59))).toBe('2026-03-29');
    expect(todayISO(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
  test('validité', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-2-3')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });
  test('format français', () => {
    expect(formatDate('2026-03-05')).toBe('5 mars 2026');
    expect(formatDate('n’importe quoi')).toBe('');
  });
});

const loan = (over: Partial<Loan> = {}): Loan => ({
  id: 'l1',
  libelle: 'Voiture',
  crediteur: 'Maman',
  totalCents: 50000,
  datePret: '2026-01-10',
  createdAtMs: 1,
  ...over,
});
const pay = (over: Partial<Payment> = {}): Payment => ({
  id: 'p' + Math.random(),
  loanId: 'l1',
  amountCents: 10000,
  description: '',
  date: '2026-02-01',
  createdAtMs: 1,
  ...over,
});

describe('lecture tolérante', () => {
  test('prêt avec champs manquants ou abîmés', () => {
    expect(parseLoan('x', {})).toEqual({
      id: 'x',
      libelle: 'Sans libellé',
      crediteur: 'quelqu’un',
      totalCents: 0,
      datePret: '',
      createdAtMs: 0,
    });
    const l = parseLoan('x', {
      libelle: ' Vélo ',
      crediteur: 'Paul',
      montantCentimes: 1999.6,
      datePret: '2026-13-01',
      createdAt: { toMillis: () => 42 },
    });
    expect(l).toMatchObject({ libelle: 'Vélo', totalCents: 2000, datePret: '', createdAtMs: 42 });
    expect(parseLoan('x', { montantCentimes: -5 }).totalCents).toBe(0);
    expect(parseLoan('x', { montantCentimes: '500' }).totalCents).toBe(0);
  });
  test('paiement sans prêt ignoré', () => {
    expect(parsePayment('p', { montantCentimes: 100 })).toBeNull();
    expect(parsePayment('p', { pretId: 'l1', montantCentimes: 100, date: '2026-01-02' })).toMatchObject({
      loanId: 'l1',
      amountCents: 100,
      description: '',
      date: '2026-01-02',
    });
  });
});

describe('calculs', () => {
  test('reste à payer, ignore les paiements des autres prêts', () => {
    const s = summarize(loan(), [pay(), pay({ amountCents: 2550 }), pay({ loanId: 'autre', amountCents: 99999 })]);
    expect(s).toEqual({ paidCents: 12550, remainingCents: 37450, overCents: 0, done: false });
    expect(n(remainingMessage(loan(), s))).toBe('Il reste encore 374,50 € à rembourser à Maman');
  });
  test('soldé exactement', () => {
    const s = summarize(loan(), [pay({ amountCents: 50000 })]);
    expect(s.done).toBe(true);
    expect(remainingMessage(loan(), s)).toBe('Tout est remboursé à Maman 🎉');
  });
  test('payé en trop', () => {
    const s = summarize(loan(), [pay({ amountCents: 50500 })]);
    expect(s).toMatchObject({ remainingCents: 0, overCents: 500, done: true });
    expect(n(remainingMessage(loan(), s))).toBe('Tout est remboursé à Maman, avec 5,00 € de trop');
  });
  test('sans paiement', () => {
    expect(summarize(loan(), [])).toMatchObject({ remainingCents: 50000, done: false });
  });
  test('paiements du plus récent au plus ancien', () => {
    const a = pay({ id: 'a', date: '2026-01-05' });
    const b = pay({ id: 'b', date: '2026-03-01' });
    const c = pay({ id: 'c', date: '2026-03-01', createdAtMs: 5 });
    expect(paymentsOf([a, b, c, pay({ id: 'z', loanId: 'autre' })], 'l1').map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });
  test('prêts en cours d’abord, puis remboursés', () => {
    const vieux = loan({ id: 'vieux', datePret: '2025-01-01' });
    const recent = loan({ id: 'recent', datePret: '2026-06-01' });
    const solde = loan({ id: 'solde', datePret: '2026-09-01', totalCents: 100 });
    const order = sortLoans([solde, vieux, recent], [pay({ loanId: 'solde', amountCents: 100 })]).map((l) => l.id);
    expect(order).toEqual(['recent', 'vieux', 'solde']);
  });
  test('créditeurs connus sans doublon', () => {
    expect(knownCreditors([loan({ crediteur: 'Paul' }), loan({ crediteur: 'paul' }), loan({ crediteur: 'Anne' })])).toEqual([
      'Anne',
      'Paul',
    ]);
  });
});

describe('validation', () => {
  test('prêt valide', () => {
    expect(validateLoan({ montant: '500', libelle: ' Voiture ', crediteur: ' Maman ', date: '2026-01-10' })).toEqual({
      ok: true,
      value: { totalCents: 50000, libelle: 'Voiture', crediteur: 'Maman', datePret: '2026-01-10' },
    });
  });
  test('prêt invalide : chaque erreur est signalée', () => {
    const r = validateLoan({ montant: '0', libelle: ' ', crediteur: '', date: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['crediteur', 'datePret', 'libelle', 'totalCents']);
  });
  test('paiement : description facultative', () => {
    expect(validatePayment({ montant: '50', description: '', date: '2026-02-01' })).toEqual({
      ok: true,
      value: { amountCents: 5000, description: '', date: '2026-02-01' },
    });
    const r = validatePayment({ montant: 'x', description: 'a', date: '2026-02-31' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['amountCents', 'date']);
  });
});

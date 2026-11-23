// Écrans : liste, vue d'un remboursement, fenêtres de création / modification / suppression.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import LoanList from '../src/lib/LoanList.svelte';
import LoanDetail from '../src/lib/LoanDetail.svelte';
import type { Actions } from '../src/lib/cloud';
import type { Loan, Payment } from '../src/lib/loans';

let cmp: Record<string, unknown> | null = null;
afterEach(() => {
  if (cmp) unmount(cmp);
  cmp = null;
  document.body.innerHTML = '';
});

const text = () => (document.body.textContent ?? '').replace(/[\s  ]+/g, ' ');
const button = (label: string) => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => (x.getAttribute('aria-label') ?? x.textContent ?? '').replace(/[\s  ]+/g, ' ').includes(label),
  );
  if (!b) throw new Error(`Bouton introuvable : ${label}\n${text()}`);
  return b;
};
const click = (label: string) => {
  button(label).click();
  flushSync();
};
const field = (label: string) => {
  const l = [...document.querySelectorAll('label')].find((x) => x.textContent?.includes(label));
  const input = l?.querySelector('input');
  if (!input) throw new Error(`Champ introuvable : ${label}`);
  return input;
};
const type = (label: string, value: string) => {
  const input = field(label);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
};
const submit = () => {
  document.querySelector('form')!.requestSubmit();
  flushSync();
};

function fakeActions(): Actions & { [k: string]: ReturnType<typeof vi.fn> } {
  return {
    createLoan: vi.fn(() => 'nouveau'),
    updateLoan: vi.fn(),
    deleteLoan: vi.fn(),
    createPayment: vi.fn(),
    updatePayment: vi.fn(),
    deletePayment: vi.fn(),
  };
}

const LOAN: Loan = { id: 'l1', libelle: 'Voiture', crediteur: 'Maman', totalCents: 50000, datePret: '2026-01-10', createdAtMs: 1 };
const P1: Payment = { id: 'p1', loanId: 'l1', amountCents: 10000, description: 'Virement janvier', date: '2026-01-31', createdAtMs: 1 };
const P2: Payment = { id: 'p2', loanId: 'l1', amountCents: 5000, description: '', date: '2026-02-28', createdAtMs: 2 };

describe('liste', () => {
  test('vide puis création d’un remboursement', () => {
    const actions = fakeActions();
    const onopen = vi.fn();
    cmp = mount(LoanList, { target: document.body, props: { loans: [], payments: [], loading: false, familyName: 'Famille A', actions, onopen } });
    expect(text()).toContain('Aucun remboursement');
    click('Nouveau remboursement');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    submit(); // formulaire vide : erreurs, rien n'est créé
    expect(actions.createLoan).not.toHaveBeenCalled();
    expect(text()).toContain('Indiquez une somme');
    expect(text()).toContain('Indiquez à qui rembourser');

    type('Somme totale', '1 200,50');
    type('Libellé', 'Canapé');
    type('Créditeur', 'Paul');
    type('Date du prêt', '2026-11-01');
    submit();
    expect(actions.createLoan).toHaveBeenCalledWith({ totalCents: 120050, libelle: 'Canapé', crediteur: 'Paul', datePret: '2026-11-01' });
    expect(onopen).toHaveBeenCalledWith('nouveau');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  test('affiche le reste et ouvre un remboursement', () => {
    const onopen = vi.fn();
    cmp = mount(LoanList, {
      target: document.body,
      props: { loans: [LOAN], payments: [P1, P2], loading: false, familyName: 'Famille A', actions: fakeActions(), onopen },
    });
    expect(text()).toContain('Voiture');
    expect(text()).toContain('350,00 €');
    expect(text()).toContain('150,00 € remboursés sur 500,00 €');
    click('Voiture');
    expect(onopen).toHaveBeenCalledWith('l1');
  });

  test('un remboursement soldé est marqué', () => {
    cmp = mount(LoanList, {
      target: document.body,
      props: { loans: [{ ...LOAN, totalCents: 15000 }], payments: [P1, P2], loading: false, familyName: 'A', actions: fakeActions(), onopen: () => {} },
    });
    expect(text()).toContain('✅ Remboursé');
  });
});

describe('vue d’un remboursement', () => {
  const show = (over: Record<string, unknown> = {}) => {
    const actions = fakeActions();
    const onback = vi.fn();
    cmp = mount(LoanDetail, {
      target: document.body,
      props: { loan: LOAN, loans: [LOAN], payments: [P1, P2], loading: false, actions, onback, ...over },
    });
    return { actions, onback };
  };

  test('ordre : phrase du reste, bouton, puis paiements du plus récent au plus ancien', () => {
    show();
    const t = text();
    expect(t).toContain('Il reste encore 350,00 € à rembourser à Maman');
    expect(t.indexOf('Il reste encore')).toBeLessThan(t.indexOf('Nouveau paiement'));
    expect(t.indexOf('Nouveau paiement')).toBeLessThan(t.indexOf('Paiements déjà effectués'));
    expect(t.indexOf('28 février 2026')).toBeLessThan(t.indexOf('31 janvier 2026'));
    expect(t).toContain('Virement janvier');
  });

  test('ajouter un paiement', () => {
    const { actions } = show();
    click('Nouveau paiement');
    type('Somme remboursée', '25,5');
    type('Description', 'Espèces');
    type('Date du paiement', '2026-03-03');
    submit();
    expect(actions.createPayment).toHaveBeenCalledWith('l1', { amountCents: 2550, description: 'Espèces', date: '2026-03-03' });
  });

  test('« Tout le reste » remplit le montant, et un montant trop élevé est signalé', () => {
    show();
    click('Nouveau paiement');
    click('Tout le reste');
    expect(field('Somme remboursée').value).toBe('350');
    type('Somme remboursée', '400');
    expect(text()).toContain('plus que le reste');
  });

  test('modifier un paiement', () => {
    const { actions } = show();
    click('Virement janvier');
    expect(field('Somme remboursée').value).toBe('100');
    expect(field('Description').value).toBe('Virement janvier');
    type('Somme remboursée', '120');
    submit();
    expect(actions.updatePayment).toHaveBeenCalledWith('p1', { amountCents: 12000, description: 'Virement janvier', date: '2026-01-31' });
  });

  test('supprimer un paiement demande confirmation', () => {
    const { actions } = show();
    click('Virement janvier');
    click('Supprimer ce paiement');
    expect(actions.deletePayment).not.toHaveBeenCalled();
    click('Annuler');
    click('Supprimer ce paiement');
    [...document.querySelectorAll('.confirm button')].find((b) => b.textContent === 'Supprimer')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    expect(actions.deletePayment).toHaveBeenCalledWith('p1');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  test('modifier puis supprimer le remboursement (avec ses paiements)', () => {
    const { actions, onback } = show();
    click('Modifier le remboursement');
    expect(field('Libellé').value).toBe('Voiture');
    type('Libellé', 'Voiture rouge');
    submit();
    expect(actions.updateLoan).toHaveBeenCalledWith('l1', { totalCents: 50000, libelle: 'Voiture rouge', crediteur: 'Maman', datePret: '2026-01-10' });

    click('Modifier le remboursement');
    click('Supprimer ce remboursement');
    expect(text()).toContain('et ses 2 paiements');
    [...document.querySelectorAll('.confirm button')].find((b) => b.textContent === 'Supprimer')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    expect(actions.deleteLoan).toHaveBeenCalledWith('l1', ['p2', 'p1']);
    expect(onback).toHaveBeenCalled();
  });

  test('Échap ferme la fenêtre', () => {
    show();
    click('Nouveau paiement');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    flushSync();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  test('remboursement introuvable', () => {
    const { onback } = show({ loan: null });
    expect(text()).toContain("n'existe plus");
    click('Retour à la liste');
    expect(onback).toHaveBeenCalled();
  });

  test('soldé', () => {
    show({ payments: [{ ...P1, amountCents: 50000 }] });
    expect(text()).toContain('Tout est remboursé à Maman 🎉');
  });
});

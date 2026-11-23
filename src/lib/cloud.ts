// Lien avec Firestore. Les écritures ne sont jamais attendues : hors connexion, elles partent au retour du réseau.
// Seul un refus du serveur est signalé (onError).

import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { appCollection, getServices, toFrenchMessage } from 'famille-core';
import { parseLoan, parsePayment, type Loan, type LoanInput, type Payment, type PaymentInput } from './loans';

export const APP_ID = 'remboursement';

const loansCol = (familyId: string) => appCollection(familyId, APP_ID, 'prets');
const paymentsCol = (familyId: string) => appCollection(familyId, APP_ID, 'paiements');

export function watchLoans(familyId: string, onData: (l: Loan[]) => void, onError: (m: string) => void): () => void {
  return onSnapshot(
    loansCol(familyId),
    (snap) => onData(snap.docs.map((d) => parseLoan(d.id, d.data({ serverTimestamps: 'estimate' })))),
    (e) => onError(toFrenchMessage(e)),
  );
}

export function watchPayments(familyId: string, onData: (p: Payment[]) => void, onError: (m: string) => void): () => void {
  return onSnapshot(
    paymentsCol(familyId),
    (snap) =>
      onData(snap.docs.map((d) => parsePayment(d.id, d.data({ serverTimestamps: 'estimate' }))).filter((p): p is Payment => p !== null)),
    (e) => onError(toFrenchMessage(e)),
  );
}

export interface Actions {
  createLoan(v: LoanInput): string;
  updateLoan(id: string, v: LoanInput): void;
  /** Supprime le prêt et tous ses paiements connus, en une seule opération. */
  deleteLoan(id: string, paymentIds: readonly string[]): void;
  createPayment(loanId: string, v: PaymentInput): void;
  updatePayment(id: string, v: PaymentInput): void;
  deletePayment(id: string): void;
}

const loanFields = (v: LoanInput) => ({
  libelle: v.libelle,
  crediteur: v.crediteur,
  montantCentimes: v.totalCents,
  datePret: v.datePret,
  updatedAt: serverTimestamp(),
});
const paymentFields = (v: PaymentInput) => ({
  montantCentimes: v.amountCents,
  description: v.description,
  date: v.date,
  updatedAt: serverTimestamp(),
});

export function makeActions(familyId: string, uid: string, onError: (m: string) => void): Actions {
  const fail = (e: unknown) => onError(toFrenchMessage(e));
  return {
    createLoan(v) {
      const ref = doc(loansCol(familyId));
      setDoc(ref, { ...loanFields(v), createdAt: serverTimestamp(), createdBy: uid }).catch(fail);
      return ref.id;
    },
    updateLoan(id, v) {
      updateDoc(doc(loansCol(familyId), id), loanFields(v)).catch(fail);
    },
    deleteLoan(id, paymentIds) {
      const batch = writeBatch(getServices().db);
      for (const p of paymentIds) batch.delete(doc(paymentsCol(familyId), p));
      batch.delete(doc(loansCol(familyId), id));
      batch.commit().catch(fail);
    },
    createPayment(loanId, v) {
      setDoc(doc(paymentsCol(familyId)), {
        pretId: loanId,
        ...paymentFields(v),
        createdAt: serverTimestamp(),
        createdBy: uid,
      }).catch(fail);
    },
    updatePayment(id, v) {
      updateDoc(doc(paymentsCol(familyId), id), paymentFields(v)).catch(fail);
    },
    deletePayment(id) {
      deleteDoc(doc(paymentsCol(familyId), id)).catch(fail);
    },
  };
}

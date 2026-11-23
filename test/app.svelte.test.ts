// Application entière : écran de connexion, navigation par #/, réabonnement quand la famille change.
import { afterEach, expect, test, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';

const h = vi.hoisted(() => {
  const subs = new Set<(s: unknown) => void>();
  let current: unknown = { status: 'signedOut' };
  const watched: string[] = [];
  const stopped: string[] = [];
  return {
    watched,
    stopped,
    set(s: unknown) {
      current = s;
      subs.forEach((f) => f(s));
    },
    session: {
      subscribe(fn: (s: unknown) => void) {
        fn(current);
        subs.add(fn);
        return () => subs.delete(fn);
      },
    },
  };
});

vi.mock('famille-core', () => ({ session: h.session, signIn: vi.fn(), toFrenchMessage: () => 'Erreur' }));
vi.mock('../src/lib/cloud', () => ({
  makeActions: () => ({}),
  watchLoans: (familyId: string, cb: (l: unknown[]) => void) => {
    h.watched.push(familyId);
    cb(
      familyId === 'fa'
        ? [{ id: 'l1', libelle: 'Voiture', crediteur: 'Maman', totalCents: 50000, datePret: '2026-01-10', createdAtMs: 1 }]
        : [],
    );
    return () => h.stopped.push(familyId);
  },
  watchPayments: (_f: string, cb: (p: unknown[]) => void) => (cb([]), () => {}),
}));

import App from '../src/App.svelte';

let cmp: Record<string, unknown> | null = null;
afterEach(() => {
  if (cmp) unmount(cmp);
  cmp = null;
  location.hash = '';
  document.body.innerHTML = '';
});
const text = () => (document.body.textContent ?? '').replace(/[\s  ]+/g, ' ');
const ready = (familyId: string, familyName: string) => ({
  status: 'ready',
  user: { uid: 'u1' },
  displayName: 'Robin',
  familyId,
  familyName,
  isOwner: true,
});
const hashChanged = () =>
  new Promise<void>((r) => {
    window.addEventListener('hashchange', () => r(), { once: true });
  });

test('non connecté : renvoi vers le portail', () => {
  h.set({ status: 'signedOut' });
  cmp = mount(App, { target: document.body });
  expect(text()).toContain('Connectez-vous depuis le portail');
  expect(document.querySelector('a[href="/"]')).not.toBeNull();
});

test('liste → vue d’un remboursement → retour, puis changement de famille', async () => {
  h.set(ready('fa', 'Famille A'));
  cmp = mount(App, { target: document.body });
  flushSync();
  expect(text()).toContain('Voiture');
  expect(document.querySelector('a[href="/"]')?.textContent).toContain('Portail');

  let changed = hashChanged();
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Voiture'))!.click();
  await changed;
  flushSync();
  expect(location.hash).toBe('#/pret/l1');
  expect(text()).toContain('Il reste encore 500,00 € à rembourser à Maman');

  changed = hashChanged();
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('← Remboursements'))!.click();
  await changed;
  flushSync();
  expect(text()).toContain('Nouveau remboursement');

  h.set(ready('fb', 'Famille B'));
  flushSync();
  await tick();
  expect(h.stopped).toContain('fa');
  expect(h.watched.at(-1)).toBe('fb');
  expect(text()).toContain('Famille B');
  expect(text()).toContain('Aucun remboursement');
});

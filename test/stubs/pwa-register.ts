// Remplace le module virtuel de vite-plugin-pwa pendant les tests.
export function registerSW(_opts?: unknown) {
  return async (_reload?: boolean) => {};
}

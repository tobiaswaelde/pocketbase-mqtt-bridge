export function normalizeEnvironment(values: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value?.replace(/^(?:['"]+)|(?:['"]+)$/g, '')]),
  );
}

export function normalizePocketBaseUrl(value: string): string {
  const url = new URL(value);

  if (url.pathname === '/_' || url.pathname === '/_/') {
    url.pathname = '/';
  }

  return url.toString();
}

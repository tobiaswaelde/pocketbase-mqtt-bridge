export function normalizeEnvironment(values: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value?.replace(/^(?:['"]+)|(?:['"]+)$/g, '')]),
  );
}

type JsonValue = boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface RecordField {
  path: string[];
  payload: string;
}

export function flattenRecordFields(record: Record<string, unknown>): RecordField[] {
  const fields: RecordField[] = [];
  for (const [key, value] of Object.entries(record)) appendField(fields, [key], parseJsonValue(value));
  return fields;
}

function appendField(fields: RecordField[], path: string[], value: unknown) {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    if (!value.some(isObjectRecord)) return addField(fields, path, value);
    value.forEach((entry, index) => appendField(fields, [...path, String(index)], entry));
    return;
  }
  if (isObject(value)) {
    const entries = Object.entries(value);
    if (!entries.length) return addField(fields, path, value);
    for (const [key, entry] of entries) appendField(fields, [...path, key], entry);
    return;
  }
  addField(fields, path, value);
}

function addField(fields: RecordField[], path: string[], value: unknown) {
  const payload = JSON.stringify(value);
  if (payload !== undefined) fields.push({ path: path.map(encodeTopicSegment), payload });
}

function encodeTopicSegment(value: string) {
  return encodeURIComponent(value) || '%00';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !Array.isArray(value);
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const candidate = value.trim();
  if (!/^[{[]/.test(candidate)) return value;
  try {
    return JSON.parse(candidate) as JsonValue;
  } catch {
    return value;
  }
}

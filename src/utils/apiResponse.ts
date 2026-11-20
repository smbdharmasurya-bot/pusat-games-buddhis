export interface ParsedDataImageUri {
  mimeType: string;
  buffer: Uint8Array;
}

/**
 * Safely unwraps standard API responses `{ success, data }` or plain JSON objects
 * without ever throwing `TypeError: Cannot read properties of null (reading 'data')`.
 */
export function unwrapApiJsonPayload<T>(
  payload: unknown,
  status: number,
  ok: boolean,
  endpoint: string
): T {
  const isObject = payload !== null && typeof payload === 'object';

  if (!ok) {
    const serverMessage =
      isObject && typeof (payload as Record<string, unknown>).message === 'string'
        ? String((payload as Record<string, unknown>).message)
        : '';
    throw new Error(serverMessage || `HTTP ${status}: Terjadi kesalahan pada server (${endpoint})`);
  }

  if (payload === null || payload === undefined) {
    throw new Error(`Respons server kosong atau bukan JSON valid untuk ${endpoint} (HTTP ${status})`);
  }

  if (isObject && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (record.success === false && typeof record.message === 'string') {
      throw new Error(record.message);
    }
    if (Object.prototype.hasOwnProperty.call(record, 'data') && record.data !== undefined) {
      return record.data as T;
    }
  }

  return payload as T;
}

/**
 * Parses a base64 `data:image/...;base64,...` URI into its MIME type and raw bytes.
 * Returns null if the string is not a valid base64 image data URI.
 */
export function parseDataImageUri(value: unknown): ParsedDataImageUri | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(trimmed);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const base64Body = match[2].replace(/\s+/g, '');
  if (!base64Body) return null;

  try {
    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(base64Body, 'base64');
      if (buf.length === 0) return null;
      return { mimeType, buffer: buf };
    }
    const binary = atob(base64Body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (bytes.length === 0) return null;
    return { mimeType, buffer: bytes };
  } catch {
    return null;
  }
}

/**
 * Detects whether a media URL points to our own internal binary image proxy endpoint
 * so update endpoints preserve the existing stored base64 asset instead of overwriting
 * it with a self-referential proxy path.
 */
export function isInternalMediaProxyUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    /^\/api\/v1\/games\/\d+\/(thumbnail|icon)(\?.*)?$/i.test(trimmed) ||
    /^\/api\/v1\/settings\/hero-image(\?.*)?$/i.test(trimmed)
  );
}

/**
 * Builds a deterministic lightweight cache-busting tag from a stored media value
 * and updated timestamp.
 */
export function buildMediaVersionTag(mediaValue: string, updatedAt?: unknown): string {
  const len = mediaValue.length;
  const head = mediaValue.slice(0, 24);
  const tail = mediaValue.slice(-24);
  let hash = 2166136261;
  const sample = `${len}:${head}:${tail}:${String(updatedAt || '')}`;
  for (let i = 0; i < sample.length; i += 1) {
    hash ^= sample.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${len}-${(hash >>> 0).toString(36)}`;
}

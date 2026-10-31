/** Next already decodes path params once; decode again for double-encoded ids, but never throw on a stray "%". */
export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

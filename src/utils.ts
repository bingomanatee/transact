export function asError(value: any, def?: any) {
  if (!value) {
    return def ? new Error(def) : value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  return value;
}

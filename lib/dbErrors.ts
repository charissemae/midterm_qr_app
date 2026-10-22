type DbError = {
  code?: string | null;
  message?: string | null;
} | null;

// PostgREST reports an unknown column either with the Postgres error code
// 42703 (undefined_column) or with the PostgREST code PGRST204
// ("Could not find the column ... in the schema cache").
export function isMissingColumnError(error: DbError): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const message = error.message ?? '';
  return (
    /column .* does not exist/i.test(message) ||
    /unknown column/i.test(message) ||
    /not found in the schema cache/i.test(message)
  );
}

export function dbErrorMessage(error: DbError, fallback: string): string {
  return error?.message ?? fallback;
}

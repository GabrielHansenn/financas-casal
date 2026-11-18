/**
 * User-facing messages for the consistency checks done by database triggers
 * (see migration 20261122120000_deletion_rules.sql). Returns null for other errors.
 */
export function referenceErrorMessage(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error || error.code !== "23514" || !error.message) return null;
  if (error.message.includes("account is archived")) {
    return "Essa conta está arquivada. Restaure a conta ou escolha outra.";
  }
  if (error.message.includes("category is archived")) {
    return "Essa categoria está arquivada. Restaure a categoria ou escolha outra.";
  }
  if (error.message.includes("category type does not match")) {
    return "Essa categoria não combina com o tipo do lançamento (receita ou despesa).";
  }
  return null;
}

import type { ListOptions, QuickAddData } from "./types";

/**
 * Forms only list active accounts/categories. When editing a record that still points to an
 * archived one, add it back (marked "(arquivada)") so the current value stays selectable.
 */
export function withArchivedOptions(
  data: QuickAddData,
  options: ListOptions,
  refs: { accountIds: (string | null)[]; categoryId: string | null },
): QuickAddData {
  const accounts = [...data.accounts];
  for (const id of refs.accountIds) {
    if (!id || accounts.some((a) => a.id === id)) continue;
    const archived = options.accounts.find((a) => a.id === id);
    if (archived) accounts.push({ id, name: `${archived.name} (arquivada)`, type: archived.type });
  }
  const categories = [...data.categories];
  if (refs.categoryId && !categories.some((c) => c.id === refs.categoryId)) {
    const archived = options.categories.find((c) => c.id === refs.categoryId);
    if (archived) {
      const { id, type, icon, color, name } = archived;
      categories.push({ id, type, icon, color, name: `${name} (arquivada)` });
    }
  }
  return { ...data, accounts, categories };
}

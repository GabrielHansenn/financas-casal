/** "1 transação", "23 transações", "nenhuma transação" (with `zero`). */
export function plural(count: number, singular: string, pluralForm: string, zero?: string): string {
  if (count === 0 && zero) return zero;
  return `${count.toLocaleString("pt-BR")} ${count === 1 ? singular : pluralForm}`;
}

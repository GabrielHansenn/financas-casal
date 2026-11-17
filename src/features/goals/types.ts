export type GoalContribution = {
  id: string;
  amountCents: number; // negative = withdrawal
  date: string;
  note: string | null;
  createdBy: string;
};

export type GoalItem = {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  deadline: string | null;
  archived: boolean;
  contributions: GoalContribution[];
};

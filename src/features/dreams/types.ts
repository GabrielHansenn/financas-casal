import type { WorkspaceType } from "@/features/workspaces/active-workspace";
import type { DreamCategory, DreamHorizon, DreamStatus } from "./labels";
import type { LinkedGoal } from "./lifecycle";
import type { DreamReaction } from "./social";

export type DreamItem = {
  id: string;
  workspaceId: string;
  title: string;
  why: string | null;
  category: DreamCategory;
  horizon: DreamHorizon;
  ownerUserId: string | null;
  estimatedCostCents: number | null;
  status: DreamStatus;
  goalId: string | null;
  /** The linked goal with its current balance (planning dreams, and achieved ones that kept it) */
  goal: LinkedGoal | null;
  achievedAt: string | null;
  coverPath: string | null;
  /** Short-lived signed URL (private bucket); null when there is no image */
  coverUrl: string | null;
  achievedPath: string | null;
  achievedUrl: string | null;
  position: number;
  createdBy: string;
  /** Reactions of the members (shared workspaces only; always empty in a personal one) */
  reactions: DreamReaction[];
};

export type DreamMember = { userId: string; displayName: string };

export type DreamsBoardData = {
  workspaceId: string;
  workspaceType: WorkspaceType;
  currentUserId: string;
  today: string;
  members: DreamMember[];
  dreams: DreamItem[];
};

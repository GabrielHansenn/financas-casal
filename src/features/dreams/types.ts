import type { WorkspaceType } from "@/features/workspaces/active-workspace";
import type { DreamCategory, DreamHorizon, DreamStatus } from "./labels";

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
  achievedAt: string | null;
  coverPath: string | null;
  /** Short-lived signed URL (private bucket); null when there is no image */
  coverUrl: string | null;
  achievedPath: string | null;
  achievedUrl: string | null;
  position: number;
  createdBy: string;
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

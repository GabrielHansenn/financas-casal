import { Suspense } from "react";
import { getQuickAddData } from "../queries";
import { QuickAddButton, QuickAddButtonFallback } from "./quick-add";

// Server wrapper: loads the active workspace's accounts/categories/members behind Suspense.
export function QuickAddSlot() {
  return (
    <Suspense fallback={<QuickAddButtonFallback />}>
      <QuickAddLoader />
    </Suspense>
  );
}

async function QuickAddLoader() {
  const data = await getQuickAddData();
  // key: remount when the active workspace changes so defaults are recomputed
  return <QuickAddButton key={data.workspaceId} data={data} />;
}

"use client";

import { MailIcon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateBR, todayISO } from "@/lib/dates";
import { revokeInvite } from "../actions";
import type { InviteDetail } from "../queries";

export function PendingInvites({ invites }: { invites: InviteDetail[] }) {
  const [pending, startTransition] = useTransition();

  if (invites.length === 0) return null;

  const revoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeInvite(id);
      if (result.ok) toast.success("Convite cancelado");
      else toast.error(result.error);
    });
  };

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Convites pendentes</p>
      <ul className="divide-y rounded-lg border">
        {invites.map((invite) => (
          <li key={invite.id} className="flex items-center gap-3 px-3 py-2">
            <MailIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-sm">{invite.email}</span>
              <span className="text-xs text-muted-foreground">
                Vale até {formatDateBR(todayISO(new Date(invite.expiresAt)))}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => revoke(invite.id)}
              disabled={pending}
              aria-label={`Cancelar convite para ${invite.email}`}
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

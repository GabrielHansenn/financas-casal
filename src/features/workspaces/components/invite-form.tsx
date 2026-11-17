"use client";

import { CheckIcon, CopyIcon, MessageCircleIcon, Share2Icon } from "lucide-react";
import { useActionState, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { FormField, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { inviteMember } from "../actions";

const subscribe = () => () => {};
// navigator.share only exists in some browsers (mostly mobile); checked after hydration
function useCanShare() {
  return useSyncExternalStore(
    subscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

export function InviteForm({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [state, action, pending] = useActionState(inviteMember, null);
  const [copied, setCopied] = useState(false);
  const canShare = useCanShare();

  const result = state?.ok ? state : null;
  const shareText = result
    ? `Te convidei para organizarmos nossas finanças juntos no "${workspaceName}". Aceite aqui: ${result.link}`
    : "";

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Convite – Adois", text: shareText });
    } catch {
      // User cancelled the share sheet
    }
  };

  return (
    <div className="grid gap-4">
      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <div className="flex-1">
          <FormField
            label="Email de quem você quer convidar"
            name="email"
            id={`invite-email-${workspaceId}`}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="email@exemplo.com"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Convidar"}
        </Button>
      </form>

      {state && !state.ok ? <FormMessage type="error">{state.error}</FormMessage> : null}

      {result ? (
        <div className="grid gap-3 rounded-lg border bg-muted/40 p-3" role="status">
          <p className="text-sm">
            {result.emailSent ? (
              <>
                Enviamos o convite para <strong>{result.email}</strong>. Se preferir, mande o link também
                pelo WhatsApp:
              </>
            ) : (
              <>
                Convite criado para <strong>{result.email}</strong>, mas não conseguimos enviar o email.
                Mande o link abaixo pelo WhatsApp:
              </>
            )}
          </p>
          <code className="block truncate rounded bg-background px-2 py-1.5 text-xs" title={result.link}>
            {result.link}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copy}>
              {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
              Copiar link
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <MessageCircleIcon aria-hidden />
              WhatsApp
            </Button>
            {canShare ? (
              <Button type="button" variant="outline" size="sm" onClick={share}>
                <Share2Icon aria-hidden />
                Compartilhar
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            O link vale por 7 dias e só funciona para <strong>{result.email}</strong>. Por segurança ele não
            fica salvo: se perder, é só convidar de novo.
          </p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { DownloadIcon, ShareIcon, SmartphoneIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Chrome/Edge/Android fire this event when the app can be installed (not standardized yet)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "standalone" | "ios" | "other" | "server";

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "standalone";
  // iPadOS reports itself as Mac; touch support tells them apart
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

/** "Install the app" helper: native prompt where available, step-by-step on iPhone/iPad. */
export function InstallApp() {
  const platform = useSyncExternalStore(subscribe, detectPlatform, () => "server" as const);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // keep it for our button instead of the browser mini-bar
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      toast.success("App instalado! Abra pelo ícone na tela inicial.");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (platform === "server") return null;

  if (platform === "standalone") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <SmartphoneIcon className="size-4" aria-hidden /> Você já está usando o app instalado.
      </p>
    );
  }

  if (platform === "ios") {
    return (
      <div className="grid gap-2 text-sm">
        <p>Para instalar no iPhone ou iPad, abra este site no Safari e:</p>
        <ol className="grid list-decimal gap-1 pl-5 text-muted-foreground">
          <li>
            Toque em <ShareIcon className="inline size-4 align-text-bottom" aria-label="Compartilhar" /> (Compartilhar)
          </li>
          <li>Escolha &quot;Adicionar à Tela de Início&quot;</li>
          <li>Toque em &quot;Adicionar&quot;</li>
        </ol>
      </div>
    );
  }

  if (promptEvent) {
    return (
      <Button
        onClick={async () => {
          await promptEvent.prompt();
          const { outcome } = await promptEvent.userChoice;
          if (outcome === "accepted") setPromptEvent(null);
        }}
      >
        <DownloadIcon aria-hidden /> Instalar app
      </Button>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Para instalar, use o menu do navegador e escolha &quot;Instalar app&quot; ou &quot;Adicionar à tela inicial&quot;.
      O app abre em tela cheia, como um aplicativo.
    </p>
  );
}

import type { Metadata } from "next";
import { HeartHandshakeIcon, MailWarningIcon, TimerOffIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/features/auth/actions";
import { AcceptInviteButton } from "@/features/workspaces/components/accept-invite-button";
import { INVITE_TOKEN_PATTERN } from "@/features/workspaces/invite-token";
import { formatDateBR, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Convite" };

// Public page (allowed in the proxy). Anonymous visitors are asked to log in or sign up and
// come back here; logged-in users see the invite preview and can accept it.
export default function InvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <Brand className="text-lg" />
      <div className="w-full max-w-sm">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <InviteContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function InviteContent({ params }: { params: PageProps<"/convite/[token]">["params"] }) {
  const { token } = await params;
  const invitePath = `/convite/${token}`;

  if (!INVITE_TOKEN_PATTERN.test(token)) {
    return <InvalidInvite />;
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  if (!auth?.claims) {
    const next = encodeURIComponent(invitePath);
    return (
      <InviteCard
        icon={<HeartHandshakeIcon className="size-6" aria-hidden />}
        title="Você recebeu um convite"
        description="Entre ou crie sua conta com o email que recebeu o convite para ver os detalhes e aceitar."
      >
        <div className="grid gap-2">
          <Button size="lg" nativeButton={false} render={<Link href={`/entrar?next=${next}`} />}>
            Já tenho conta
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/cadastro?next=${next}`} />}
          >
            Criar conta
          </Button>
        </div>
      </InviteCard>
    );
  }

  const { data, error } = await supabase.rpc("get_invite_preview", { p_token: token });
  const invite = data?.[0];
  if (error || !invite) return <InvalidInvite />;

  if (invite.status !== "pending" || new Date(invite.expires_at) < new Date()) {
    return (
      <InviteCard
        icon={<TimerOffIcon className="size-6" aria-hidden />}
        title="Convite indisponível"
        description={
          invite.status === "accepted"
            ? "Este convite já foi aceito."
            : "Este convite expirou ou foi cancelado. Peça para enviarem um novo."
        }
      >
        <Button variant="outline" size="lg" nativeButton={false} render={<Link href="/" />}>
          Ir para o início
        </Button>
      </InviteCard>
    );
  }

  const currentEmail = (auth.claims.email ?? "").toLowerCase();
  if (currentEmail !== invite.email) {
    return (
      <InviteCard
        icon={<MailWarningIcon className="size-6" aria-hidden />}
        title="Convite para outro email"
        description={`Este convite foi enviado para ${invite.email}, mas você entrou como ${currentEmail}. Saia e entre com o email convidado.`}
      >
        <form action={signOut}>
          <input type="hidden" name="next" value={invitePath} />
          <Button type="submit" size="lg" className="w-full">
            Sair e entrar com outro email
          </Button>
        </form>
      </InviteCard>
    );
  }

  return (
    <InviteCard
      icon={<HeartHandshakeIcon className="size-6" aria-hidden />}
      title={`Entrar em "${invite.workspace_name}"`}
      description={`${invite.invited_by_name} convidou você para organizarem as finanças juntos. Vocês vão ver e lançar as despesas deste workspace, e seu espaço pessoal continua privado.`}
    >
      <AcceptInviteButton token={token} />
      <p className="text-center text-xs text-muted-foreground">
        Convite válido até {formatDateBR(todayISO(new Date(invite.expires_at)))}
      </p>
    </InviteCard>
  );
}

function InvalidInvite() {
  return (
    <InviteCard
      icon={<TimerOffIcon className="size-6" aria-hidden />}
      title="Convite inválido"
      description="Não encontramos este convite. Confira se o link foi copiado inteiro ou peça um novo."
    >
      <Button variant="outline" size="lg" nativeButton={false} render={<Link href="/" />}>
        Ir para o início
      </Button>
    </InviteCard>
  );
}

function InviteCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">{icon}</span>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  );
}

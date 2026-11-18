import type { Metadata } from "next";
import { HandCoinsIcon, HeartHandshakeIcon, TriangleAlertIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { HelpButton } from "@/features/help/components/help-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SettlementMenu } from "@/features/settlements/components/settlement-menu";
import { SettlementDialog } from "@/features/settlements/components/settlement-dialog";
import { getSettlementData, SETTLEMENT_HISTORY_LIMIT } from "@/features/settlements/queries";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { formatDateBR, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Casal" };

export default function CouplePage() {
  return (
    <>
      <PageHeader
        title="Casal"
        description="Quem deve quanto para quem."
        actions={<HelpButton topic="settlement" />}
      />
      <Suspense fallback={<CoupleSkeleton />}>
        <CoupleContent />
      </Suspense>
    </>
  );
}

async function CoupleContent() {
  const { user, active, workspaces } = await getWorkspaceContext();

  if (active.type === "personal") {
    const hasShared = workspaces.some((w) => w.type === "shared");
    return (
      <EmptyState
        icon={UserIcon}
        title="Você está no seu espaço pessoal"
        description={
          hasShared
            ? "Troque para o workspace do casal no seletor acima para ver o acerto."
            : "Crie um workspace compartilhado e convide seu par para dividirem as despesas."
        }
        action={
          hasShared ? undefined : (
            <Button nativeButton={false} render={<Link href="/workspaces" />}>
              Criar workspace do casal
            </Button>
          )
        }
      />
    );
  }

  const data = await getSettlementData(active.id);
  const today = todayISO();
  const members = data.people.filter((p) => p.isMember);
  const person = (userId: string) => data.people.find((p) => p.userId === userId);
  const isMe = (userId: string) => userId === user.id;
  // Sentence-case name: "Você" at the start of a sentence, "você" elsewhere
  const subject = (userId: string) => (isMe(userId) ? "Você" : (person(userId)?.displayName ?? "Ex-membro"));
  const object = (userId: string) => (isMe(userId) ? "você" : (person(userId)?.displayName ?? "ex-membro"));
  // A former member with a balance can still settle up with someone who is still here
  const canSettle = (fromId: string, toId: string) => !!person(fromId)?.isMember || !!person(toId)?.isMember;

  if (members.length < 2 && data.ledger.length === 0) {
    return (
      <EmptyState
        icon={HeartHandshakeIcon}
        title="Falta seu par"
        description={`Convide alguém para "${active.name}" para dividirem as despesas e acompanharem quem deve quanto.`}
        action={
          <Button nativeButton={false} render={<Link href="/workspaces" />}>
            Convidar
          </Button>
        }
      />
    );
  }

  const splitEntries = data.ledger.filter((e) => e.kind === "split" && e.amountCents > 0);
  const settledEntries = data.ledger.filter((e) => e.kind === "settlement" && e.amountCents > 0);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Situação atual</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {data.transfers.length === 0 ? (
            <div className="grid gap-1">
              <p className="text-2xl font-semibold">Vocês estão quites</p>
              <p className="text-sm text-muted-foreground">Ninguém deve nada para ninguém.</p>
            </div>
          ) : (
            <ul className="grid gap-4">
              {data.transfers.map((t) => (
                <li key={`${t.fromUserId}-${t.toUserId}`} className="grid gap-3">
                  <p className="text-lg leading-snug">
                    <span className="font-semibold">{subject(t.fromUserId)}</span>{" "}
                    deve{" "}
                    <span className="block text-3xl font-semibold tabular-nums">{formatBRL(t.amountCents)}</span>
                    para <span className="font-semibold">{object(t.toUserId)}</span>
                  </p>
                  {canSettle(t.fromUserId, t.toUserId) ? (
                    <SettlementDialog
                      workspaceId={active.id}
                      members={data.people}
                      currentUserId={user.id}
                      today={today}
                      suggestion={t}
                      trigger={
                        <Button className="w-full sm:w-auto">
                          <HandCoinsIcon aria-hidden /> Registrar acerto
                        </Button>
                      }
                    />
                  ) : (
                    <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      As duas pessoas saíram do workspace, então o acerto precisa ser combinado fora do app.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como chegamos nesse valor</CardTitle>
          <CardDescription>
            Somamos as despesas divididas de todos os meses: cada vez que alguém paga a parte do outro, o outro fica
            devendo essa parte.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {splitEntries.length === 0 && settledEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há despesas divididas. Ao lançar uma despesa, escolha quem pagou e como dividir.
            </p>
          ) : (
            <dl className="grid gap-2 text-sm">
              {splitEntries.map((e) => (
                <div key={`s-${e.creditorId}-${e.debtorId}`} className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {subject(e.creditorId)} pagou {isMe(e.debtorId) ? "a sua parte" : `a parte de ${object(e.debtorId)}`}
                  </dt>
                  <dd className="font-medium tabular-nums">{formatBRL(e.amountCents)}</dd>
                </div>
              ))}
              {settledEntries.map((e) => (
                <div key={`p-${e.creditorId}-${e.debtorId}`} className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {subject(e.creditorId)} já pagou para {object(e.debtorId)}
                  </dt>
                  <dd className="font-medium tabular-nums">{formatBRL(e.amountCents)}</dd>
                </div>
              ))}
            </dl>
          )}

          <ul className="grid gap-2 border-t pt-4 text-sm">
            {data.balances.map((b) => (
              <li key={b.userId} className="flex items-baseline justify-between gap-4">
                <span>
                  {subject(b.userId)}
                  {person(b.userId)?.isMember ? "" : " (saiu do workspace)"}
                </span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    b.balanceCents > 0 && "text-emerald-600 dark:text-emerald-400",
                    b.balanceCents < 0 && "text-destructive",
                  )}
                >
                  {b.balanceCents === 0
                    ? "quite"
                    : b.balanceCents > 0
                      ? `a receber ${formatBRL(b.balanceCents)}`
                      : `deve ${formatBRL(-b.balanceCents)}`}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>Histórico de acertos</CardTitle>
            <CardDescription>Pagamentos entre vocês. Não alteram o saldo das contas.</CardDescription>
          </div>
          {members.length >= 2 ? (
            <SettlementDialog
              workspaceId={active.id}
              members={data.people}
              currentUserId={user.id}
              today={today}
              trigger={
                <Button variant="outline" size="sm">
                  Novo
                </Button>
              }
            />
          ) : null}
        </CardHeader>
        <CardContent>
          {data.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum acerto registrado ainda.</p>
          ) : (
            <ul className="divide-y">
              {data.history.map((s) => {
                const label = `${subject(s.fromUserId)} pagou ${formatBRL(s.amountCents)} para ${object(s.toUserId)}`;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2">
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-sm">
                        {subject(s.fromUserId)} pagou{" "}
                        <span className="font-medium tabular-nums">{formatBRL(s.amountCents)}</span> para{" "}
                        {object(s.toUserId)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatDateBR(s.date)}
                        {s.note ? ` · ${s.note}` : ""}
                      </span>
                    </span>
                    <SettlementMenu
                      settlement={s}
                      label={label}
                      workspaceId={active.id}
                      people={data.people}
                      currentUserId={user.id}
                      today={today}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {data.history.length === SETTLEMENT_HISTORY_LIMIT ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Mostrando os {SETTLEMENT_HISTORY_LIMIT} acertos mais recentes.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CoupleSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

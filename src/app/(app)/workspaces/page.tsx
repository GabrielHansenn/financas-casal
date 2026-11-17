import type { Metadata } from "next";
import { HeartHandshakeIcon, UserIcon } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateWorkspaceForm } from "@/features/workspaces/components/create-workspace-form";
import { InviteForm } from "@/features/workspaces/components/invite-form";
import { MemberList } from "@/features/workspaces/components/member-list";
import { PendingInvites } from "@/features/workspaces/components/pending-invites";
import {
  DeleteWorkspaceButton,
  LeaveWorkspaceButton,
  RenameWorkspaceForm,
  UseWorkspaceButton,
} from "@/features/workspaces/components/workspace-settings";
import { getWorkspaceDetails, type WorkspaceDetail } from "@/features/workspaces/queries";

export const metadata: Metadata = { title: "Workspaces" };

export default function WorkspacesPage() {
  return (
    <>
      <PageHeader title="Workspaces" description="Seu espaço pessoal e os espaços compartilhados com o casal." />
      <Suspense fallback={<WorkspacesSkeleton />}>
        <WorkspacesContent />
      </Suspense>
    </>
  );
}

async function WorkspacesContent() {
  const { workspaces, activeId } = await getWorkspaceDetails();
  const personal = workspaces.filter((w) => w.type === "personal");
  const shared = workspaces.filter((w) => w.type === "shared");

  return (
    <div className="grid gap-6">
      {personal.map((workspace) => (
        <Card key={workspace.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="size-4" aria-hidden />
              {workspace.name}
              {workspace.id === activeId ? <Badge>Ativo</Badge> : null}
            </CardTitle>
            <CardDescription>Seu espaço privado. Ninguém mais vê o que você lança aqui.</CardDescription>
            {workspace.id !== activeId ? (
              <CardAction>
                <UseWorkspaceButton workspaceId={workspace.id} />
              </CardAction>
            ) : null}
          </CardHeader>
        </Card>
      ))}

      {shared.map((workspace) => (
        <SharedWorkspaceCard key={workspace.id} workspace={workspace} isActive={workspace.id === activeId} />
      ))}

      <Card>
        <CardHeader>
          <CardTitle>{shared.length === 0 ? "Criar o workspace do casal" : "Criar outro workspace"}</CardTitle>
          <CardDescription>
            Um espaço compartilhado onde vocês lançam as despesas da casa e acompanham quem deve quanto.
            Depois de criar, convide seu par por email ou WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm />
        </CardContent>
      </Card>
    </div>
  );
}

function SharedWorkspaceCard({ workspace, isActive }: { workspace: WorkspaceDetail; isActive: boolean }) {
  const alone = workspace.members.length === 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartHandshakeIcon className="size-4" aria-hidden />
          {workspace.name}
          {isActive ? <Badge>Ativo</Badge> : null}
        </CardTitle>
        <CardDescription>
          {alone
            ? "Só você por enquanto. Convide seu par abaixo."
            : `${workspace.members.length} membros`}
        </CardDescription>
        {!isActive ? (
          <CardAction>
            <UseWorkspaceButton workspaceId={workspace.id} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-6">
        <MemberList workspaceId={workspace.id} members={workspace.members} viewerIsOwner={workspace.isOwner} />

        {workspace.isOwner ? (
          <>
            <div className="grid gap-4">
              <InviteForm workspaceId={workspace.id} workspaceName={workspace.name} />
              <PendingInvites invites={workspace.invites} />
            </div>
            <Separator />
            <div className="grid gap-2">
              <p className="text-sm font-medium">Configurações</p>
              <RenameWorkspaceForm workspaceId={workspace.id} name={workspace.name} />
            </div>
            <div className="flex justify-end">
              <DeleteWorkspaceButton workspaceId={workspace.id} name={workspace.name} />
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <LeaveWorkspaceButton workspaceId={workspace.id} name={workspace.name} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkspacesSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

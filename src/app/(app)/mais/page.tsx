import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClockIcon,
  ChevronRightIcon,
  LandmarkIcon,
  LogOutIcon,
  TagsIcon,
  TargetIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { InstallApp } from "@/components/pwa/install-app";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/features/auth/actions";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";

export const metadata: Metadata = { title: "Mais" };

type ManageHref = "/metas" | "/recorrencias" | "/contas" | "/categorias" | "/workspaces";

const MANAGE_LINKS: { href: ManageHref; label: string; icon: LucideIcon }[] = [
  { href: "/metas", label: "Metas", icon: TargetIcon },
  { href: "/recorrencias", label: "Recorrências", icon: CalendarClockIcon },
  { href: "/contas", label: "Contas", icon: LandmarkIcon },
  { href: "/categorias", label: "Categorias", icon: TagsIcon },
  { href: "/workspaces", label: "Workspaces e convites", icon: UsersIcon },
];

export default function MorePage() {
  return (
    <>
      <PageHeader title="Mais" />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-16 w-full" />}>
              <ProfileSection />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aplicativo</CardTitle>
          </CardHeader>
          <CardContent>
            <InstallApp />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {MANAGE_LINKS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-3 py-3 transition-colors hover:text-foreground">
                    <Icon className="size-4" aria-hidden />
                    <span className="flex-1">{label}</span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <form action={signOut}>
          <Button type="submit" variant="destructive" size="lg" className="w-full">
            <LogOutIcon aria-hidden />
            Sair
          </Button>
        </form>
      </div>
    </>
  );
}

async function ProfileSection() {
  const { user } = await getWorkspaceContext();
  return (
    <div className="grid gap-4">
      <ProfileForm displayName={user.displayName} />
      <p className="text-sm text-muted-foreground">Email: {user.email}</p>
    </div>
  );
}

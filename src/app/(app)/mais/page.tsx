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
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/features/auth/actions";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";

export const metadata: Metadata = { title: "Mais" };

// Sections implemented in later phases are listed as "em breve"
const UPCOMING: { label: string; icon: LucideIcon }[] = [
  { label: "Contas", icon: LandmarkIcon },
  { label: "Categorias", icon: TagsIcon },
  { label: "Recorrências", icon: CalendarClockIcon },
  { label: "Metas", icon: TargetIcon },
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
            <CardTitle>Gerenciar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              <li>
                <Link
                  href="/workspaces"
                  className="flex items-center gap-3 py-3 transition-colors hover:text-foreground"
                >
                  <UsersIcon className="size-4" aria-hidden />
                  <span className="flex-1">Workspaces e convites</span>
                  <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
              {UPCOMING.map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-center gap-3 py-3 text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                  <span className="flex-1">{label}</span>
                  <Badge variant="secondary">Em breve</Badge>
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

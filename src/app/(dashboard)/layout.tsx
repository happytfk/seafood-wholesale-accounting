import { AppSidebar } from "@/components/app-sidebar";
import { LogoutButton } from "@/components/auth/logout-button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/auth/session";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authPromise = requireAuth();

  return (
    <AuthWrappedLayout authPromise={authPromise}>{children}</AuthWrappedLayout>
  );
}

async function AuthWrappedLayout({
  children,
  authPromise,
}: {
  children: React.ReactNode;
  authPromise: ReturnType<typeof requireAuth>;
}) {
  const auth = await authPromise;
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="text-muted-foreground truncate text-xs font-medium">
              批發市場現場模式 · 角色：{auth.role}
            </span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

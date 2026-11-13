import { Suspense } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { NavUser } from "@/components/nav-user"
import { buttonVariants } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { authConfigured, getSession, toViewer } from "@/lib/session"

async function SidebarUser() {
  const session = await getSession()
  if (session) return <NavUser viewer={toViewer(session)} />
  if (!authConfigured()) return null
  return (
    <a href="/api/auth/login?next=%2Fdashboard" className={buttonVariants({ variant: "outline" })}>
      Sign in with GitHub
    </a>
  )
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={
          <Suspense fallback={<Skeleton className="h-12 w-full rounded-lg" />}>
            <SidebarUser />
          </Suspense>
        }
      />
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

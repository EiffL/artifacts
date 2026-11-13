"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpenIcon, CodeIcon, LayoutGridIcon, StarIcon } from "lucide-react"

import { LogoMark } from "@/components/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { REPO_URL, SPEC_URL } from "@/lib/site"

const NAV = [
  { title: "My artifacts", url: "/dashboard", icon: <LayoutGridIcon /> },
  { title: "Starred", url: "/dashboard/starred", icon: <StarIcon /> },
]

const LINKS = [
  { title: "Specification", url: SPEC_URL, icon: <BookOpenIcon /> },
  { title: "Source code", url: REPO_URL, icon: <CodeIcon /> },
]

export function AppSidebar({
  user,
  ...props
}: { user: React.ReactNode } & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <LogoMark className="size-5!" />
              <span className="text-base font-semibold">Gist Artifacts</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url}
                    render={<Link href={item.url} />}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {LINKS.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton render={<a href={item.url} target="_blank" rel="noreferrer" />}>
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>{user}</SidebarFooter>
    </Sidebar>
  )
}

"use client"

import * as React from "react"
import { EllipsisVerticalIcon, ExternalLinkIcon, LogOutIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Viewer } from "@/lib/session"

function Identity({ viewer }: { viewer: Viewer }) {
  return (
    <>
      <Avatar className="size-8 rounded-lg">
        <AvatarImage src={viewer.avatarUrl} alt="" />
        <AvatarFallback className="rounded-lg">{viewer.login.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{viewer.name ?? viewer.login}</span>
        <span className="truncate text-xs text-muted-foreground">@{viewer.login}</span>
      </div>
    </>
  )
}

export function NavUser({ viewer }: { viewer: Viewer }) {
  const { isMobile } = useSidebar()
  const signOutForm = React.useRef<HTMLFormElement>(null)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" aria-label="Account" />}
          >
            <Identity viewer={viewer} />
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <Identity viewer={viewer} />
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={
                  <a href={`https://gist.github.com/${viewer.login}`} target="_blank" rel="noreferrer" />
                }
              >
                <ExternalLinkIcon />
                Your Gists on GitHub
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOutForm.current?.submit()}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <form ref={signOutForm} action="/api/auth/logout" method="post" hidden />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

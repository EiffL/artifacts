import { OnboardAgentButton } from "@/components/onboard-agent-button"
import { OpenArtifactForm } from "@/components/open-artifact-form"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader({ title }: { title: string }) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <OpenArtifactForm compact className="hidden w-72 lg:flex" />
          {/* A prompt for a coding agent is no use on a phone, where the header has little room. */}
          <OnboardAgentButton size="default" className="hidden md:inline-flex" />
        </div>
      </div>
    </header>
  )
}

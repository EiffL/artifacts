import Link from "next/link"

import { Logo } from "@/components/logo"
import { REPO_URL, SCHEMA_URL, SITE_TAGLINE, SPEC_URL } from "@/lib/site"

type FooterLink = { label: string; href: string }

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Open an artifact", href: "/#open" },
      { label: "Install the skill", href: "/#install" },
      { label: "Your artifacts", href: "/dashboard" },
      { label: "Starred", href: "/dashboard/starred" },
    ],
  },
  {
    title: "Format",
    links: [
      { label: "Specification", href: SPEC_URL },
      { label: "JSON Schema", href: SCHEMA_URL },
      { label: "Run your own viewer", href: `${REPO_URL}/blob/main/viewer/README.md` },
      { label: "Brand", href: `${REPO_URL}/tree/main/brand` },
    ],
  },
  {
    title: "Open source",
    links: [
      { label: "GitHub", href: REPO_URL },
      { label: "Issues", href: `${REPO_URL}/issues` },
      { label: "Contributing", href: `${REPO_URL}/blob/main/CONTRIBUTING.md` },
      { label: "License", href: `${REPO_URL}/blob/main/LICENSE` },
    ],
  },
]

function FooterItem({ link }: { link: FooterLink }) {
  const className = "text-muted-foreground hover:text-foreground"
  return link.href.startsWith("/") ? (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  ) : (
    <a href={link.href} className={className}>
      {link.label}
    </a>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-pretty text-muted-foreground">{SITE_TAGLINE}.</p>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-sm font-medium">{column.title}</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterItem link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t py-5 text-sm text-muted-foreground">
          <p>Open source under the MIT license. Artifacts live in your GitHub account, not here.</p>
          <p>An independent project, not affiliated with GitHub.</p>
        </div>
      </div>
    </footer>
  )
}

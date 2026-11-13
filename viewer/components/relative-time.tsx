"use client"

import * as React from "react"

import { formatDate, formatDateTime, formatRelative } from "@/lib/format"

/**
 * A shared clock that ticks once a minute. Before the first subscription (on
 * the server and during hydration) its value is 0, which means "not known yet".
 */
let now = 0
let timer: number | undefined
const listeners = new Set<() => void>()

function tick() {
  now = Date.now()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    timer = window.setInterval(tick, 60_000)
  }
  if (now === 0) tick()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.clearInterval(timer)
  }
}

/**
 * Shows a date as "3 hours ago". The server and the first client render show
 * the absolute date, so the markup always matches during hydration.
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const current = React.useSyncExternalStore(
    subscribe,
    () => now,
    () => 0
  )
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className}>
      {current ? formatRelative(iso, current) : formatDate(iso)}
    </time>
  )
}

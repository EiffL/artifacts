import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(listener: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", listener)
  return () => mql.removeEventListener("change", listener)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}

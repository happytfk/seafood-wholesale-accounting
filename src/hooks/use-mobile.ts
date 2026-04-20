import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
  const subscribe = React.useCallback((onStoreChange: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener("change", onStoreChange)
    return () => mql.removeEventListener("change", onStoreChange)
  }, [query])

  const getSnapshot = React.useCallback(() => {
    return window.matchMedia(query).matches
  }, [query])

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}

import React, { useSyncExternalStore } from 'react'
const subscribe = callback => { window.addEventListener('popstate', callback); window.addEventListener('fixture:navigation', callback); return () => { window.removeEventListener('popstate', callback); window.removeEventListener('fixture:navigation', callback) } }
const snapshot = () => window.location.pathname + window.location.search
export function useSearchParams() { const value = useSyncExternalStore(subscribe, snapshot, () => '/'); return new URLSearchParams(value.split('?')[1]) }
export function usePathname() { const value = useSyncExternalStore(subscribe, snapshot, () => '/'); return value.split('?')[0] }
export function useRouter() { return { push: url => history.pushState(history.state, '', url), replace: url => history.replaceState(history.state, '', url) } }
export default function Link({ href, prefetch: _prefetch, children, onClick, ...props }) {
  const router = useRouter()
  return <a href={href} {...props} onClick={event => {
    onClick?.(event)
    if (!event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); router.push(href) }
  }}>{children}</a>
}

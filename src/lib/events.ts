/** Proste zdarzenia między komponentami, które nie powinny trafiać do store (np. „dopasuj widok”). */
type Handler = () => void
const handlers = new Map<string, Set<Handler>>()

export function on(name: 'fit', fn: Handler) {
  if (!handlers.has(name)) handlers.set(name, new Set())
  handlers.get(name)!.add(fn)
  return () => void handlers.get(name)!.delete(fn)
}

export function emit(name: 'fit') {
  handlers.get(name)?.forEach((fn) => fn())
}

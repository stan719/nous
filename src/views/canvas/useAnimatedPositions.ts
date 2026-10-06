import { useLayoutEffect, useReducer, useRef } from 'react'
import { springOut, tween } from '../../lib/motion'
import type { VisibleNode } from './graph'

type Pt = { x: number; y: number }

/**
 * Pozycje węzłów wyświetlane na kanwie. Gdy dane się zmieniają (Uporządkuj, cofnięcie,
 * przeniesienie gałęzi), węzły płynnie przechodzą na nowe miejsca; nowe dziecko
 * „wyrasta” z rodzica. Przeciąganie omija animację — palec ma pełną kontrolę.
 */
export function useAnimatedPositions(list: VisibleNode[]) {
  const shown = useRef(new Map<string, Pt>())
  const mounted = useRef(false)
  const cancel = useRef<() => void>(() => {})
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  useLayoutEffect(() => {
    const targets = new Map<string, Pt>(list.map((v) => [v.node.id, { x: v.node.x, y: v.node.y }]))
    const moves = new Map<string, { from: Pt; to: Pt }>()

    for (const v of list) {
      const id = v.node.id
      const to = targets.get(id)!
      const cur = shown.current.get(id)
      if (!cur) {
        // nowy węzeł po starcie kanwy: zaczyna w miejscu rodzica
        const parent = v.node.parentId ? shown.current.get(v.node.parentId) : undefined
        if (mounted.current && parent) moves.set(id, { from: { ...parent }, to })
        else shown.current.set(id, to)
      } else if (cur.x !== to.x || cur.y !== to.y) {
        moves.set(id, { from: { ...cur }, to })
      }
    }
    for (const id of [...shown.current.keys()]) if (!targets.has(id)) shown.current.delete(id)
    mounted.current = true

    if (!moves.size) return
    cancel.current()
    for (const [id, m] of moves) shown.current.set(id, m.from)
    cancel.current = tween({
      duration: 520,
      ease: springOut,
      onUpdate: (p) => {
        for (const [id, m] of moves) {
          if (!shown.current.has(id)) continue
          shown.current.set(id, { x: m.from.x + (m.to.x - m.from.x) * p, y: m.from.y + (m.to.y - m.from.y) * p })
        }
        rerender()
      },
    })
  }, [list])

  /** Po upuszczeniu przeciąganego węzła: wyświetlana pozycja = nowa, bez animacji powrotnej. */
  const settle = (ids: Iterable<string>, dx: number, dy: number) => {
    for (const id of ids) {
      const p = shown.current.get(id)
      if (p) shown.current.set(id, { x: p.x + Math.round(dx), y: p.y + Math.round(dy) })
    }
  }

  const get = (id: string, fallback: Pt): Pt => shown.current.get(id) ?? fallback
  return { get, settle }
}

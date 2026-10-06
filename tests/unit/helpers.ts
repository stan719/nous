import { addChild, addRoot } from '../../src/model/tree'
import type { Nodes } from '../../src/model/types'

/** Mapa testowa: R → A (A1, A2), B; drugi punkt centralny R2. */
export function sample() {
  let nodes: Nodes = {}
  const child = (parent: string, title: string) => {
    const c = addChild(nodes, parent, title)
    nodes = c.nodes
    return c.id!
  }
  const r = addRoot(nodes, 'm', 0, 0, 'R')
  nodes = r.nodes
  const R = r.id
  const A = child(R, 'A')
  const B = child(R, 'B')
  const A1 = child(A, 'A1')
  const A2 = child(A, 'A2')
  const r2 = addRoot(nodes, 'm', 1500, 0, 'R2')
  nodes = r2.nodes
  const R2 = r2.id
  return { nodes, R, A, B, A1, A2, R2 }
}

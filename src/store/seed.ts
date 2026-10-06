import { tidy } from '../model/layout'
import { addChild, addRoot, newId, updateNode } from '../model/tree'
import type { MindMap, Nodes } from '../model/types'

/** Mapa powitalna przy pierwszym uruchomieniu — od razu uczy gestów. */
export function seedMap(): { map: MindMap; nodes: Nodes } {
  const now = Date.now()
  const map: MindMap = { id: newId(), title: 'Pierwsza mapa', showNotes: true, createdAt: now, updatedAt: now }
  let nodes: Nodes = {}

  const root = addRoot(nodes, map.id, 0, 0, 'Witaj w Nous')
  nodes = root.nodes
  const add = (parent: string, title: string, patch: Parameters<typeof updateNode>[2] = {}) => {
    const r = addChild(nodes, parent, title)
    nodes = updateNode(r.nodes, r.id!, patch)
    return r.id!
  }

  const g = add(root.id, 'Gesty', {
    color: 'sky',
    priority: 3,
    note: '- tap: zaznacz węzeł\n- drugi tap: podgląd notatki\n- przytrzymaj i przeciągnij: przesuń gałąź\n- dwa palce: przybliżanie',
  })
  add(g, 'Przytrzymaj puste miejsce, aby dodać nowy punkt centralny')
  add(g, 'Dwukrotny tap w tło dopasowuje widok')
  const n = add(root.id, 'Notatki', {
    color: 'sage',
    priority: 2,
    note: 'Przycisk ¶ u góry pokazuje lub chowa notatki na kanwie.\n\nObsługiwane: **pogrubienie**, *kursywa*, listy i zadania:\n[ ] pierwsze zadanie\n[x] zrobione',
  })
  add(n, 'Kolor dzieci dziedziczony po gałęzi')
  add(root.id, 'Kopia zapasowa', {
    color: 'amber',
    note: 'Dane są tylko na tym urządzeniu. Eksportuj czasem plik .json w „Twoje mapy”.',
  })

  nodes = tidy(nodes, root.id)

  const second = addRoot(nodes, map.id, 0, 640, 'Drugi punkt centralny')
  nodes = updateNode(second.nodes, second.id, {
    note: 'Jedna mapa może mieć wiele centrów. Węzeł można też odłączyć w edycji: „Ustaw jako punkt centralny”.',
  })
  const s1 = addChild(nodes, second.id, 'Pomysł')
  nodes = updateNode(s1.nodes, s1.id!, { color: 'iris' })
  nodes = tidy(nodes, second.id)
  return { map, nodes }
}

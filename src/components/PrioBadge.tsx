import { toRoman } from '../model/numerals'
import { PRIORITY_NAMES, type Priority } from '../model/types'

export function PrioBadge({ priority }: { priority: Priority }) {
  if (!priority) return null
  return (
    <span className={`prio p${priority}`} aria-label={`Priorytet: ${PRIORITY_NAMES[priority].toLowerCase()}`}>
      {toRoman(priority)}
    </span>
  )
}

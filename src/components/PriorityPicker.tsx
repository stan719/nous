import { toRoman } from '../model/numerals'
import { PRIORITY_NAMES, type Priority } from '../model/types'

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="pick" role="radiogroup" aria-label="Priorytet">
      {([0, 1, 2, 3] as Priority[]).map((p) => (
        <button key={p} className={value === p ? 'on' : ''} onClick={() => onChange(p)} role="radio" aria-checked={value === p}>
          <span className="r">{p ? toRoman(p) : '—'}</span>
          <small>{PRIORITY_NAMES[p]}</small>
        </button>
      ))}
    </div>
  )
}

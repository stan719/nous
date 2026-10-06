import { IconBan } from '@tabler/icons-react'
import { COLOR_NAMES, COLORS, type Color } from '../model/types'

export function Swatches({ value, onChange }: { value: Color | null; onChange: (c: Color | null) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Kolor">
      <button
        className={`none${value === null ? ' on' : ''}`}
        onClick={() => onChange(null)}
        role="radio"
        aria-checked={value === null}
        aria-label="Bez koloru (dziedziczy po rodzicu)"
      >
        <IconBan size={16} stroke={1.5} />
      </button>
      {COLORS.map((c) => (
        <button
          key={c}
          className={value === c ? 'on' : ''}
          style={{ '--c': `var(--c-${c})` } as React.CSSProperties}
          onClick={() => onChange(c)}
          role="radio"
          aria-checked={value === c}
          aria-label={COLOR_NAMES[c]}
        />
      ))}
    </div>
  )
}

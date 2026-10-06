const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return ''
  let out = ''
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

/** Polska odmiana: plural(5, ['myśl', 'myśli', 'myśli']) → "myśli" */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  if (n === 1) return one
  const d = n % 10
  const dd = n % 100
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return few
  return many
}

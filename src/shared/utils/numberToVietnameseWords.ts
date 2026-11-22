const digits = [
  '',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
]

/** Reads a 0-999 group. `notLeading` is true when a larger group precedes it. */
function readGroup(group: number, notLeading: boolean): string {
  const hundreds = Math.floor(group / 100)
  const tens = Math.floor(group / 10) % 10
  const units = group % 10
  const parts: string[] = []

  if (hundreds > 0) {
    parts.push(digits[hundreds] + ' trăm')
  } else if (notLeading) {
    parts.push('không trăm')
  }

  const hasHundreds = parts.length > 0
  if (tens === 0) {
    if (units > 0) {
      if (hasHundreds) parts.push('linh')
      parts.push(digits[units])
    }
  } else {
    if (tens === 1) {
      parts.push('mười')
    } else {
      parts.push(digits[tens] + ' mươi')
    }
    if (units === 1 && tens > 1) parts.push('mốt')
    else if (units === 5) parts.push('lăm')
    else if (units > 0) parts.push(digits[units])
  }
  return parts.join(' ')
}

/** Scale word for group index i: nghìn / triệu inside a block, tỷ repeated per block. */
function scaleWords(index: number): string[] {
  const block = Math.floor(index / 3)
  const position = index % 3
  const words = position === 1 ? ['nghìn'] : position === 2 ? ['triệu'] : []
  for (let i = 0; i < block; i++) words.push('tỷ')
  return words
}

function readInteger(value: bigint): string {
  const groups: number[] = []
  let rest = value
  while (rest > 0n) {
    groups.push(Number(rest % 1000n))
    rest /= 1000n
  }
  const top = groups.length - 1
  const words: string[] = []
  for (let index = top; index >= 0; index--) {
    const group = groups[index]
    if (group === 0) continue
    words.push(readGroup(group, index < top), ...scaleWords(index))
  }
  return words.join(' ')
}

/** Vietnamese reading of a VND amount, e.g. 1800000 -> "Một triệu tám trăm nghìn đồng chẵn". */
export function numberToVietnameseWords(value: number): string {
  if (!Number.isFinite(value)) return ''
  const amount = Math.round(value)
  if (amount === 0) return 'Không đồng'

  const reading = readInteger(BigInt(Math.abs(amount)))
  if (amount < 0) return 'Âm ' + reading + ' đồng chẵn'
  return reading.charAt(0).toUpperCase() + reading.slice(1) + ' đồng chẵn'
}

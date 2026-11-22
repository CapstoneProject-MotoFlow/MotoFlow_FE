import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/shared/utils/numberToVietnameseWords.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { numberToVietnameseWords } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

test('reads zero and small amounts', () => {
  assert.equal(numberToVietnameseWords(0), 'Không đồng')
  assert.equal(numberToVietnameseWords(5), 'Năm đồng chẵn')
  assert.equal(numberToVietnameseWords(10), 'Mười đồng chẵn')
  assert.equal(numberToVietnameseWords(15), 'Mười lăm đồng chẵn')
  assert.equal(numberToVietnameseWords(21), 'Hai mươi mốt đồng chẵn')
  assert.equal(numberToVietnameseWords(25), 'Hai mươi lăm đồng chẵn')
  assert.equal(numberToVietnameseWords(105), 'Một trăm linh năm đồng chẵn')
})

test('reads zero groups and non-leading groups with không trăm', () => {
  assert.equal(
    numberToVietnameseWords(1001),
    'Một nghìn không trăm linh một đồng chẵn',
  )
  assert.equal(
    numberToVietnameseWords(1800000),
    'Một triệu tám trăm nghìn đồng chẵn',
  )
  assert.equal(
    numberToVietnameseWords(1050000),
    'Một triệu không trăm năm mươi nghìn đồng chẵn',
  )
  assert.equal(
    numberToVietnameseWords(1000001),
    'Một triệu không trăm linh một đồng chẵn',
  )
})

test('reads large amounts with tỷ and repeated scales', () => {
  assert.equal(
    numberToVietnameseWords(12345678),
    'Mười hai triệu ba trăm bốn mươi lăm nghìn sáu trăm bảy mươi tám đồng chẵn',
  )
  assert.equal(numberToVietnameseWords(2000000000), 'Hai tỷ đồng chẵn')
  assert.equal(numberToVietnameseWords(1e12), 'Một nghìn tỷ đồng chẵn')
})

test('rounds to whole dong and handles negatives', () => {
  assert.equal(numberToVietnameseWords(1500.4), 'Một nghìn năm trăm đồng chẵn')
  assert.equal(numberToVietnameseWords(-2000), 'Âm hai nghìn đồng chẵn')
})

test('reads round amounts and amounts ending in 5 or 1 in tens', () => {
  assert.equal(numberToVietnameseWords(10_000_000), 'Mười triệu đồng chẵn')
  assert.equal(
    numberToVietnameseWords(100_005),
    'Một trăm nghìn không trăm linh năm đồng chẵn',
  )
  assert.equal(numberToVietnameseWords(21_000), 'Hai mươi mốt nghìn đồng chẵn')
  assert.equal(numberToVietnameseWords(101), 'Một trăm linh một đồng chẵn')
  assert.equal(numberToVietnameseWords(110), 'Một trăm mười đồng chẵn')
  assert.equal(numberToVietnameseWords(115), 'Một trăm mười lăm đồng chẵn')
  assert.equal(numberToVietnameseWords(5_500), 'Năm nghìn năm trăm đồng chẵn')
  assert.equal(numberToVietnameseWords(14), 'Mười bốn đồng chẵn')
  assert.equal(numberToVietnameseWords(24), 'Hai mươi bốn đồng chẵn')
  assert.equal(
    numberToVietnameseWords(1_004_000),
    'Một triệu không trăm linh bốn nghìn đồng chẵn',
  )
})

test('returns empty text for non-finite values', () => {
  assert.equal(numberToVietnameseWords(NaN), '')
  assert.equal(numberToVietnameseWords(Infinity), '')
  assert.equal(numberToVietnameseWords(-Infinity), '')
})

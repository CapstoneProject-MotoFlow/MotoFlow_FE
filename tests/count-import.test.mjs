import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/inventory/countImport.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { mapCountSheet } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
const lines = [
  { id: 1, productId: 7, sku: 'A', lotCode: 'L-1' },
  { id: 2, productId: 7, sku: 'A', lotCode: 'L-2' },
  { id: 3, productId: 8, sku: 'B', lotCode: null },
]
test('quantity import matches SKU and lot, retains zero and notes', () => {
  assert.deepEqual(
    mapCountSheet(
      [
        ['SKU', 'Mã lô', 'Số đếm', 'Ghi chú'],
        ['A', 'L-2', 0, 'Đếm lại'],
        ['B', '', 5, ''],
      ],
      lines,
      'quantity',
    ),
    [
      { id: 2, value: '0', note: 'Đếm lại' },
      { id: 3, value: '5', note: '' },
    ],
  )
})
test('ambiguous lots, unknown SKUs and duplicates reject the entire import', () => {
  for (const rows of [
    [['A', 2]],
    [['X', 2]],
    [
      ['B', 2],
      ['B', 3],
    ],
  ])
    assert.throws(() =>
      mapCountSheet([['SKU', 'Số đếm'], ...rows], lines, 'quantity'),
    )
})
test('invalid numbers and excessive notes never enter count inputs', () => {
  for (const value of ['', null, -1, 1.5, 2147483648, 'abc'])
    assert.throws(() =>
      mapCountSheet(
        [
          ['SKU', 'Số đếm'],
          ['B', value],
        ],
        lines,
        'quantity',
      ),
    )
  assert.throws(() =>
    mapCountSheet(
      [
        ['SKU', 'Số đếm', 'Ghi chú'],
        ['B', 1, 'a'.repeat(256)],
      ],
      lines,
      'quantity',
    ),
  )
})
test('opening costs map once per product even when it has several lots', () => {
  assert.deepEqual(
    mapCountSheet(
      [
        ['SKU', 'Giá vốn'],
        ['A', 0],
        ['B', 12000],
      ],
      lines,
      'cost',
    ),
    [
      { id: 7, value: '0', note: '' },
      { id: 8, value: '12000', note: '' },
    ],
  )
  assert.throws(() =>
    mapCountSheet(
      [
        ['SKU', 'Giá vốn'],
        ['A', 1],
        ['A', 2],
      ],
      lines,
      'cost',
    ),
  )
})
test('empty sheets and missing required columns are rejected', () => {
  for (const rows of [
    [],
    [['SKU', 'Số đếm']],
    [
      ['SKU', 'Giá vốn'],
      ['B', 2],
    ],
  ])
    assert.throws(() => mapCountSheet(rows, lines, 'quantity'))
})

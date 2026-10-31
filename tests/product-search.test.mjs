import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const source = readFileSync(new URL('../src/modules/catalog/api/searchProducts.ts', import.meta.url), 'utf8').replace("import axiosClient from '../../../shared/api/axiosClient'", 'const axiosClient = globalThis.__productSearchClient')
const calls = []
const result = { items: [{ id: 9 }], totalItems: 3000 }
globalThis.__productSearchClient = { get: async (...args) => { calls.push(args); return { data: result } } }
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
const { searchProducts } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'))
delete globalThis.__productSearchClient
const categories = [{ id: 7, categoryName: 'Hệ thống phanh' }]
const models = [{ id: 8, manufacturer: 'Honda', modelName: 'Wave' }]
test('resolved filters make one request and preserve server pagination, brand and response order', async () => {
  calls.length = 0
  const signal = new AbortController().signal
  const data = await searchProducts({ brand: 'GS', page: 2, size: 20 }, 'he thong phanh', categories, signal, 'xe may', 'Honda Wave', models)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0][1].params, { brand: 'GS', page: 2, size: 20, categoryId: 7, vehicleType: 'MOTORCYCLE', vehicleModelId: 8 })
  assert.equal(calls[0][1].signal, signal)
  assert.equal(data, result)
})
test('ambiguous partial input never fans out requests or loads the catalog', async () => {
  calls.length = 0
  const data = await searchProducts({ page: 0, size: 20 }, '', categories, new AbortController().signal, 'xe', '', models)
  assert.equal(calls.length, 0)
  assert.deepEqual(data, { items: [], totalItems: 0 })
})

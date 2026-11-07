import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/owner/managerPermissions.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { readManagers, hasManagerPermission, managerPermissionChange } =
  await import(
    'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  )
const row = {
  id: 2,
  username: 'bm',
  fullName: null,
  storeId: 2,
  storeName: null,
  status: 'ACTIVE',
  catalogEdit: true,
  retailPriceEdit: false,
}
test('Owner reads BE boolean permission flags without requiring a permissions array', () => {
  const [manager] = readManagers([row])
  assert.equal(hasManagerPermission(manager, 'CATALOG_EDIT'), true)
  assert.equal(hasManagerPermission(manager, 'RETAIL_PRICE_EDIT'), false)
  assert.equal(manager.fullName, null)
})
test('changing either permission preserves the other BE flag for every initial state', () => {
  for (const catalogEdit of [false, true])
    for (const retailPriceEdit of [false, true]) {
      const manager = { ...row, catalogEdit, retailPriceEdit }
      assert.deepEqual(
        managerPermissionChange(manager, 'CATALOG_EDIT', '  kiểm tra  '),
        { catalogEdit: !catalogEdit, retailPriceEdit, reason: 'kiểm tra' },
      )
      assert.deepEqual(
        managerPermissionChange(manager, 'RETAIL_PRICE_EDIT', 'kiểm tra'),
        { catalogEdit, retailPriceEdit: !retailPriceEdit, reason: 'kiểm tra' },
      )
    }
})
test('missing or invalid permission fields are an error rather than a false permission state', () => {
  for (const value of [
    null,
    {},
    [null],
    [{ ...row, catalogEdit: undefined }],
    [{ ...row, retailPriceEdit: 'false' }],
    [{ id: 2, username: 'bm', permissions: ['CATALOG_EDIT'] }],
  ])
    assert.throws(() => readManagers(value))
  assert.deepEqual(readManagers([]), [])
})

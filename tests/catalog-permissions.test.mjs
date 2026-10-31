import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/shared/utils/roles.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { canEditCatalog } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('catalog edits require Owner or a permitted Branch Manager', () => {
  assert.equal(canEditCatalog({ role: 'OWNER' }), true)
  assert.equal(
    canEditCatalog({ role: 'BRANCH_MANAGER', permissions: ['CATALOG_EDIT'] }),
    true,
  )
  for (const user of [
    null,
    { role: 'ADMIN' },
    { role: 'STAFF', permissions: ['CATALOG_EDIT'] },
    { role: 'BRANCH_MANAGER', permissions: [] },
    { role: 'BRANCH_MANAGER', permissions: ['PERM_CATALOG_EDIT'] },
  ])
    assert.equal(canEditCatalog(user), false)
})

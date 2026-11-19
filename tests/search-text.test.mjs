import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/shared/utils/searchText.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { foldSearch, matchesSearch } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

test('search ignores Vietnamese diacritics and letter case (PM 19/11 mục C)', () => {
  assert.equal(foldSearch('  Nguyễn Văn An '), 'nguyen van an')
  assert.equal(foldSearch('ĐỖ MẠNH CƯỜNG'), 'do manh cuong')
  assert.ok(matchesSearch('nguyen van an', 'Nguyễn Văn An'))
  assert.ok(matchesSearch('Nguyễn', 'nguyen van an'))
  assert.ok(matchesSearch('dau nhot', null, 'Dầu nhớt - hóa chất'))
  assert.ok(matchesSearch('   ', 'bất kỳ'))
  assert.equal(matchesSearch('lop', 'Bugi NGK', undefined), false)
})

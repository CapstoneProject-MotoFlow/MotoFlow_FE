import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/shared/utils/format.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { formatIpAddress } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('a session IP shows loopback addresses as the server itself and a missing one as a dash', () => {
  assert.equal(formatIpAddress('127.0.0.1'), 'Máy chủ (localhost)')
  assert.equal(formatIpAddress('::1'), 'Máy chủ (localhost)')
  assert.equal(formatIpAddress('0:0:0:0:0:0:0:1'), 'Máy chủ (localhost)')
  assert.equal(formatIpAddress('113.161.4.20'), '113.161.4.20')
  assert.equal(formatIpAddress(null), '—')
  assert.equal(formatIpAddress(''), '—')
})

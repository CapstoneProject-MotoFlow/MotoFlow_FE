import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/shared/utils/passwordPolicy.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { validateNewPassword } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('password policy accepts a single letter case with digits and a special character', () => {
  for (const password of ['abc@1234', 'ABC@1234'])
    assert.equal(
      validateNewPassword(password, 'temporary', 'username').isValid,
      true,
    )
})
test('password policy still rejects missing character groups and reused passwords', () => {
  for (const password of [
    '1234567@',
    'abcdefgh',
    'abc12345',
    'ab@123',
    'temporary@123',
  ])
    assert.equal(
      validateNewPassword(password, 'temporary@123', 'username').isValid,
      false,
    )
})

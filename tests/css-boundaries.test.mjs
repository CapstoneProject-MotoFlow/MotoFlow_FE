import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import postcss from 'postcss'
const src = new URL('../src/', import.meta.url)
const read = (file) => readFileSync(new URL(file, src), 'utf8')
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : [join(dir, entry.name)],
  )
}
test('main loads only global CSS and shared UI has no dashboard-only components', () => {
  const imports = [
    ...read('main.tsx').matchAll(/import ['"]([^'"]+\.css)['"]/g),
  ].map((match) => match[1])
  assert.deepEqual(imports, ['./shared/assets/styles/global.css'])
  assert.doesNotMatch(
    read('shared/assets/styles/ui.css'),
    /\.(metric-card|product-panel|recent-login-panel)\b/,
  )
})
test('modules do not import styles from another module', () => {
  for (const file of files(fileURLToPath(new URL('modules/', src))).filter(
    (file) => /\.tsx$/.test(file),
  )) {
    for (const match of readFileSync(file, 'utf8').matchAll(
      /import ['"]([^'"]+\.css)['"]/g,
    )) {
      assert.ok(!match[1].startsWith('../../'), file + ': ' + match[1])
    }
  }
})
test('layout never stretches every button or input and owner notice is owned by layout', () => {
  const layout = read('app/layouts/layouts.css')
  const ast = postcss.parse(layout)
  ast.walkRules((rule) => {
    if (
      !rule.selector
        .split(',')
        .some((selector) =>
          /^\.admin-dashboard (button|input)(:|$)/.test(selector.trim()),
        )
    )
      return
    rule.walkDecls('min-height', () =>
      assert.fail('Unscoped min-height: ' + rule.selector),
    )
  })
  assert.match(layout, /\.owner-notice\s*\{/)
  assert.doesNotMatch(read('modules/owner/owner.css'), /\.owner-notice\s*\{/)
})

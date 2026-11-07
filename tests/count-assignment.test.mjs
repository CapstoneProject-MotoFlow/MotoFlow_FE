import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/inventory/countAssignment.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { canAssignCounter, submitCountAssignment } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
const assignment = {
  documentId: 4,
  canAssign: true,
  eligibleAssignees: [{ id: 7, fullName: 'A', self: false, openTasks: 1 }],
}
test('count assignment requires loaded authorization and a current eligible assignee for the same document', () => {
  assert.equal(canAssignCounter(assignment, 4, 7), true)
  for (const [data, id, person, busy] of [
    [undefined, 4, 7, false],
    [{ ...assignment, canAssign: false }, 4, 7, false],
    [assignment, 5, 7, false],
    [assignment, 4, 8, false],
    [assignment, 4, 7, true],
    [assignment, 4, undefined, false],
    [assignment, 0, 7, false],
  ])
    assert.equal(canAssignCounter(data, id, person, busy), false)
})
test('count assignment sends the exact COUNTING payload once and propagates BE rejection', async () => {
  const sent = []
  await submitCountAssignment(assignment, 4, 7, false, async (body) =>
    sent.push(body),
  )
  assert.deepEqual(sent, [
    { taskType: 'COUNTING', documentId: 4, assigneeId: 7 },
  ])
  await assert.rejects(
    submitCountAssignment(
      { ...assignment, canAssign: false },
      4,
      7,
      false,
      async (body) => sent.push(body),
    ),
  )
  assert.equal(sent.length, 1)
  await assert.rejects(
    submitCountAssignment(assignment, 4, 7, false, async () => {
      throw new Error('MSG05')
    }),
    /MSG05/,
  )
})

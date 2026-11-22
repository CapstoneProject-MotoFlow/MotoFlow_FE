import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/shared/hooks/searchCommit.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { createSearchCommitter } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

/** Đồng hồ giả: schedule đưa việc vào hàng đợi, advance() chạy các việc đến hạn. */
function fakeClock() {
  let now = 0
  let nextId = 1
  const jobs = new Map()
  return {
    schedule(run, ms) {
      const id = nextId++
      jobs.set(id, { at: now + ms, run })
      return id
    },
    cancel(id) {
      jobs.delete(id)
    },
    advance(ms) {
      now += ms
      for (const [id, job] of [...jobs]) {
        if (job.at <= now) {
          jobs.delete(id)
          job.run()
        }
      }
    },
    pending: () => jobs.size,
  }
}

function setup() {
  const clock = fakeClock()
  const commits = []
  const committer = createSearchCommitter({
    onCommit: (v) => commits.push(v),
    schedule: clock.schedule,
    cancel: clock.cancel,
  })
  return { clock, commits, committer }
}

test('typing commits only once, 300 ms after the last keystroke', () => {
  const { clock, commits, committer } = setup()
  committer.input('s')
  clock.advance(100)
  committer.input('sp')
  clock.advance(299)
  assert.deepEqual(commits, [])
  committer.input('spa')
  clock.advance(299)
  assert.deepEqual(commits, [])
  clock.advance(1)
  assert.deepEqual(commits, ['spa'])
})

test('no commit while an IME composition is in progress', () => {
  const { clock, commits, committer } = setup()
  committer.compositionStart()
  committer.input('d')
  committer.input('đ')
  clock.advance(1000)
  assert.deepEqual(commits, [])
  assert.equal(committer.isComposing(), true)
})

test('a debounce pending when composition starts is dropped', () => {
  const { clock, commits, committer } = setup()
  committer.input('a')
  clock.advance(100)
  committer.compositionStart()
  clock.advance(1000)
  assert.deepEqual(commits, [])
})

test('compositionend commits the final text immediately', () => {
  const { commits, committer } = setup()
  committer.compositionStart()
  committer.compositionEnd('phanh')
  assert.deepEqual(commits, ['phanh'])
  assert.equal(committer.isComposing(), false)
})

test('Enter commits immediately and cancels the pending debounce', () => {
  const { clock, commits, committer } = setup()
  committer.input('ph')
  committer.flush('ph')
  assert.deepEqual(commits, ['ph'])
  clock.advance(1000)
  assert.deepEqual(commits, ['ph'])
})

test('an external reset cancels the pending debounce so the old text is not committed', () => {
  const { clock, commits, committer } = setup()
  committer.input('abc')
  clock.advance(100)
  committer.reset('')
  clock.advance(1000)
  assert.deepEqual(commits, [])
  assert.equal(clock.pending(), 0)
  assert.equal(committer.committed(), '')
})

test('a value equal to the last committed one is not committed again (Safari input after compositionend)', () => {
  const { clock, commits, committer } = setup()
  committer.compositionStart()
  committer.compositionEnd('nước')
  committer.input('nước')
  clock.advance(1000)
  assert.deepEqual(commits, ['nước'])
})

test('after Enter, typing the same text again does not commit it twice', () => {
  const { clock, commits, committer } = setup()
  committer.flush('ph')
  committer.input('ph')
  clock.advance(1000)
  assert.deepEqual(commits, ['ph'])
})

test('a value set from outside as the initial text is never committed back', () => {
  const clock = fakeClock()
  const commits = []
  const committer = createSearchCommitter({
    initial: 'sữa',
    onCommit: (v) => commits.push(v),
    schedule: clock.schedule,
    cancel: clock.cancel,
  })
  committer.input('sữa')
  clock.advance(1000)
  assert.deepEqual(commits, [])
  committer.input('sữa!')
  clock.advance(1000)
  assert.deepEqual(commits, ['sữa!'])
})

test('Enter is ignored while composing', () => {
  const { commits, committer } = setup()
  committer.compositionStart()
  committer.flush('ph')
  assert.deepEqual(commits, [])
})

test('dispose cancels a pending commit', () => {
  const { clock, commits, committer } = setup()
  committer.input('x')
  committer.dispose()
  assert.equal(clock.pending(), 0)
  clock.advance(1000)
  assert.deepEqual(commits, [])
})

test('a Telex word typed in pieces commits only its final form', () => {
  const { clock, commits, committer } = setup()
  committer.compositionStart()
  committer.input('n')
  committer.input('nư')
  committer.input('nướ')
  committer.compositionEnd('nước')
  clock.advance(1000)
  assert.deepEqual(commits, ['nước'])
})

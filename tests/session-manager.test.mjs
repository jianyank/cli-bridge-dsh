import test from 'node:test'
import assert from 'node:assert/strict'

const { SessionManager } = await import('../lib/session-manager.js')

function fakeBackend() {
  const sessions = new Map()
  let next = 1
  return {
    starts: [], writes: [], interrupts: [], closes: [],
    async start({ provider, onData, onExit }) {
      const handle = { id: next++, provider, alive: true, onData, onExit }
      sessions.set(handle, handle)
      this.starts.push(handle)
      return { pid: 1000 + handle.id, handle }
    },
    write(handle, data) { this.writes.push([handle.id, data]) },
    interrupt(handle) { this.interrupts.push(handle.id); handle.onExit({ exitCode: 130 }) },
    async close(handle) { this.closes.push(handle.id); handle.alive = false; handle.onExit({ exitCode: 130 }) },
    isAlive(handle) { return handle.alive },
    emit(handle, data) { handle.onData(data) },
    exit(handle, event = { exitCode: 0 }) { handle.alive = false; handle.onExit(event) },
  }
}

function config(overrides = {}) {
  return { maxSessions: 4, maxBufferChars: 10, defaultTimeoutMs: 0, ...overrides }
}

async function eventually(check) {
  for (let i = 0; i < 30; i++) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  assert.fail('condition was not reached')
}

test('keeps concurrent sessions and output streams isolated', async () => {
  const backend = fakeBackend()
  let id = 0
  const manager = new SessionManager({ config: config(), backend, idFactory: () => `term_test${++id}` })
  const first = manager.start({ provider: 'claude', prompt: '', cwd: 'D:/work', taskId: 'a', timeoutMs: 0 }, { parentSessionId: 'parent-a' })
  const second = manager.start({ provider: 'codex', prompt: '', cwd: 'D:/work', taskId: 'b', timeoutMs: 0 }, { parentSessionId: 'parent-b' })
  await eventually(() => backend.starts.length === 2)
  backend.emit(backend.starts[0], 'first')
  backend.emit(backend.starts[1], 'second')
  assert.equal(manager.list().find((item) => item.terminalId === first.terminalId).recentOutput, 'first')
  assert.equal(manager.list().find((item) => item.terminalId === second.terminalId).recentOutput, 'second')
  assert.equal(manager.list().find((item) => item.terminalId === first.terminalId).parentSessionId, 'parent-a')
})

test('preserves an exit that arrives before the backend promise resolves', async () => {
  const backend = {
    async start({ onExit }) {
      onExit({ exitCode: 0 })
      return { pid: 1001, handle: { alive: false } }
    },
    close() {},
    isAlive() { return false },
  }
  const manager = new SessionManager({ config: config(), backend, idFactory: () => 'term_fast_exit' })
  const started = manager.start({ provider: 'claude', prompt: '', cwd: 'D:/work', timeoutMs: 0 })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(manager.get(started.terminalId).status, 'exited')
  assert.equal(manager.get(started.terminalId).exitCode, 0)
})

test('keeps a bounded output ring and publishes ordered events', async () => {
  const backend = fakeBackend()
  const manager = new SessionManager({ config: config({ maxBufferChars: 5 }), backend, idFactory: () => 'term_ring' })
  const events = []
  manager.subscribe((event) => events.push(event))
  const started = manager.start({ provider: 'claude', prompt: '', cwd: 'D:/work', timeoutMs: 0 })
  await eventually(() => backend.starts.length === 1)
  backend.emit(backend.starts[0], '1234')
  backend.emit(backend.starts[0], '56789')
  assert.equal(manager.get(started.terminalId).outputBuffer, '56789')
  assert.deepEqual(events.filter((event) => event.type === 'output').map((event) => event.data), ['1234', '56789'])
})

test('writes selected terminal, sends enter, and interrupts only it', async () => {
  const backend = fakeBackend()
  const manager = new SessionManager({ config: config(), backend, idFactory: (() => { let n = 0; return () => `term_write${++n}` })() })
  const first = manager.start({ provider: 'claude', prompt: '', cwd: 'D:/work', timeoutMs: 0 })
  const second = manager.start({ provider: 'codex', prompt: '', cwd: 'D:/work', timeoutMs: 0 })
  await eventually(() => backend.starts.length === 2)
  manager.write(first.terminalId, 'hello', true)
  manager.interrupt(second.terminalId)
  assert.deepEqual(backend.writes, [[1, 'hello'], [1, '\r']])
  assert.deepEqual(backend.interrupts, [2])
})

test('marks nonzero exit, rejects unknown ids, and disposes all sessions', async () => {
  const backend = fakeBackend()
  const manager = new SessionManager({ config: config(), backend, idFactory: (() => { let n = 0; return () => `term_exit${++n}` })() })
  const first = manager.start({ provider: 'claude', prompt: '', cwd: 'D:/work', timeoutMs: 0 })
  const second = manager.start({ provider: 'codex', prompt: '', cwd: 'D:/work', timeoutMs: 0 })
  await eventually(() => backend.starts.length === 2)
  backend.exit(backend.starts[0], { exitCode: 7 })
  assert.equal(manager.get(first.terminalId).status, 'exited')
  assert.equal(manager.get(first.terminalId).exitCode, 7)
  assert.throws(() => manager.write('term_missing', 'x', false), (error) => error.code === 'unknown-terminal')
  await manager.dispose()
  assert.deepEqual(backend.closes, [2])
  assert.throws(() => manager.start({ provider: 'claude', prompt: '', cwd: 'D:/work', timeoutMs: 0 }), (error) => error.code === 'manager-disposed')
})

test('interrupts and force closes a timed out session', async () => {
  const backend = fakeBackend()
  const manager = new SessionManager({ config: config({ defaultTimeoutMs: 5 }), backend, idFactory: () => 'term_timeout' })
  const started = manager.start({ provider: 'claude', prompt: '', cwd: 'D:/work', timeoutMs: 5 })
  await eventually(() => backend.starts.length === 1)
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.deepEqual(backend.interrupts, [1])
  assert.deepEqual(backend.closes, [1])
  assert.equal(manager.get(started.terminalId).status, 'interrupted')
})

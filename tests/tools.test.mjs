import './support/sdk.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { isJsonValue } = await import('@deepseek-ai/dsh-util-values')

const { apply } = await import('../index.js')

function harness() {
  const tools = new Map()
  const calls = { starts: [], writes: [], interrupts: [], closes: [] }
  const backend = {
    async start(input) {
      calls.starts.push(input)
      const handle = { input, alive: true }
      return { pid: 1234, handle }
    },
    write(handle, data) { calls.writes.push([handle, data]) },
    interrupt(handle) { calls.interrupts.push(handle) },
    async close(handle) { calls.closes.push(handle); handle.alive = false },
    isAlive(handle) { return handle.alive },
  }
  const ctx = {
    effect(callback) { return callback() },
    tools: { register(tool) { tools.set(tool.name, tool); return () => tools.delete(tool.name) } },
    inject(_deps, callback) {
      return callback({
        effect: (fn) => fn(),
        webRuntime: { trustedHosts: [] },
        webServer: { register: () => () => {} },
      })
    },
  }
  const manager = apply(ctx, { workspaceRoot: 'D:/workspace', allowedCwds: [] }, { backend })
  return { tools, calls, manager }
}

test('registers the CLI lifecycle tools and returns JSON values', async () => {
  const app = harness()
  assert.deepEqual([...app.tools.keys()], ['cli_start', 'cli_write', 'cli_interrupt', 'cli_close', 'cli_list'])
  const started = await app.tools.get('cli_start').execute({
    provider: 'claude', prompt: 'inspect repo', cwd: 'D:/workspace', taskId: 'task-7', interactive: false,
  }, { agent: { session: { id: 'parent-9' } } })
  assert.ok(isJsonValue(started))
  assert.equal(started.provider, 'claude')
  assert.equal(started.taskId, 'task-7')
  assert.equal(started.parentSessionId, 'parent-9')
  assert.equal(app.calls.starts[0].prompt, 'inspect repo')
  assert.equal(app.calls.starts[0].interactive, false)
})

test('routes writes, interrupt, close and list to the selected terminal', async () => {
  const app = harness()
  const started = await app.tools.get('cli_start').execute({ provider: 'codex', prompt: '', cwd: 'D:/workspace' }, {})
  const id = started.terminalId
  const written = await app.tools.get('cli_write').execute({ terminalId: id, data: 'yes', enter: true })
  assert.ok(isJsonValue(written))
  await app.tools.get('cli_interrupt').execute({ terminalId: id })
  await app.tools.get('cli_close').execute({ terminalId: id })
  const listed = await app.tools.get('cli_list').execute({})
  assert.ok(isJsonValue(listed))
  assert.equal(app.calls.writes.length, 2)
  assert.equal(app.calls.writes[1][1], '\r')
  assert.equal(app.calls.interrupts.length, 1)
  assert.equal(app.calls.closes.length, 1)
})

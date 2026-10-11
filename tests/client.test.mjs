import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

test('client endpoints retain the DSH deployment prefix', async () => {
  const { endpoint } = await import('../client/api.js')
  assert.equal(endpoint('sessions', 'dsh-app://app/').href, 'dsh-app://app/dsh-cli-bridge/sessions')
  assert.equal(endpoint('/events', 'https://host/dsh/?x=1#cli').href, 'https://host/dsh/dsh-cli-bridge/events')
})

test('client commands use JSON and surface bridge errors', async () => {
  const { command } = await import('../client/api.js')
  let sent
  const fetcher = async (_url, options) => {
    sent = options
    return { ok: true, json: async () => ({ ok: true, value: { status: 'running' } }) }
  }
  const value = await command('input', { terminalId: 'term_test', data: 'hi', enter: true }, fetcher, 'http://localhost/')
  assert.deepEqual(value, { status: 'running' })
  assert.equal(sent.method, 'POST')
  assert.deepEqual(JSON.parse(sent.body), { terminalId: 'term_test', data: 'hi', enter: true })
})

test('manifest publishes the xterm client and shell overlay', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  assert.equal(manifest.exports['./client'], './dist/client.js')
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-slots'))
  assert.ok(manifest.files.includes('dist'))
})

test('published client registers the collapsible CLI overlay slot', async () => {
  const source = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8')
  let loaded
  let registration
  const style = {}
  runInNewContext(source, {
    window: { __ModuleLoader__: { load: (entry) => { loaded = entry } } },
    document: { createElement: () => ({ dataset: {} }), head: { append: (value) => Object.assign(style, value) } },
  })
  assert.equal(loaded.id, 'dsh-cli-bridge')
  const plugin = loaded.factory((name) => {
    assert.ok(['react', '@deepseek-ai/dsh-client-ui-primitives', '@xterm/xterm'].includes(name))
    return {}
  })
  assert.equal(JSON.stringify(plugin.inject), JSON.stringify(['slots']))
  plugin.apply({ slots: {
    inject: (name, callback) => { assert.equal(name, 'shell.overlay'); callback() },
    register: (entry, component) => { registration = entry; assert.equal(typeof component, 'function') },
  } })
  assert.equal(registration.id, 'dsh-cli-bridge')
  assert.equal(registration.label(), 'CLI 终端')
  assert.ok(style.textContent.includes('.dcb-panel'))
})

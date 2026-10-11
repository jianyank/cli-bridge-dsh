import { spawn as spawnProcess } from 'node:child_process'
import { validateProvider } from './validation.js'
import { loadPty } from './pty-loader.js'

function invalid(code, message) {
  return Object.assign(new Error(message), { code, status: 400 })
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function defaultProcessKiller(pid) {
  await new Promise((resolve, reject) => {
    const child = spawnProcess('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
      shell: false,
    })
    child.once('error', reject)
    child.once('exit', () => resolve())
  })
}

export function createPtyBackend({ config, ptyModule, processKiller = defaultProcessKiller, graceMs = 250 }) {
  const records = new WeakMap()

  async function start({ provider, prompt, cwd, interactive, onData, onExit }) {
    validateProvider(provider)
    const pty = ptyModule ?? await loadPty()
    const command = provider === 'claude' ? config.claudeCommand : config.codexCommand
    const args = interactive ? [] : [prompt]
    const handle = pty.spawn(command, args, {
      name: 'xterm-256color', cols: 120, rows: 30, cwd,
      env: { ...process.env }, useConpty: true,
    })
    const record = { pid: handle.pid, alive: true, owned: true }
    records.set(handle, record)
    handle.onData?.((data) => onData?.(data))
    handle.onExit?.((event) => {
      record.alive = false
      onExit?.(event)
    })
    if (interactive && prompt) {
      handle.write(prompt)
      handle.write('\r')
    }
    return { pid: record.pid, handle }
  }

  function recordOf(handle) {
    const record = records.get(handle)
    if (!record?.owned || !record.pid) throw invalid('unknown-process', 'process is not owned by this plugin')
    return record
  }

  function write(handle, data) {
    recordOf(handle)
    handle.write(data)
  }

  function interrupt(handle) {
    recordOf(handle)
    if (records.get(handle).alive) handle.write('\u0003')
  }

  async function close(handle) {
    const record = recordOf(handle)
    if (!record.alive) return
    handle.write('\u0003')
    if (graceMs > 0) await wait(graceMs)
    if (record.alive) {
      await processKiller(record.pid)
      record.alive = false
    }
  }

  function isAlive(handle) {
    return recordOf(handle).alive
  }

  return { start, write, interrupt, close, isAlive }
}

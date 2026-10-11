import { createElement as h, useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Terminal } from '@xterm/xterm'
import { command, eventSource, listSessions } from './api.js'

export const inject = ['slots']

function safe(value) {
  return value == null ? '' : String(value)
}

function TerminalCard({ session, collapsed, onToggle, onClose, onInterrupt, onInput, onReady }) {
  const terminalNode = useRef(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!terminalNode.current) return undefined
    const instance = new Terminal({
      convertEol: true,
      scrollback: 2500,
      cursorBlink: true,
      fontSize: 12,
      theme: { background: '#151719', foreground: '#e8eaed', cursor: '#78a9ff' },
    })
    instance.open(terminalNode.current)
    if (session.recentOutput) instance.write(session.recentOutput)
    onReady(session.terminalId, instance)
    return () => {
      onReady(session.terminalId, null)
      instance.dispose()
    }
  }, [session.terminalId])

  async function submit(enter = false) {
    if (!draft && !enter) return
    await onInput(session.terminalId, draft, enter)
    setDraft('')
  }

  return h('section', { className: 'dcb-card' },
    h('header', { className: 'dcb-card-head' },
      h('div', { className: 'dcb-card-title' },
        h('strong', null, safe(session.provider)),
        h('span', { className: 'dcb-status' }, safe(session.status)),
        session.taskId && h('span', { className: 'dcb-task' }, safe(session.taskId)),
      ),
      h('div', { className: 'dcb-card-actions' },
        h(Button, { variant: 'outline', onClick: onToggle, 'aria-expanded': !collapsed }, collapsed ? '展开' : '收起'),
        h(Button, { variant: 'outline', onClick: () => onInterrupt(session.terminalId), disabled: !['running', 'waiting-input'].includes(session.status) }, 'Ctrl+C'),
        h(Button, { variant: 'outline', onClick: () => onClose(session.terminalId), disabled: ['exited', 'failed'].includes(session.status) }, '关闭'),
      ),
    ),
    h('div', { className: 'dcb-terminal-wrap', hidden: collapsed }, h('div', { className: 'dcb-terminal', ref: terminalNode })),
    !collapsed && h('form', { className: 'dcb-input', onSubmit: (event) => { event.preventDefault(); void submit(true) } },
      h('input', { value: draft, onChange: (event) => setDraft(event.target.value), placeholder: '输入到终端', 'aria-label': '终端输入' }),
      h(Button, { type: 'submit', variant: 'primary' }, '发送'),
    ),
  )
}

export function CliBridgePanel() {
  const [sessions, setSessions] = useState([])
  const [collapsed, setCollapsed] = useState(() => new Set())
  const terminals = useRef(new Map())
  const pending = useRef(new Map())
  const mounted = useRef(true)

  function ready(id, instance) {
    if (instance) {
      terminals.current.set(id, instance)
      const queued = pending.current.get(id)
      if (queued) { instance.write(queued); pending.current.delete(id) }
    } else terminals.current.delete(id)
  }

  useEffect(() => {
    mounted.current = true
    let source
    void listSessions().then((value) => {
      if (mounted.current) setSessions(value)
    }).catch(() => {})
    try {
      source = eventSource()
      source.addEventListener('snapshot', (event) => {
        const value = JSON.parse(event.data)
        if (mounted.current) setSessions(value)
      })
      source.addEventListener('output', (event) => {
        const value = JSON.parse(event.data)
        const text = safe(value.data)
        const card = terminals.current.get(value.terminalId)
        if (card) card.write(text)
        else pending.current.set(value.terminalId, (pending.current.get(value.terminalId) ?? '') + text)
        setSessions((current) => current.map((item) => item.terminalId === value.terminalId
          ? { ...item, recentOutput: (item.recentOutput ?? '').slice(-240) + text.slice(-240) }
          : item))
      })
      source.addEventListener('status', (event) => {
        const value = JSON.parse(event.data)
        setSessions((current) => current.map((item) => item.terminalId === value.terminalId ? { ...item, ...value } : item))
      })
    } catch {}
    return () => {
      mounted.current = false
      source?.close()
      terminals.current.clear()
    }
  }, [])

  function toggle(id) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function input(id, data, enter) { await command('input', { terminalId: id, data, enter }) }
  async function interrupt(id) { await command('interrupt', { terminalId: id }) }
  async function close(id) {
    await command('close', { terminalId: id })
    setSessions((current) => current.map((item) => item.terminalId === id ? { ...item, status: 'interrupted' } : item))
  }

  return h('div', { className: 'dcb-panel', 'aria-label': 'CLI 终端' },
    h('header', { className: 'dcb-panel-head' }, h('strong', null, 'CLI 终端'), h('span', null, String(sessions.length) + ' 个会话')),
    sessions.length === 0 ? h('div', { className: 'dcb-empty' }, '暂无运行中的 Claude 或 Codex 任务') : sessions.map((session) => h('div', { key: session.terminalId, 'data-terminal-id': session.terminalId }, h(TerminalCard, {
      session,
      collapsed: collapsed.has(session.terminalId),
      onToggle: () => toggle(session.terminalId),
      onClose: close,
      onInterrupt: interrupt,
      onInput: input,
      onReady: ready,
    }))),
  )
}

export function apply(ctx) {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'dsh-cli-bridge', order: 40,
    label: () => 'CLI 终端', inject: () => ({}),
  }, CliBridgePanel))
}

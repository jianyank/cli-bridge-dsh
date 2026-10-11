window.__ModuleLoader__.load({ id: "dsh-cli-bridge", factory: (require) => {
const module = { exports: {} }; const exports = module.exports;
const style = document.createElement("style"); style.dataset.dshCliBridge = "true";
style.textContent = ".dcb-panel { width: min(100%, 980px); max-height: min(48vh, 560px); overflow: auto; color: var(--dsw-alias-label-primary); font-size: 13px; letter-spacing: 0; }\n.dcb-panel-head, .dcb-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }\n.dcb-panel-head { min-height: 30px; padding: 4px 0 8px; }\n.dcb-card { border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-layer-2); margin: 6px 0; overflow: hidden; }\n.dcb-card-head { padding: 7px 9px; min-width: 0; }\n.dcb-card-title { display: flex; align-items: center; gap: 7px; min-width: 0; flex-wrap: wrap; }\n.dcb-card-title strong { text-transform: lowercase; }\n.dcb-status, .dcb-task { color: var(--dsw-alias-label-secondary); white-space: nowrap; }\n.dcb-card-actions { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }\n.dcb-terminal-wrap { padding: 0 7px 7px; }\n.dcb-terminal { height: 210px; min-height: 150px; background: #151719; border-radius: 4px; overflow: hidden; }\n.dcb-input { display: flex; gap: 6px; padding: 0 7px 7px; }\n.dcb-input input { flex: 1; min-width: 0; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; padding: 7px 8px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-3); font: inherit; letter-spacing: 0; }\n.dcb-empty { padding: 12px 0; color: var(--dsw-alias-label-secondary); }\n@media (max-width: 600px) { .dcb-panel { max-height: 55vh; } .dcb-card-head { align-items: flex-start; flex-direction: column; } .dcb-card-actions { width: 100%; justify-content: flex-start; } .dcb-terminal { height: 180px; } }"; document.head.append(style);
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/index.js
var index_exports = {};
__export(index_exports, {
  CliBridgePanel: () => CliBridgePanel,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_xterm = require("@xterm/xterm");

// client/api.js
function origin(base = document.baseURI) {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
function endpoint(path, base = document.baseURI) {
  return new URL("dsh-cli-bridge/" + path.replace(/^\//, ""), origin(base));
}
async function json(response) {
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw Object.assign(new Error(data.error?.message ?? "CLI bridge request failed"), { code: data.error?.code });
  }
  return data.value;
}
async function listSessions(fetcher = fetch, base) {
  return json(await fetcher(endpoint("sessions", base), { headers: { accept: "application/json" } }));
}
async function command(path, payload = {}, fetcher = fetch, base) {
  return json(await fetcher(endpoint(path, base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }));
}
function eventSource(base = document.baseURI, factory = (url) => new EventSource(url)) {
  return factory(endpoint("events", base));
}

// client/index.js
var inject = ["slots"];
function safe(value) {
  return value == null ? "" : String(value);
}
function TerminalCard({ session, collapsed, onToggle, onClose, onInterrupt, onInput, onReady }) {
  const terminalNode = (0, import_react.useRef)(null);
  const [draft, setDraft] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => {
    if (!terminalNode.current) return void 0;
    const instance = new import_xterm.Terminal({
      convertEol: true,
      scrollback: 2500,
      cursorBlink: true,
      fontSize: 12,
      theme: { background: "#151719", foreground: "#e8eaed", cursor: "#78a9ff" }
    });
    instance.open(terminalNode.current);
    if (session.recentOutput) instance.write(session.recentOutput);
    onReady(session.terminalId, instance);
    return () => {
      onReady(session.terminalId, null);
      instance.dispose();
    };
  }, [session.terminalId]);
  async function submit(enter = false) {
    if (!draft && !enter) return;
    await onInput(session.terminalId, draft, enter);
    setDraft("");
  }
  return (0, import_react.createElement)(
    "section",
    { className: "dcb-card" },
    (0, import_react.createElement)(
      "header",
      { className: "dcb-card-head" },
      (0, import_react.createElement)(
        "div",
        { className: "dcb-card-title" },
        (0, import_react.createElement)("strong", null, safe(session.provider)),
        (0, import_react.createElement)("span", { className: "dcb-status" }, safe(session.status)),
        session.taskId && (0, import_react.createElement)("span", { className: "dcb-task" }, safe(session.taskId))
      ),
      (0, import_react.createElement)(
        "div",
        { className: "dcb-card-actions" },
        (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: onToggle, "aria-expanded": !collapsed }, collapsed ? "\u5C55\u5F00" : "\u6536\u8D77"),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: () => onInterrupt(session.terminalId), disabled: !["running", "waiting-input"].includes(session.status) }, "Ctrl+C"),
        (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: () => onClose(session.terminalId), disabled: ["exited", "failed"].includes(session.status) }, "\u5173\u95ED")
      )
    ),
    (0, import_react.createElement)("div", { className: "dcb-terminal-wrap", hidden: collapsed }, (0, import_react.createElement)("div", { className: "dcb-terminal", ref: terminalNode })),
    !collapsed && (0, import_react.createElement)(
      "form",
      { className: "dcb-input", onSubmit: (event) => {
        event.preventDefault();
        void submit(true);
      } },
      (0, import_react.createElement)("input", { value: draft, onChange: (event) => setDraft(event.target.value), placeholder: "\u8F93\u5165\u5230\u7EC8\u7AEF", "aria-label": "\u7EC8\u7AEF\u8F93\u5165" }),
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { type: "submit", variant: "primary" }, "\u53D1\u9001")
    )
  );
}
function CliBridgePanel() {
  const [sessions, setSessions] = (0, import_react.useState)([]);
  const [collapsed, setCollapsed] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const terminals = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const pending = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const mounted = (0, import_react.useRef)(true);
  function ready(id, instance) {
    if (instance) {
      terminals.current.set(id, instance);
      const queued = pending.current.get(id);
      if (queued) {
        instance.write(queued);
        pending.current.delete(id);
      }
    } else terminals.current.delete(id);
  }
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    let source;
    void listSessions().then((value) => {
      if (mounted.current) setSessions(value);
    }).catch(() => {
    });
    try {
      source = eventSource();
      source.addEventListener("snapshot", (event) => {
        const value = JSON.parse(event.data);
        if (mounted.current) setSessions(value);
      });
      source.addEventListener("output", (event) => {
        const value = JSON.parse(event.data);
        const text = safe(value.data);
        const card = terminals.current.get(value.terminalId);
        if (card) card.write(text);
        else pending.current.set(value.terminalId, (pending.current.get(value.terminalId) ?? "") + text);
        setSessions((current) => current.map((item) => item.terminalId === value.terminalId ? { ...item, recentOutput: (item.recentOutput ?? "").slice(-240) + text.slice(-240) } : item));
      });
      source.addEventListener("status", (event) => {
        const value = JSON.parse(event.data);
        setSessions((current) => current.map((item) => item.terminalId === value.terminalId ? { ...item, ...value } : item));
      });
    } catch {
    }
    return () => {
      mounted.current = false;
      source?.close();
      terminals.current.clear();
    };
  }, []);
  function toggle(id) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function input(id, data, enter) {
    await command("input", { terminalId: id, data, enter });
  }
  async function interrupt(id) {
    await command("interrupt", { terminalId: id });
  }
  async function close(id) {
    await command("close", { terminalId: id });
    setSessions((current) => current.map((item) => item.terminalId === id ? { ...item, status: "interrupted" } : item));
  }
  return (0, import_react.createElement)(
    "div",
    { className: "dcb-panel", "aria-label": "CLI \u7EC8\u7AEF" },
    (0, import_react.createElement)("header", { className: "dcb-panel-head" }, (0, import_react.createElement)("strong", null, "CLI \u7EC8\u7AEF"), (0, import_react.createElement)("span", null, String(sessions.length) + " \u4E2A\u4F1A\u8BDD")),
    sessions.length === 0 ? (0, import_react.createElement)("div", { className: "dcb-empty" }, "\u6682\u65E0\u8FD0\u884C\u4E2D\u7684 Claude \u6216 Codex \u4EFB\u52A1") : sessions.map((session) => (0, import_react.createElement)("div", { key: session.terminalId, "data-terminal-id": session.terminalId }, (0, import_react.createElement)(TerminalCard, {
      session,
      collapsed: collapsed.has(session.terminalId),
      onToggle: () => toggle(session.terminalId),
      onClose: close,
      onInterrupt: interrupt,
      onInput: input,
      onReady: ready
    })))
  );
}
function apply(ctx) {
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "dsh-cli-bridge",
    order: 40,
    label: () => "CLI \u7EC8\u7AEF",
    inject: () => ({})
  }, CliBridgePanel));
}

return module.exports;
} });

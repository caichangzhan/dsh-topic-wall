window.__ModuleLoader__.load({
  id: "dsh-topic-wall",
  factory(require) {
    const React = require("react");
    const h = React.createElement;
    const { useCallback, useState, useEffect, useMemo, useRef, useSyncExternalStore } = React;
    const NS = "topic-wall";
    const PIN_KEY = "dsh.topic-wall.pins.v2";
    const MAX_PINS = 3;
    const SETTINGS_KEY = "dsh.topic-wall.settings.v10";
    const DEFAULT_SETTINGS = Object.freeze({ columns: 3, font: 15, bubbleAlign: "split", cardHeight: 450, style: "ios", spaceRows: 2, motion: "on", tools: "folded", radius: "sharp" });
    const STYLES = Object.freeze([
      { id: "ios", labelKey: "styleIos", hintKey: "styleIosHint" },
      { id: "qzone", labelKey: "styleQzone", hintKey: "styleQzoneHint" },
      { id: "hacker", labelKey: "styleHacker", hintKey: "styleHackerHint" },
    ]);
    const EMPTY = Object.freeze([]);
    const EMPTY_STATUS = new Map();
    const EMPTY_MODEL_STATE = Object.freeze({ current: null, routable: null, groups: EMPTY, failures: EMPTY, status: "idle", pending: null, error: null });
    const EMPTY_WORKSPACE_STATE = Object.freeze({ items: EMPTY, archivedSessionIds: EMPTY, pinnedSessionIds: EMPTY, phase: "ready" });
    const RECENT_HISTORY_MS = 24 * 60 * 60 * 1000;
    const olderQueue = (() => {
      let active = 0;
      const queue = [];
      const pump = () => {
        while (active < 2 && queue.length > 0) {
          const job = queue.shift();
          active += 1;
          Promise.resolve().then(job).catch(() => {}).finally(() => {
            active -= 1;
            pump();
          });
        }
      };
      return { enqueue(job) { queue.push(job); pump(); } };
    })();
    const COLLAPSE_KEY = "dsh.topic-wall.collapsed-workspaces.v1";
    const draftCache = new Map();
    const DRAFT_KEY = "dsh.topic-wall.drafts.v1";
    function readDraftStore() {
      try {
        const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch { return {}; }
    }
    function readDraft(sessionId) {
      const store = readDraftStore();
      return typeof store[sessionId] === "string" ? store[sessionId] : "";
    }
    function saveDraft(sessionId, text) {
      try {
        const store = readDraftStore();
        if (text) store[sessionId] = text; else delete store[sessionId];
        const keys = Object.keys(store);
        while (keys.length > 80) delete store[keys.shift()];
        localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
      } catch {}
    }
    const LOG_KEY = "dsh.topic-wall.log.v2";
    const LOG_SEEN_KEY = "dsh.topic-wall.log-seen.v1";
    const MAX_LOGS = 200;
    const BOOT_KEY = "dsh.topic-wall.boot";
    const RUN_KEY = "dsh.topic-wall.run-state";
    const clip = (value, size) => String(value == null ? "" : value).slice(0, size);
    const redact = (value) => String(value == null ? "" : value)
      .replace(/(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|(?:(?:api|access|secret|refresh|auth|session)[_-]?token|password|passwd|secret)[=:]\s*[^\s,;]+)/gi, "[redacted]");
    function logTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value || "");
      return date.toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    function readLogs() {
      try {
        const parsed = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.slice(0, MAX_LOGS) : [];
      } catch { return []; }
    }
    function readLogSeen() {
      try {
        const raw = Number(localStorage.getItem(LOG_SEEN_KEY));
        if (Number.isFinite(raw) && raw > 0) return raw;
      } catch {}
      let latest = 0;
      for (const entry of readLogs()) {
        const time = Date.parse(entry.time);
        if (Number.isFinite(time) && time > latest) latest = time;
      }
      return latest || Date.now();
    }
    const logStore = (() => {
      let entries = readLogs();
      let seenAt = readLogSeen();
      const listeners = new Set();
      const notify = () => { for (const listener of listeners) { try { listener(); } catch {} } };
      const persist = () => { try { localStorage.setItem(LOG_KEY, JSON.stringify(entries)); } catch {} };
      const persistSeen = () => { try { localStorage.setItem(LOG_SEEN_KEY, String(seenAt)); } catch {} };
      return {
        getSnapshot: () => entries,
        getSeenAt: () => seenAt,
        markSeen() {
          const now = Date.now();
          if (now <= seenAt) return;
          seenAt = now;
          persistSeen();
          notify();
        },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        add(input) {
          const entry = {
            id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
            time: new Date().toISOString(),
            level: input.level || "error",
            source: input.source || "plugin",
            message: redact(clip(input.message, 1600)) || "(empty)",
            stack: redact(clip(input.stack, 6000)),
            context: redact(clip(input.context == null ? "" : (typeof input.context === "string" ? input.context : JSON.stringify(input.context)), 2000)),
          };
          entries = [entry, ...entries].slice(0, MAX_LOGS);
          persist(); notify();
          return entry;
        },
        clear() { entries = []; seenAt = Date.now(); persist(); persistSeen(); notify(); },
        export() {
          return entries.map((entry) => `[${entry.time}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.message}${entry.context ? `\n  context: ${entry.context}` : ""}${entry.stack ? `\n${entry.stack}` : ""}`).join("\n\n");
        },
      };
    })();
    function formatConsoleArg(value) {
      if (value instanceof Error) return redact(value.stack || value.message || String(value));
      if (typeof value === "string") return redact(value);
      try { return redact(JSON.stringify(value)); } catch { return redact(String(value)); }
    }
    function installLogCapture() {
      if (typeof window === "undefined" || window.__dshTopicWallLogging) return;
      window.__dshTopicWallLogging = true;
      // resource errors do not bubble; capture phase catches them
      window.addEventListener("error", (event) => {
        const target = event.target;
        const isResource = target && target !== window && target.tagName;
        logStore.add({
          level: "error", source: isResource ? "resource" : "window",
          message: event.message || (event.error && event.error.message) || (isResource ? `resource failed: ${target.tagName} ${target.src || target.href || ""}` : "window error"),
          stack: event.error && event.error.stack,
          context: { filename: event.filename, line: event.lineno, column: event.colno, tag: isResource ? target.tagName : undefined },
        });
      }, true);
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        logStore.add({
          level: "error", source: "promise",
          message: (reason && reason.message) || String(reason || "unhandled rejection"),
          stack: reason && reason.stack,
          context: { type: reason && reason.name },
        });
      });
      // console.error is often where libraries report handled failures; keep the original output.
      try {
        const originalError = console.error;
        let depth = 0;
        console.error = function (...args) {
          try {
            if (depth === 0) {
              depth = 1;
              const errorArg = args.find((item) => item instanceof Error);
              logStore.add({ level: "error", source: "console", message: args.map(formatConsoleArg).join(" "), stack: errorArg && errorArg.stack });
            }
          } catch {}
          finally { depth = 0; }
          return originalError.apply(console, args);
        };
      } catch {}
      // Detect a previous run that never closed cleanly (forced refresh / crash).
      let previousRun = null;
      try { previousRun = sessionStorage.getItem(RUN_KEY); } catch {}
      if (previousRun === "mounted" || previousRun === "booting") {
        logStore.add({
          level: "warn", source: "boot",
          message: "previous run ended without a clean pagehide (possible forced refresh or crash)",
          context: { previousRun },
        });
      }
      try { sessionStorage.setItem(RUN_KEY, "booting"); } catch {}
      window.addEventListener("pagehide", () => { try { sessionStorage.setItem(RUN_KEY, "closed"); } catch {} }, { once: true });
      setTimeout(() => { try { if (sessionStorage.getItem(RUN_KEY) === "booting") sessionStorage.setItem(RUN_KEY, "mounted"); } catch {} }, 800);
      let boot = 0;
      try {
        boot = Number(sessionStorage.getItem(BOOT_KEY) || 0) + 1;
        sessionStorage.setItem(BOOT_KEY, String(boot));
      } catch {}
      const nav = (() => { try { return performance.getEntriesByType("navigation")[0]?.type || "unknown"; } catch { return "unknown"; } })();
      logStore.add({
        level: "info", source: "boot",
        message: `plugin boot #${boot} (${nav})`,
        context: { navigationType: nav, href: location.href, visibility: document.visibilityState, previousRun },
      });
    }
    const clampInt = (value, min, max, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
    };
    function readSettings() {
      try {
        const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
        return {
          columns: clampInt(raw.columns, 2, 6, DEFAULT_SETTINGS.columns),
          font: clampInt(raw.font, 12, 20, DEFAULT_SETTINGS.font),
          bubbleAlign: raw.bubbleAlign === "left" ? "left" : "split",
          cardHeight: clampInt(raw.cardHeight, 280, 560, DEFAULT_SETTINGS.cardHeight),
          style: STYLES.some((style) => style.id === (raw.style === "bbs" ? "qzone" : raw.style)) ? (raw.style === "bbs" ? "qzone" : raw.style) : DEFAULT_SETTINGS.style,
          spaceRows: clampInt(raw.spaceRows, 1, 3, DEFAULT_SETTINGS.spaceRows),
          motion: raw.motion === "off" ? "off" : "on",
          tools: raw.tools === "hidden" ? "hidden" : "folded",
          radius: raw.radius === "soft" ? "soft" : "sharp",
        };
      } catch { return { ...DEFAULT_SETTINGS }; }
    }

    const zh = {
      panel: "对话墙", title: "对话墙", newChat: "新建聊天",
      model: "模型", modelLoading: "加载模型…", modelEmpty: "没有可用模型", modelSwitchFailed: "切换模型失败", modelAccount: "账号", modelSession: "最近会话",
      more: "更多操作", rename: "重命名", fork: "创建分支", archive: "归档会话", archiveConfirm: "归档这个会话？", stopAndArchiveConfirm: "这个会话仍在运行。停止当前工作并归档？", actionFailed: "操作失败", renameFailed: "重命名失败", forkFailed: "创建分支失败", archiveFailed: "归档失败",
      cardCrashed: "这张卡片渲染失败，墙体和其他卡片仍可用。", retry: "重试",
      intro: "置顶、进行中、聊天集合",
      hint: "卡内可直接回复 · 点标题旁 ↗ 打开原会话",
      pinned: "置顶", active: "进行中", collection: "聊天集合", archived: "归档", archivedHint: "已归档会话", emptyArchived: "没有已归档会话。", unarchive: "取消归档",
      pinnedHint: "固定最前", activeHint: "运行与等待优先", collectionHint: "其余会话",
      emptyPinned: "还没有置顶会话。", emptyActive: "当前没有进行中的会话。", emptyCollection: "还没有其他会话。",
      open: "打开原会话", pin: "置顶", unpin: "取消置顶", pinFull: "最多置顶 3 个",
      waiting: "待处理", running: "运行", idle: "空闲", done: "完成",
      unnamed: "未命名会话", workspace: "工作区", sessions: "会话",
      reply: "回复…", send: "发送", stop: "中断", loading: "正在读取会话…",
      queuePlaceholder: "排队回复…", queueCount: "{n} 条排队", queueExpand: "展开排队", queueCollapse: "收起排队", sending: "发送中", steer: "转向", remove: "移除", steerAll: "全部转向", queueEdit: "编辑", queueSave: "保存", queueCancel: "取消", queueEditOnlyText: "含附件的排队消息暂不支持编辑",
      loadOlder: "加载更早", loadingOlder: "加载中…", jumpLatest: "回到底部",
      loadingHistory: "正在读取历史…", noHistory: "还没有消息，发一句开始。",
      historyError: "历史读取失败，点 ↗ 打开原会话。", sendError: "发送失败",
      typing: "正在输入…", footer: "跑边框 = 待处理 · 数据来自当前 DSH host",
      justNow: "刚刚", minutesAgo: "{n} 分钟前", hoursAgo: "{n} 小时前", daysAgo: "{n} 天前",
      settings: "显示设置", columns: "每行卡片", columnsHint: "置顶、进行中、聊天集合每行显示的数量（卡片宽度）",
      typography: "文字", fontSize: "卡片字号", fontSizeHint: "默认 15px；影响标题与正文，不影响面包屑",
      messages: "卡内消息", messagesHint: "每张卡展示的最近消息条数",
      bubbleAlign: "气泡位置", bubbleSplit: "左右", bubbleLeft: "居左", bubbleHint: "左右：你靠右，agent 靠左；居左：全部靠左",
      cardHeight: "卡片高度", cardHeightHint: "置顶、进行中、聊天集合的卡片高度",
      collectionOnly: "材质作用于整面墙；字号影响全部卡片；列数 / 高度调整卡内网格；置顶位置固定",

      appearance: "外观", appearanceHint: "主题风格与边角",
      style: "主题风格", styleIos: "iOS", styleQzone: "QQ空间", styleHacker: "黑客代码",
      styleIosHint: "系统字体、白卡、气泡", styleQzoneHint: "蓝白、圆角、说说卡片", styleHackerHint: "终端、等宽、荧光绿",
      radius: "边角", radiusSharp: "直角", radiusSoft: "圆角",
      layout: "布局", layoutHint: "网格与空间",
      spaceRows: "空间行数", spaceRowsUnit: "行", spaceRowsHint: "每个空间默认显示几行卡片",
      behavior: "行为", behaviorHint: "动效与工具",
      motion: "状态动效", motionOn: "开启动效", motionOff: "关闭动效", motionHint: "关闭卡片、消息、面板和主题切换动效",
      tools: "工具行", toolsFolded: "折叠", toolsHidden: "隐藏", toolsHint: "隐藏后卡内不再显示工具摘要",
      settingsDesc: "实时生效，保存确认", toolGroup: "工具", artifact: "产物", artifactOpenError: "产物打开失败", expandText: "展开", collapseText: "收起", attachImage: "添加图片", removeImage: "移除图片", imageUnsupported: "只支持图片文件", imageTooLarge: "单张图片不能超过 10MB", imageLimit: "一次最多 6 张图片",
      spaces: "空间", workspaceUnknown: "未指定空间", collapseAll: "全部折叠", expandAll: "全部展开", groups: "{n} 个空间", showMore: "显示更多", showLess: "收起",
      reset: "恢复默认", refresh: "刷新", close: "关闭", save: "保存", saved: "已保存", saveFailed: "保存失败", columnsUnit: "列", messagesUnit: "条", localOnly: "仅本机保存",
      approvalWaiting: "等待审批", approvalTool: "工具 {name} 请求越权执行", approvalReason: "审批原因", allowOnce: "允许一次", reject: "拒绝", approvalOpen: "打开原会话", approvalAnswering: "提交中…", approvalFailed: "审批提交失败",
      pendingQuestion: "需要回答", pendingQuestionHint: "这个问题需要在原会话里回答。", answerQuestion: "选择回答", answerSubmitting: "提交中…", answerFailed: "提交失败", answerFallback: "复杂问题请在原会话回答。",
      log: "运行日志", logCount: "{n} 条", logCopy: "复制", logCopied: "已复制", logDownload: "下载", logClear: "清空", logEmpty: "还没有日志。", logLevel: "级别", logSource: "来源", logReload: "强制刷新", logRetry: "重试", logStack: "堆栈", logPersist: "刷新后保留", logCrashTitle: "对话墙渲染出错了", logCrashHint: "错误已写入运行日志，刷新后仍会保留。",
    };
    const en = {
      panel: "Topic Wall", title: "Topic Wall", newChat: "New chat",
      model: "Model", modelLoading: "Loading models…", modelEmpty: "No models available", modelSwitchFailed: "Failed to switch model", modelAccount: "Account", modelSession: "Recent session",
      more: "More actions", rename: "Rename", fork: "Fork session", archive: "Archive session", archiveConfirm: "Archive this session?", stopAndArchiveConfirm: "This session is still running. Stop its work and archive it?", actionFailed: "Action failed", renameFailed: "Rename failed", forkFailed: "Fork failed", archiveFailed: "Archive failed",
      cardCrashed: "This card failed to render; the wall and other cards are still usable.", retry: "Retry",
      intro: "Pinned, active, and collected sessions",
      hint: "Reply in a card · use ↗ to open the original conversation",
      pinned: "Pinned", active: "Active", collection: "Collection", archived: "Archived", archivedHint: "Archived sessions", emptyArchived: "No archived sessions.", unarchive: "Unarchive",
      pinnedHint: "Always first", activeHint: "Running and waiting first", collectionHint: "Everything else",
      emptyPinned: "No pinned sessions yet.", emptyActive: "No active sessions right now.", emptyCollection: "No other sessions yet.",
      open: "Open original conversation", pin: "Pin", unpin: "Unpin", pinFull: "Up to 3 pins",
      waiting: "Waiting", running: "Running", idle: "Idle", done: "Done",
      unnamed: "Untitled session", workspace: "Workspace", sessions: "sessions",
      reply: "Reply…", send: "Send", stop: "Stop", loading: "Loading sessions…",
      queuePlaceholder: "Queue a reply…", queueCount: "{n} queued", queueExpand: "Expand queue", queueCollapse: "Collapse queue", sending: "Sending", steer: "Steer", remove: "Remove", steerAll: "Steer all", queueEdit: "Edit", queueSave: "Save", queueCancel: "Cancel", queueEditOnlyText: "Queued messages with attachments cannot be edited",
      loadOlder: "Load earlier", loadingOlder: "Loading…", jumpLatest: "Back to bottom",
      loadingHistory: "Loading history…", noHistory: "No messages yet. Send one to start.",
      historyError: "History unavailable; use ↗ to open the conversation.", sendError: "Send failed",
      typing: "Typing…", footer: "Running border = needs action · data from this DSH host",
      justNow: "just now", minutesAgo: "{n}m ago", hoursAgo: "{n}h ago", daysAgo: "{n}d ago",
      settings: "Display settings", columns: "Cards per row", columnsHint: "Cards per row and width for pinned, active and collection",
      typography: "Text", fontSize: "Card text size", fontSizeHint: "Default 15px; titles and text only, breadcrumbs stay fixed",
      messages: "Messages per card", messagesHint: "Recent messages shown in each card",
      bubbleAlign: "Bubble alignment", bubbleSplit: "Split", bubbleLeft: "Left", bubbleHint: "Split: yours right, agent left. Left: everything left.",
      cardHeight: "Card height", cardHeightHint: "Height for pinned, active and collection cards",
      collectionOnly: "Material applies to the wall; text size applies everywhere; columns / height tune the grid; pinned position stays fixed",

      appearance: "Appearance", appearanceHint: "Theme style and corners",
      style: "Theme style", styleIos: "iOS", styleQzone: "Qzone", styleHacker: "Hacker",
      styleIosHint: "System type, white cards, bubbles", styleQzoneHint: "Blue-white, rounded, social cards", styleHackerHint: "Terminal, mono, green",
      radius: "Corners", radiusSharp: "Square", radiusSoft: "Round",
      layout: "Layout", layoutHint: "Grid and spaces",
      spaceRows: "Space rows", spaceRowsUnit: "rows", spaceRowsHint: "Default rows per workspace",
      behavior: "Behavior", behaviorHint: "Motion and tools",
      motion: "Status motion", motionOn: "Motion on", motionOff: "Motion off", motionHint: "Disables card, message, sheet and theme transitions",
      tools: "Tool rows", toolsFolded: "Folded", toolsHidden: "Hidden", toolsHint: "Hidden removes tool summaries from cards",
      settingsDesc: "Applied live; save to confirm", toolGroup: "Tools", artifact: "Artifacts", artifactOpenError: "Failed to open artifact", expandText: "Expand", collapseText: "Collapse", attachImage: "Add image", removeImage: "Remove image", imageUnsupported: "Images only", imageTooLarge: "Each image must be under 10MB", imageLimit: "Up to 6 images at once",
      spaces: "spaces", workspaceUnknown: "No workspace", collapseAll: "Collapse all", expandAll: "Expand all", groups: "{n} spaces", showMore: "Show more", showLess: "Show less",
      reset: "Reset", refresh: "Refresh", close: "Close", save: "Save", saved: "Saved", saveFailed: "Save failed", columnsUnit: "col", messagesUnit: "msg", localOnly: "Saved locally",
      approvalWaiting: "Waiting for approval", approvalTool: "Tool {name} requests privileged execution", approvalReason: "Reason", allowOnce: "Allow once", reject: "Reject", approvalOpen: "Open conversation", approvalAnswering: "Submitting…", approvalFailed: "Approval failed",
      pendingQuestion: "Waiting for an answer", pendingQuestionHint: "This question must be answered in the original conversation.", answerQuestion: "Choose an answer", answerSubmitting: "Submitting…", answerFailed: "Answer failed", answerFallback: "This question needs the original conversation.",
      log: "Runtime log", logCount: "{n} entries", logCopy: "Copy", logCopied: "Copied", logDownload: "Download", logClear: "Clear", logEmpty: "No logs yet.", logLevel: "Level", logSource: "Source", logReload: "Reload", logRetry: "Retry", logStack: "Stack", logPersist: "Persists across reloads", logCrashTitle: "Topic Wall failed to render", logCrashHint: "The error is saved in the runtime log and survives a reload.",
    };

    const CSS = `
@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,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) format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,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) format("woff2");font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,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) format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,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) format("woff2");font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:"IBM Plex Mono";src:url(data:font/woff2;base64,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) format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"IBM Plex Mono";src:url(data:font/woff2;base64,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) format("woff2");font-weight:500;font-style:normal;font-display:swap}
.tw-page{
  --tw-paper:#F4F4F1;--tw-pane:#FCFCFA;--tw-code:#F0F0EA;--tw-ink:#171813;--tw-ink2:#4D5048;
  --tw-muted:#61655C;--tw-line:#D8D8D1;--tw-line-soft:#E8E8E1;--tw-accent:#C2410C;
  --tw-green:#1F7A55;--tw-slate:#5B6B7A;
  --tw-font:14px;--tw-cols:5;--tw-card-h:360px;--tw-gap:12px;
  --tw-accent-soft:#E9ECFF;--tw-accent-line:#BFC8FF;--tw-user-bg:#2140FF;--tw-user-ink:#FFFFFF;--tw-agent-bg:#F0F0E9;
  --tw-rail-pin:#2140FF;--tw-rail-active:#FF5C1F;--tw-rail-collection:#1A1D24;
  --tw-top-bg:#11131A;--tw-top-ink:#F5F4EA;--tw-top-muted:#A8ACB4;
  box-sizing:border-box;height:100%;overflow:auto;background:var(--tw-paper);color:var(--tw-ink);
  font-family:"Archivo","PingFang SC","Hiragino Sans GB","Noto Sans SC",sans-serif;
  -webkit-font-smoothing:antialiased;
}
.tw-page[data-style="ios"]{
  --tw-paper:#F3F2ED;--tw-pane:#FBFAF6;--tw-code:#EFEDE6;--tw-ink:#171510;--tw-ink2:#4D4A42;
  --tw-muted:#6E6A60;--tw-line:#D8D3C7;--tw-line-soft:#E9E4D8;--tw-accent:#E24A1A;
  --tw-green:#1F7A55;--tw-slate:#686A63;--tw-accent-soft:#FDEDE6;--tw-accent-line:#F4C9B6;
  --tw-user-bg:#E24A1A;--tw-user-ink:#FFFFFF;--tw-agent-bg:#F1EFE9;
  --tw-rail-pin:#171510;--tw-rail-active:#E24A1A;--tw-rail-collection:#6B6A62;
}


/* Wall Standard v1: fixed structure, material only */
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-top{
  width:100%;max-width:none;box-sizing:border-box;
  min-height:48px;padding:10px 12px;background:var(--tw-pane);color:var(--tw-ink);border-bottom:1px solid var(--tw-line);
}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-mark i{background:var(--tw-ink)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-mark i:last-child{background:var(--tw-accent)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-title{color:var(--tw-ink);font-size:14px;font-weight:600}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-summary{color:var(--tw-muted)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-summary b{color:var(--tw-ink)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-summary .sep{color:var(--tw-line)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-hint{color:var(--tw-muted)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-settings-btn{border-color:var(--tw-line);color:var(--tw-ink);width:26px;height:26px}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-settings-btn:hover{background:var(--tw-code)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-shelf{border-radius:2px;border-color:var(--tw-line);background:var(--tw-pane)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-shelf-head{
  position:sticky;top:42px;background:var(--tw-pane);color:var(--tw-ink);
  border-bottom:2px solid var(--tw-rail,var(--tw-rail-collection));border-radius:0;min-height:30px;padding:4px 9px;
}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-shelf-head h2{color:var(--tw-ink);font-size:11px}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-shelf-head h2::before{background:var(--tw-rail,var(--tw-rail-collection))}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-shelf-hint{color:var(--tw-muted)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-shelf-count{color:var(--tw-ink);font-size:14px}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-card{border-radius:2px;box-shadow:none;background:var(--tw-pane)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-card.is-waiting{border-radius:8px}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-card-body{padding:0;gap:0}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-card-top{min-height:28px;padding:5px 9px;background:var(--tw-code);border-bottom:1px solid var(--tw-line-soft)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-card-title{font-size:calc(var(--tw-font) * .9);font-weight:600}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-meta{padding:4px 9px 0;font-size:10px}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-log{padding:5px 9px 6px;margin:0;gap:3px}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-msg{gap:1px}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-msg p{
  max-width:100%;padding:0;border:0;border-radius:0;background:transparent;
  color:var(--tw-ink);font-size:var(--tw-font);line-height:1.55;
}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-msg.user{align-items:flex-start}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-msg.user .role{align-self:flex-start;padding:0}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-msg .role{padding:0;color:var(--tw-muted);font-size:calc(var(--tw-font) * .55)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-msg.user .role{color:var(--tw-accent)}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-compose{border-top:1px solid var(--tw-line-soft);margin-top:0;padding:4px 8px;gap:2px}
.tw-page:is([data-theme="paper"],[data-theme="graphite"],[data-theme="blueprint"]) .tw-compose textarea{height:24px;font-size:calc(var(--tw-font) * .82)}
/* old experimental themes are not part of Wall Standard v1 */
.tw-page[data-theme="workbench"]{
  --tw-paper:#EEF0F2;--tw-pane:#FAFAFB;--tw-code:#EFF1F4;--tw-ink:#16181D;--tw-ink2:#4A4F57;
  --tw-muted:#6C727C;--tw-line:#D3D7DD;--tw-line-soft:#E4E7EB;--tw-accent:#2563EB;
  --tw-green:#0E7C5A;--tw-slate:#5E6875;--tw-accent-soft:#EAF0FF;--tw-accent-line:#BFD0FA;
  --tw-user-bg:#2563EB;--tw-user-ink:#FFFFFF;--tw-agent-bg:#F1F3F6;
  --tw-rail-pin:#2563EB;--tw-rail-active:#D97706;--tw-rail-collection:#333A45;
}
.tw-page[data-theme="columns"]{
  --tw-paper:#E7E9E4;--tw-pane:#F7F8F3;--tw-code:#EDEFE9;--tw-ink:#101613;--tw-ink2:#424B45;
  --tw-muted:#66706A;--tw-line:#C9CEC7;--tw-line-soft:#DFE3DD;--tw-accent:#0F766E;
  --tw-green:#0F766E;--tw-slate:#4F635B;--tw-accent-soft:#E4F2EF;--tw-accent-line:#B9DDD7;
  --tw-user-bg:#0F766E;--tw-user-ink:#FFFFFF;--tw-agent-bg:#EEF2EC;
  --tw-rail-pin:#0F766E;--tw-rail-active:#EA580C;--tw-rail-collection:#13221D;
}
.tw-page[data-theme="control"]{
  --tw-paper:#E8E9E3;--tw-pane:#F7F7F1;--tw-code:#ECECE5;--tw-ink:#11131A;--tw-ink2:#444A52;
  --tw-muted:#686D73;--tw-line:#C9CCC5;--tw-line-soft:#DDE0D9;--tw-accent:#2140FF;
  --tw-green:#0B7A53;--tw-slate:#5A6472;--tw-accent-soft:#E9ECFF;--tw-accent-line:#BFC8FF;
  --tw-user-bg:#2140FF;--tw-user-ink:#FFFFFF;--tw-agent-bg:#F0F0E9;
  --tw-rail-pin:#2140FF;--tw-rail-active:#FF5C1F;--tw-rail-collection:#1A1D24;
}
.tw-page[data-theme="signal"]{
  --tw-paper:#E8E5DF;--tw-pane:#FBF7F0;--tw-code:#EEE8DE;--tw-ink:#17110D;--tw-ink2:#4B4038;
  --tw-muted:#6B6057;--tw-line:#D2C7BC;--tw-line-soft:#E3D9CE;--tw-accent:#D7192D;
  --tw-green:#0E7A4B;--tw-slate:#665C55;--tw-accent-soft:#FDEBEC;--tw-accent-line:#F3BEC2;
  --tw-user-bg:#D7192D;--tw-user-ink:#FFFFFF;--tw-agent-bg:#F2ECE4;
  --tw-rail-pin:#D7192D;--tw-rail-active:#FF6A00;--tw-rail-collection:#1B1714;
}
.tw-page[data-theme="blueprint"]{
  --tw-paper:#E4EAF0;--tw-pane:#F6FAFD;--tw-code:#E8F0F5;--tw-ink:#0D1720;--tw-ink2:#40505F;
  --tw-muted:#61707C;--tw-line:#C3D0DA;--tw-line-soft:#D9E3EB;--tw-accent:#0B5FFF;
  --tw-green:#0F7A63;--tw-slate:#536A7B;--tw-accent-soft:#EAF1FF;--tw-accent-line:#C1D4FF;
  --tw-user-bg:#0B5FFF;--tw-user-ink:#FFFFFF;--tw-agent-bg:#EEF4F8;
  --tw-rail-pin:#0B5FFF;--tw-rail-active:#00A3A3;--tw-rail-collection:#15212E;
}
.tw-page[data-theme="verdant"]{
  --tw-paper:#E4EDE4;--tw-pane:#F5FAF4;--tw-code:#E7F0E6;--tw-ink:#101A13;--tw-ink2:#40503F;
  --tw-muted:#627064;--tw-line:#C3D2C3;--tw-line-soft:#D8E4D8;--tw-accent:#176B3A;
  --tw-green:#176B3A;--tw-slate:#56695A;--tw-accent-soft:#E8F4EA;--tw-accent-line:#BFDCC5;
  --tw-user-bg:#176B3A;--tw-user-ink:#FFFFFF;--tw-agent-bg:#EDF4EC;
  --tw-rail-pin:#176B3A;--tw-rail-active:#D97706;--tw-rail-collection:#18251C;
}
.tw-page[data-theme="columns"] .tw-top{background:var(--tw-pane);color:var(--tw-ink);border-bottom:1px solid var(--tw-line)}
.tw-page[data-theme="columns"] .tw-mark i{background:var(--tw-ink)}
.tw-page[data-theme="columns"] .tw-mark i:last-child{background:var(--tw-accent)}
.tw-page[data-theme="columns"] .tw-title{color:var(--tw-ink)}
.tw-page[data-theme="columns"] .tw-summary{color:var(--tw-muted)}
.tw-page[data-theme="columns"] .tw-summary b{color:var(--tw-ink)}
.tw-page[data-theme="columns"] .tw-summary .sep{color:var(--tw-line)}
.tw-page[data-theme="columns"] .tw-summary .wait{color:var(--tw-accent)}
.tw-page[data-theme="columns"] .tw-hint{color:var(--tw-muted)}
.tw-page[data-theme="columns"] .tw-settings-btn{border-color:var(--tw-line);color:var(--tw-ink)}
.tw-page[data-theme="columns"] .tw-settings-btn:hover{background:var(--tw-code);border-color:var(--tw-muted)}
.tw-page[data-theme="columns"] .tw-shelf-head{background:var(--tw-pane);color:var(--tw-ink);border-bottom:2px solid var(--tw-rail,var(--tw-rail-collection))}
.tw-page[data-theme="columns"] .tw-shelf-head h2{color:var(--tw-ink)}
.tw-page[data-theme="columns"] .tw-shelf-head h2::before{background:var(--tw-rail,var(--tw-rail-collection))}
.tw-page[data-theme="columns"] .tw-shelf-hint{color:var(--tw-muted)}
.tw-page[data-theme="columns"] .tw-shelf-count{color:var(--tw-ink)}
.tw-workspace{display:flex;flex-direction:column;gap:var(--tw-gap,12px)}
.tw-workspace-tools{display:flex;align-items:center;gap:10px;padding:0 1px 2px;color:var(--tw-muted);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9.5px}
.tw-workspace-tools button{margin-left:auto;border:1px solid var(--tw-line);border-radius:3px;background:transparent;color:var(--tw-ink2);font-size:10px;padding:2px 7px;cursor:pointer}
.tw-workspace-tools button:hover{background:var(--tw-code)}
.tw-wspace{border:1px solid var(--tw-line);border-radius:2px;background:var(--tw-pane);overflow:hidden}
.tw-wspace-head{display:flex;align-items:center;gap:7px;width:100%;min-height:28px;padding:4px 8px;border:0;border-bottom:1px solid var(--tw-line-soft);background:var(--tw-code);color:var(--tw-ink);cursor:pointer;text-align:left}
.tw-wspace[data-open="false"] .tw-wspace-head{border-bottom:0}
.tw-wspace-head:hover{background:color-mix(in srgb,var(--tw-code) 80%,var(--tw-ink) 4%)}
.tw-wspace-toggle{display:flex;align-items:center;gap:7px;flex:1;min-width:0;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.tw-wspace-new{width:24px;height:24px;flex:none;display:grid;place-items:center;border:1px solid var(--tw-line);border-radius:100px;background:var(--tw-pane);color:var(--tw-muted);cursor:pointer}
.tw-wspace-new:hover{background:var(--tw-code);color:var(--tw-ink);border-color:var(--tw-line)}
.tw-page.tw-ios .tw-wspace-new{width:26px;height:26px;border:0;background:var(--tw-paper);color:var(--tw-accent)}
.tw-page.tw-ios .tw-wspace-new:hover{background:#EAF2FF;color:var(--tw-accent)}
.tw-page[data-style="qzone"] .tw-wspace-new{border:1px solid #CBE4FA;background:#fff;color:#2F80ED}
.tw-page[data-style="qzone"] .tw-wspace-new:hover{background:#EAF4FF}
.tw-page[data-style="hacker"] .tw-wspace-new{border:1px solid var(--tw-line);border-radius:0;background:transparent;color:var(--tw-accent)}
.tw-page[data-style="hacker"] .tw-wspace-new:hover{background:#061006}
.tw-wspace-caret{width:10px;flex:none;color:var(--tw-muted);font-size:9px}
.tw-wspace-name{min-width:0;flex:1;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-wspace-count{flex:none;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;color:var(--tw-muted);padding:0 4px;border:1px solid var(--tw-line-soft);border-radius:2px}
.tw-wspace .tw-grid{padding:var(--tw-gap,12px);gap:var(--tw-gap,12px)}
.tw-wspace-more{display:flex;justify-content:center;padding:0 8px 8px}
.tw-wspace-more button{height:24px;padding:0 12px;border:1px solid var(--tw-line);border-radius:3px;background:var(--tw-pane);color:var(--tw-ink2);font-size:calc(var(--tw-font) * .7);cursor:pointer}
.tw-wspace-more button:hover{background:var(--tw-code);border-color:var(--tw-muted);color:var(--tw-ink)}
.tw-page[data-theme="workbench"] .tw-top,.tw-page[data-theme="columns"] .tw-top{
  min-height:40px;padding:8px 16px;background:var(--tw-pane);color:var(--tw-ink);border-bottom:1px solid var(--tw-line);
}
.tw-page[data-theme="workbench"] .tw-mark i,.tw-page[data-theme="columns"] .tw-mark i{background:var(--tw-ink)}
.tw-page[data-theme="workbench"] .tw-mark i:last-child,.tw-page[data-theme="columns"] .tw-mark i:last-child{background:var(--tw-accent)}
.tw-page[data-theme="workbench"] .tw-title,.tw-page[data-theme="columns"] .tw-title{color:var(--tw-ink);font-size:14px;font-weight:600}
.tw-page[data-theme="workbench"] .tw-summary,.tw-page[data-theme="columns"] .tw-summary{color:var(--tw-muted)}
.tw-page[data-theme="workbench"] .tw-summary b,.tw-page[data-theme="columns"] .tw-summary b{color:var(--tw-ink)}
.tw-page[data-theme="workbench"] .tw-summary .sep,.tw-page[data-theme="columns"] .tw-summary .sep{color:var(--tw-line)}
.tw-page[data-theme="workbench"] .tw-hint,.tw-page[data-theme="columns"] .tw-hint{color:var(--tw-muted)}
.tw-page[data-theme="workbench"] .tw-settings-btn,.tw-page[data-theme="columns"] .tw-settings-btn{border-color:var(--tw-line);color:var(--tw-ink);width:26px;height:26px}
.tw-page[data-theme="workbench"] .tw-settings-btn:hover,.tw-page[data-theme="columns"] .tw-settings-btn:hover{background:var(--tw-code)}
.tw-page[data-theme="workbench"] .tw-shelf{border-radius:2px}
.tw-page[data-theme="workbench"] .tw-shelf-head{background:var(--tw-code);color:var(--tw-ink);border-bottom:1px solid var(--tw-line);border-radius:0;min-height:30px;padding:4px 9px}
.tw-page[data-theme="workbench"] .tw-shelf-head h2{color:var(--tw-ink);font-size:11px}
.tw-page[data-theme="workbench"] .tw-shelf-head h2::before{background:var(--tw-rail,var(--tw-rail-collection))}
.tw-page[data-theme="workbench"] .tw-shelf-hint{color:var(--tw-muted)}
.tw-page[data-theme="workbench"] .tw-shelf-count{color:var(--tw-ink);font-size:14px}
.tw-page[data-theme="columns"] .tw-shelf{border-radius:2px}
/* desktop panes: flat transcript, tab header, no chat bubbles */
.tw-page[data-theme="workbench"] .tw-card,.tw-page[data-theme="columns"] .tw-card{
  border-radius:2px;box-shadow:none;background:var(--tw-pane);
}
.tw-page[data-theme="workbench"] .tw-card-body,.tw-page[data-theme="columns"] .tw-card-body{padding:0;gap:0}
.tw-page[data-theme="workbench"] .tw-card-top,.tw-page[data-theme="columns"] .tw-card-top{
  min-height:28px;padding:5px 9px;background:var(--tw-code);border-bottom:1px solid var(--tw-line-soft);
}
.tw-page[data-theme="workbench"] .tw-card-title,.tw-page[data-theme="columns"] .tw-card-title{font-size:calc(var(--tw-font) * .82)}
.tw-page[data-theme="workbench"] .tw-meta,.tw-page[data-theme="columns"] .tw-meta{padding:4px 9px 0;font-size:calc(var(--tw-font) * .64)}
.tw-page[data-theme="workbench"] .tw-log,.tw-page[data-theme="columns"] .tw-log{padding:5px 9px 6px;margin:0;gap:3px}
.tw-page[data-theme="workbench"] .tw-msg,.tw-page[data-theme="columns"] .tw-msg{gap:1px}
.tw-page[data-theme="workbench"] .tw-msg p,.tw-page[data-theme="columns"] .tw-msg p{
  max-width:100%;padding:0;border:0;border-radius:0;background:transparent;
  color:var(--tw-ink);font-size:calc(var(--tw-font) * .78);line-height:1.55;
}
.tw-page[data-theme="workbench"] .tw-msg.user,.tw-page[data-theme="columns"] .tw-msg.user{align-items:flex-start}
.tw-page[data-theme="workbench"] .tw-msg.user .role,.tw-page[data-theme="columns"] .tw-msg.user .role{align-self:flex-start;padding:0}
.tw-page[data-theme="workbench"] .tw-msg .role,.tw-page[data-theme="columns"] .tw-msg .role{padding:0;color:var(--tw-muted);font-size:calc(var(--tw-font) * .55)}
.tw-page[data-theme="workbench"] .tw-msg.user .role,.tw-page[data-theme="columns"] .tw-msg.user .role{color:var(--tw-accent)}
.tw-page[data-theme="workbench"] .tw-compose,.tw-page[data-theme="columns"] .tw-compose{border-top:1px solid var(--tw-line-soft);margin-top:0;padding:4px 8px;gap:2px}
.tw-page[data-theme="workbench"] .tw-compose textarea,.tw-page[data-theme="columns"] .tw-compose textarea{height:22px;font-size:calc(var(--tw-font) * .76)}
.tw-page[data-theme="workbench"] .tw-setting-bubbles,.tw-page[data-theme="columns"] .tw-setting-bubbles{display:none}
.tw-page[data-layout="columns"] .tw-card.collection .tw-card-body{padding:0}
.tw-page *{box-sizing:border-box}
.tw-page button{font:inherit;color:inherit}
.tw-page input{font:inherit}
.tw-page ::selection{background:#F3C9B2;color:var(--tw-ink)}
.tw-page *{scrollbar-width:thin;scrollbar-color:var(--tw-line) transparent}
.tw-page ::-webkit-scrollbar{width:7px;height:7px}
.tw-page ::-webkit-scrollbar-thumb{background:var(--tw-line);border-radius:4px}
.tw-page ::-webkit-scrollbar-track{background:transparent}
.tw-mono{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.tw-top{
  position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:16px;
  min-height:68px;padding:14px clamp(18px,3vw,40px);
  background:var(--tw-top-bg);color:var(--tw-top-ink);border-bottom:3px solid var(--tw-accent);
}
html[data-platform="darwin"] .tw-top{padding-top:calc(12px + var(--dsh-frame-top-clearance,0px))}
.tw-brand{display:flex;align-items:center;gap:10px;min-width:0}
.tw-mark{position:relative;width:15px;height:15px;flex:none}
.tw-mark i{position:absolute;left:0;top:0;width:4px;height:15px;background:var(--tw-top-ink);border-radius:1px}
.tw-mark i:last-child{left:9px;height:9px;background:#FF5C1F}
.tw-title{margin:0;font-size:18px;line-height:22px;font-weight:700;letter-spacing:-.02em;white-space:nowrap}
.tw-summary{display:flex;align-items:center;gap:5px;margin-left:6px;color:var(--tw-top-muted);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;white-space:nowrap;overflow:hidden}
.tw-summary .sep{color:rgba(255,255,255,.28)}
.tw-summary b{color:var(--tw-top-ink);font-weight:500}
.tw-summary-item{display:inline-flex;align-items:center;gap:3px;min-width:0}
.tw-summary-item svg{width:10px;height:10px;flex:none;opacity:.8}
.tw-summary .tw-summary-archived{border:0;background:transparent;color:inherit;font:inherit;padding:0;cursor:pointer;opacity:.8}
.tw-summary .tw-summary-archived:hover{color:var(--tw-top-ink);opacity:1}
.tw-summary .tw-summary-archived.is-active{color:var(--tw-top-ink);opacity:1;text-decoration:underline;text-underline-offset:2px}
.tw-summary .wait{color:#FF8A5C}
.tw-hint{color:var(--tw-top-muted);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-top-right{display:flex;align-items:center;gap:8px;min-width:0}
.tw-settings-btn{
  width:30px;height:30px;flex:none;border:1px solid rgba(255,255,255,.24);border-radius:6px;
  background:transparent;color:var(--tw-top-ink);display:grid;place-items:center;cursor:pointer;
  transition:background .14s,border-color .14s;
}
.tw-settings-btn:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.4)}
.tw-settings-btn{position:relative}
.tw-settings-alert{position:absolute;top:-3px;right:-3px;width:7px;height:7px;border-radius:50%;background:#D92D20;box-shadow:0 0 0 2px var(--tw-pane)}
.tw-board{padding:16px clamp(18px,3vw,40px) 48px}

.tw-shelf{
  max-width:1320px;margin:0 auto 18px;background:var(--tw-pane);
  border:1px solid var(--tw-line);border-radius:8px;overflow:visible;
}
.tw-shelf[data-shelf="pin"]{--tw-rail:var(--tw-rail-pin)}
.tw-shelf[data-shelf="active"]{--tw-rail:var(--tw-rail-active)}
.tw-shelf[data-shelf="collection"]{--tw-rail:var(--tw-rail-collection)}
.tw-shelf-head{position:sticky;top:65px;z-index:8;display:flex;align-items:center;gap:9px;margin:0;padding:7px 12px;min-height:38px;background:var(--tw-rail,var(--tw-rail-collection));color:#fff;border-radius:7px 7px 0 0}
.tw-shelf-head h2{margin:0;font-size:13px;line-height:18px;font-weight:600;letter-spacing:-.01em;color:#fff}
.tw-shelf-head h2::before{content:"";display:inline-block;width:3px;height:12px;margin-right:7px;border-radius:1px;background:rgba(255,255,255,.78);vertical-align:-1px}
.tw-shelf-hint{margin-left:2px;color:rgba(255,255,255,.7);font-size:10px}
.tw-shelf-count{margin-left:auto;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:19px;line-height:20px;font-weight:500;color:#fff;letter-spacing:-.04em}
.tw-shelf-body{padding:10px 12px 4px;border-radius:0 0 7px 7px}
.tw-shelf[data-shelf="pin"] .tw-shelf-body{background:color-mix(in srgb,var(--tw-rail-pin) 4%,var(--tw-pane))}
.tw-shelf[data-shelf="active"] .tw-shelf-body{background:color-mix(in srgb,var(--tw-rail-active) 4%,var(--tw-pane))}
.tw-row{display:flex;gap:var(--tw-gap,12px);overflow-x:auto;padding:0 0 8px}
.tw-grid{display:grid;grid-template-columns:repeat(var(--tw-cols,5),minmax(0,1fr));gap:var(--tw-gap,12px);padding:0 0 8px}
.tw-card{
  position:relative;display:flex;flex-direction:column;min-width:0;overflow:hidden;
  background:var(--tw-pane);border:1px solid var(--tw-line);border-radius:6px;
  transition:border-color .14s,background .14s;
}
.tw-card:hover{border-color:color-mix(in srgb,var(--tw-line) 50%,var(--tw-ink));background:color-mix(in srgb,var(--tw-pane) 94%,var(--tw-ink) 3%)}
.tw-card.is-archived{opacity:.78;border-top-color:var(--tw-line)!important}
.tw-card.is-archived:hover{opacity:1}

.tw-card.pin{flex:0 0 250px;height:390px;background:color-mix(in srgb,var(--tw-rail-pin) 4%,var(--tw-pane));border-top:2px solid var(--tw-rail-pin)}
.tw-card.active{flex:0 0 calc((100% - (var(--tw-cols,5) - 1) * var(--tw-gap,12px)) / var(--tw-cols,5));max-width:none;height:var(--tw-card-h,450px);background:color-mix(in srgb,var(--tw-rail-active) 4%,var(--tw-pane));border-top:2px solid var(--tw-rail-active)}
.tw-card.collection{height:var(--tw-card-h,360px);background:color-mix(in srgb,var(--tw-accent) 2%,var(--tw-pane));border-top:2px solid color-mix(in srgb,var(--tw-accent) 45%,var(--tw-line))}
.tw-card.collection.is-running{border-top-color:var(--tw-green)}
.tw-card.collection.is-waiting{border-top-color:var(--tw-accent)}
.tw-card-body{display:flex;flex-direction:column;min-height:0;padding:8px 10px 7px;gap:4px}
.tw-card.active .tw-card-body{padding:9px 11px 7px}
.tw-card-top{display:flex;align-items:center;gap:6px;min-width:0}
.tw-card-title{margin:0;font-size:calc(var(--tw-font) * .885);line-height:1.45;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-led{width:6px;height:6px;flex:none;border-radius:1px;background:var(--tw-muted);display:inline-block}
.tw-led.run{background:var(--tw-green);animation:tw-pulse 2.4s ease-in-out infinite}
.tw-led.wait{background:var(--tw-accent)}
}
@keyframes tw-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.tw-icon-btn{
  width:20px;height:20px;flex:none;border:0;border-radius:4px;background:transparent;color:var(--tw-muted);
  display:grid;place-items:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .12s,background .12s;
}
.tw-card:hover .tw-icon-btn,.tw-card:focus-within .tw-icon-btn{opacity:1;pointer-events:auto}
.tw-icon-btn:hover{background:var(--tw-code);color:var(--tw-ink)}
.tw-icon-btn:disabled{opacity:0;pointer-events:none}
.tw-handle{
  height:19px;padding:0 7px;flex:none;border:1px solid var(--tw-accent);border-radius:4px;
  background:var(--tw-accent);color:#fff;font-size:calc(var(--tw-font) * .69);cursor:pointer;white-space:nowrap;
}
.tw-handle:hover{background:color-mix(in srgb,var(--tw-accent) 78%,#000)}
.tw-handle-static{cursor:default;background:var(--tw-accent);color:#fff;border-color:var(--tw-accent)}
.tw-handle-static:hover{background:var(--tw-accent)}
.tw-meta{display:flex;align-items:center;gap:5px;min-width:0;color:var(--tw-muted);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;white-space:nowrap;overflow:hidden}
.tw-meta .sep{color:var(--tw-line)}
.tw-meta .run{color:var(--tw-green)}
.tw-meta .wait{color:var(--tw-accent)}
.tw-log-wrap{position:relative;display:flex;flex:1;min-height:0;width:100%}
.tw-log{
  flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  display:flex;flex-direction:column;gap:1px;margin:2px -2px 0;padding:0 2px;
}
.tw-log::-webkit-scrollbar{width:6px}
.tw-log::-webkit-scrollbar-thumb{background:var(--tw-line);border-radius:3px}
.tw-msg{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:1px 0;min-width:0;max-width:100%}
.tw-msg .role{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:calc(var(--tw-font) * .58);line-height:1.6;color:var(--tw-muted);white-space:nowrap;overflow:hidden;padding:0 4px}
.tw-msg.user{align-items:flex-end}
.tw-msg.user .role{color:var(--tw-accent);align-self:flex-end;padding-right:5px}
.tw-msg p{
  margin:0;max-width:92%;padding:5px 8px;border-radius:8px;
  background:var(--tw-code);border:1px solid var(--tw-line-soft);
  font-size:calc(var(--tw-font) * .81);line-height:1.5;color:var(--tw-ink2);
  word-break:break-word;white-space:pre-wrap;
}
.tw-msg.agent p{border-bottom-left-radius:2px;background:var(--tw-agent-bg)}
.tw-msg.user p{color:var(--tw-user-ink);background:var(--tw-user-bg);border-color:transparent;border-bottom-right-radius:3px}
.tw-card[data-bubbles="left"] .tw-msg.user{align-items:flex-start}
.tw-card[data-bubbles="left"] .tw-msg.user .role{align-self:flex-start;padding:0 4px}
.tw-card[data-bubbles="left"] .tw-msg.user p{border-bottom-left-radius:2px;border-bottom-right-radius:8px}
.tw-tool{width:100%;border:1px solid var(--tw-line-soft);border-radius:6px;background:var(--tw-code);overflow:hidden}
.tw-tool summary{display:flex;align-items:center;gap:6px;padding:4px 7px;color:var(--tw-muted);cursor:pointer;list-style:none;font-size:calc(var(--tw-font) * .69);line-height:1.45}
.tw-tool summary::-webkit-details-marker{display:none}
.tw-tool summary::before{content:"";width:5px;height:5px;flex:none;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .12s}
.tw-tool[open] summary::before{transform:rotate(45deg)}
.tw-tool-preview{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:"IBM Plex Mono",ui-monospace,monospace}
.tw-tool pre{margin:0;padding:6px 8px;border-top:1px solid var(--tw-line-soft);max-height:180px;overflow:auto;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:calc(var(--tw-font) * .66);line-height:1.5;color:var(--tw-ink2);white-space:pre-wrap;word-break:break-word}
.tw-tool-group{width:100%;border:1px solid var(--tw-line-soft);border-radius:6px;background:var(--tw-code);overflow:hidden}
.tw-tool-group summary{display:flex;align-items:center;gap:6px;padding:4px 7px;color:var(--tw-muted);cursor:pointer;list-style:none;font-size:calc(var(--tw-font) * .69);line-height:1.45}
.tw-tool-group summary::-webkit-details-marker{display:none}
.tw-tool-group summary::before{content:"";width:5px;height:5px;flex:none;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .12s}
.tw-tool-group[open] summary::before{transform:rotate(45deg)}
.tw-tool-group-count{flex:none;padding:0 4px;border-radius:3px;background:var(--tw-pane);color:var(--tw-ink2);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:calc(var(--tw-font) * .6)}
.tw-tool-group-body{padding:0 8px 4px}
.tw-tool-item{display:flex;align-items:flex-start;gap:6px;padding:5px 0;border-top:1px solid var(--tw-line-soft)}
.tw-tool-n{flex:none;padding-top:1px;color:var(--tw-muted);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:calc(var(--tw-font) * .58);line-height:1.6}
.tw-tool-item pre{flex:1;min-width:0;margin:0;max-height:160px;overflow:auto;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:calc(var(--tw-font) * .64);line-height:1.5;color:var(--tw-ink2);white-space:pre-wrap;word-break:break-word}
.tw-load-older{
  align-self:center;margin:2px auto 5px;padding:2px 8px;border:1px solid var(--tw-line);border-radius:4px;
  background:transparent;color:var(--tw-muted);font-size:calc(var(--tw-font) * .68);cursor:pointer;
}
.tw-load-older:hover{background:var(--tw-code);color:var(--tw-ink)}
.tw-load-older:disabled{opacity:.6;cursor:default}
.tw-jump-bottom{
  position:absolute;right:6px;bottom:6px;z-index:5;flex:none;width:34px;height:34px;margin:0;padding:0;
  border:1px solid var(--tw-line);border-radius:100px;background:var(--tw-pane);
  color:var(--tw-ink);cursor:pointer;display:grid;place-items:center;
  box-shadow:0 4px 14px rgba(0,0,0,.14);transition:background .12s,border-color .12s;
}
.tw-jump-bottom:hover{background:var(--tw-code);border-color:var(--tw-muted)}
.tw-jump-bottom:focus-visible{outline:2px solid var(--tw-accent);outline-offset:1px}
.tw-log-empty{margin:auto 0;padding:6px 2px;color:var(--tw-muted);font-size:calc(var(--tw-font) * .81);line-height:1.5}
.tw-typing{display:flex;align-items:center;gap:4px;padding:2px 4px;color:var(--tw-muted);font-size:calc(var(--tw-font) * .77)}
.tw-typing i{width:3px;height:3px;border-radius:50%;background:var(--tw-muted);display:inline-block;animation:tw-pulse 1.2s infinite}
.tw-typing i:nth-child(2){animation-delay:.15s}
.tw-typing i:nth-child(3){animation-delay:.3s}
.tw-approval{
  flex:none;margin-top:4px;padding:7px 8px;border:1px solid color-mix(in srgb,var(--tw-accent) 42%,var(--tw-line));
  border-top:2px solid var(--tw-accent);border-radius:3px;
  background:color-mix(in srgb,var(--tw-accent-soft) 78%,var(--tw-pane));
  display:flex;flex-direction:column;gap:5px;
}
.tw-approval[data-approval="question"]{border-top-color:var(--tw-green)}
.tw-approval-head{display:flex;align-items:center;gap:5px;color:var(--tw-accent);font-size:calc(var(--tw-font) * .7);font-weight:600}
.tw-approval-dot{width:6px;height:6px;flex:none;border-radius:50%;background:var(--tw-accent);animation:tw-breathe-dot 2.6s ease-in-out infinite}
@keyframes tw-breathe-dot{0%,100%{opacity:.45;box-shadow:0 0 0 0 transparent}50%{opacity:1;box-shadow:0 0 7px var(--tw-accent)}}
.tw-approval-tool{margin-left:auto;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:calc(var(--tw-font) * .62);color:var(--tw-muted);font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-approval-reason{color:var(--tw-ink2);font-size:calc(var(--tw-font) * .75);line-height:1.45;max-height:72px;overflow:auto;white-space:pre-wrap;word-break:break-word}
.tw-approval-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.tw-approval-actions.question{flex-direction:column;align-items:stretch}
.tw-approval-actions.question .tw-approval-action{width:100%;text-align:left;height:27px}
.tw-approval-actions.question .tw-approval-action.open{width:auto;align-self:flex-end;margin-left:0;text-align:right}
.tw-approval-action{height:24px;padding:0 8px;border:1px solid var(--tw-line);border-radius:3px;background:var(--tw-pane);color:var(--tw-ink);font-size:calc(var(--tw-font) * .69);cursor:pointer;white-space:nowrap}
.tw-approval-action:hover{background:var(--tw-code)}
.tw-approval-action:disabled{opacity:.55;cursor:default}
.tw-approval-action.allow{background:var(--tw-accent);border-color:var(--tw-accent);color:var(--tw-paper)}
.tw-approval-action.allow:hover{background:color-mix(in srgb,var(--tw-accent) 80%,#000)}
.tw-approval-action.reject{color:#B42318;border-color:color-mix(in srgb,#B42318 38%,var(--tw-line))}
.tw-approval-action.open{margin-left:auto;color:var(--tw-muted)}
.tw-approval-actions.question .tw-approval-action{white-space:normal;height:auto;min-height:27px;line-height:1.4;text-align:left;padding:5px 8px}
.tw-long{display:block;width:100%;height:auto;max-height:none;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-size:calc(var(--tw-font) * .75);line-height:1.45;text-align:left;cursor:pointer;overflow:hidden}
.tw-long .tw-long-scroll{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-long[data-expanded="true"]{cursor:pointer}
.tw-long[data-expanded="true"] .tw-long-scroll{white-space:pre-wrap;overflow:visible;text-overflow:clip}
.tw-approval-error{color:#B42318;font-size:calc(var(--tw-font) * .66)}
.tw-queue{
  flex:none;margin-top:4px;padding:5px 6px;border:1px solid var(--tw-accent-line);border-radius:6px;
  background:color-mix(in srgb,var(--tw-accent-soft) 76%,var(--tw-pane));display:flex;flex-direction:column;gap:3px;
}
.tw-queue-head{display:flex;align-items:center;justify-content:space-between;gap:6px;color:var(--tw-accent);font-size:calc(var(--tw-font) * .72);font-weight:500}
.tw-queue-head button{border:0;background:transparent;color:var(--tw-accent);font-size:calc(var(--tw-font) * .68);cursor:pointer;padding:0 2px}
.tw-queue-head button:hover{text-decoration:underline}
.tw-queue-toggle{display:flex;align-items:center;gap:4px;min-width:0;text-align:left}
.tw-queue-caret{width:8px;flex:none;font-size:8px;line-height:1;color:var(--tw-accent)}
.tw-queue-list{display:flex;flex-direction:column;gap:2px;max-height:62px;overflow-y:auto}
.tw-queue-item{display:flex;align-items:center;gap:3px;min-width:0;font-size:calc(var(--tw-font) * .73);line-height:1.35;color:var(--tw-ink2)}
.tw-queue-text{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-queue-item button{width:18px;height:18px;flex:none;border:0;border-radius:3px;background:transparent;color:var(--tw-muted);cursor:pointer;font-size:11px;line-height:1;display:grid;place-items:center}
.tw-queue-item button:hover{background:var(--tw-accent-line);color:var(--tw-ink)}
.tw-queue-edit{flex:1;min-width:0;height:19px;padding:0 4px;border:1px solid var(--tw-accent);border-radius:4px;background:var(--tw-pane);color:var(--tw-ink);font:inherit;font-size:calc(var(--tw-font) * .73);outline:none}
.tw-queue-noedit{flex:none;color:var(--tw-muted);font-size:10px;opacity:.65}
.tw-queue-item.is-editing{gap:2px}
.tw-queue-sending{color:var(--tw-muted);font-size:calc(var(--tw-font) * .66);flex:none}
.tw-compose{display:flex;align-items:flex-end;gap:3px;margin-top:auto;padding-top:5px}
.tw-compose-field{position:relative;flex:1;min-width:0;display:flex;align-items:flex-end}
.tw-compose-field > textarea{flex:1;width:100%;padding-right:30px}
.tw-compose-field .tw-send{position:absolute;right:3px;bottom:3px;z-index:1;width:22px;height:22px;border-radius:50%}
.tw-compose-field .tw-attach{position:absolute;left:3px;bottom:3px;z-index:1;width:22px;height:22px;flex:none;border:0;border-radius:50%;background:transparent;color:var(--tw-muted);display:grid;place-items:center;cursor:pointer}
.tw-compose-field .tw-attach:hover{background:var(--tw-code);color:var(--tw-ink)}
.tw-page.tw-ios .tw-compose-field .tw-attach{width:28px;height:28px;left:3px;bottom:3px;background:transparent;color:var(--tw-muted)}
.tw-page.tw-ios .tw-compose-field .tw-attach:hover{background:#E9E9EB;color:var(--tw-ink)}
.tw-page[data-style="qzone"] .tw-compose-field .tw-attach{width:28px;height:28px;left:3px;bottom:3px;background:#EAF4FF;color:#2F80ED}
.tw-page[data-style="hacker"] .tw-compose-field .tw-attach{width:26px;height:26px;left:2px;bottom:2px;border-radius:0;background:var(--tw-code);color:var(--tw-ink)}
.tw-compose textarea{
  flex:1;min-width:0;min-height:25px;max-height:96px;border:0;border-bottom:1px solid var(--tw-line);border-radius:0;
  background:transparent;color:var(--tw-ink);font-size:calc(var(--tw-font) * .81);line-height:1.4;padding:3px 30px 3px 30px;outline:none;resize:none;box-sizing:border-box;
  transition:background .14s,border-color .14s,padding .14s;
}
.tw-compose textarea::placeholder{color:var(--tw-muted)}
.tw-compose textarea:focus{background:var(--tw-code);border:1px solid var(--tw-ink);border-radius:4px;padding:3px 30px}
.tw-compose textarea:disabled{opacity:.7}
.tw-compose textarea::-webkit-scrollbar{width:4px}
.tw-compose textarea::-webkit-scrollbar-thumb{background:var(--tw-line);border-radius:2px}
.tw-send{
  width:24px;height:24px;flex:none;border:0;border-radius:4px;background:transparent;color:var(--tw-ink2);
  display:grid;place-items:center;cursor:pointer;
}
.tw-send:hover{background:var(--tw-ink);color:var(--tw-paper)}
.tw-send:disabled{opacity:.3;cursor:default}
.tw-send svg{stroke:currentColor}
.tw-error{padding:2px 0;color:#B42318;font-size:calc(var(--tw-font) * .77)}
.tw-card.is-waiting{
  border-color:color-mix(in srgb,var(--tw-accent) 48%,var(--tw-line));
  border-radius:8px;
  animation:tw-breathe 2.6s ease-in-out infinite;
}
.tw-card.is-running{border-radius:8px;border-color:color-mix(in srgb,var(--tw-accent) 42%,var(--tw-line))}
@keyframes tw-breathe{
  0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--tw-accent) 0%,transparent)}
  50%{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--tw-accent) 52%,transparent),0 0 22px color-mix(in srgb,var(--tw-accent) 28%,transparent)}
}
.tw-ants{position:absolute;inset:0;pointer-events:none;z-index:4;border-radius:inherit;overflow:hidden}
.tw-ants svg{display:block;width:100%;height:100%}
.tw-ants rect{x:1.5px;y:1.5px;width:calc(100% - 3px);height:calc(100% - 3px);fill:none;stroke:var(--tw-accent);stroke-width:2;stroke-linecap:round;stroke-dasharray:9 6;animation:tw-ants .8s linear infinite}
.tw-ants.run rect{stroke:var(--tw-accent)}
@keyframes tw-ants{to{stroke-dashoffset:-15}}
.tw-empty{margin:0;padding:14px 16px;border:1px solid var(--tw-line-soft);border-radius:8px;color:var(--tw-muted);font-size:11px;background:rgba(252,252,250,.6)}
.tw-foot{max-width:1320px;margin:6px auto 0;display:flex;align-items:center;gap:8px;color:var(--tw-muted);font-size:10px}
.tw-foot i{display:inline-block;width:16px;height:9px;border:1.5px dashed var(--tw-accent);border-radius:3px}
.tw-settings-backdrop{position:fixed;inset:0;z-index:60;background:rgba(23,24,19,.14)}
.tw-settings{
  position:fixed;top:calc(68px + var(--dsh-frame-top-clearance,0px));right:16px;z-index:61;
  width:min(320px,calc(100vw - 32px));max-height:calc(100vh - 96px);overflow-y:auto;
  background:var(--tw-pane);color:var(--tw-ink);
  border:1px solid var(--tw-line);border-top:3px solid var(--tw-accent);border-radius:10px;box-shadow:0 18px 44px rgba(23,24,19,.18);
  padding:12px 14px 14px;
}
.tw-settings-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
.tw-settings-scope{color:var(--tw-muted);font-size:10px;line-height:1.5;margin:0 0 6px}
.tw-settings-head h2{margin:0;font-size:13px;line-height:20px;font-weight:600}
.tw-settings-close{width:24px;height:24px;border:0;border-radius:5px;background:transparent;color:var(--tw-muted);display:grid;place-items:center;cursor:pointer}
.tw-settings-close:hover{background:var(--tw-code);color:var(--tw-ink)}
.tw-setting{display:flex;flex-direction:column;gap:5px;padding:9px 0;border-top:1px solid var(--tw-line-soft)}
.tw-setting:first-of-type{border-top:0;padding-top:2px}
.tw-setting-line{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:11.5px}
.tw-setting-line label{font-weight:500}
.tw-setting-line span{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;color:var(--tw-muted)}
.tw-setting input[type=range]{width:100%;accent-color:var(--tw-accent);height:18px;margin:0}
.tw-segment{display:flex;border:1px solid var(--tw-line);border-radius:6px;overflow:hidden}
.tw-segment button{flex:1;height:28px;border:0;background:transparent;color:var(--tw-muted);font-size:10.5px;cursor:pointer}
.tw-segment button + button{border-left:1px solid var(--tw-line)}
.tw-segment button[data-active="true"]{background:var(--tw-ink);color:var(--tw-paper)}
.tw-setting-hint{font-size:10px;line-height:1.5;color:var(--tw-muted)}
.tw-theme-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.tw-theme{border:1px solid var(--tw-line);border-radius:6px;background:var(--tw-pane);padding:5px 6px;display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--tw-ink2);font-size:10.5px;text-align:left}
.tw-theme:hover{background:var(--tw-code)}
.tw-theme[data-active="true"]{border-color:var(--tw-ink);box-shadow:inset 0 0 0 1px var(--tw-ink)}
.tw-theme-swatch{width:18px;height:18px;border-radius:4px;flex:none;position:relative;overflow:hidden;border:1px solid var(--tw-line)}
.tw-theme-swatch b{position:absolute;left:3px;right:3px;bottom:3px;height:5px;border-radius:1px}
.tw-settings{top:calc(50% + 32px);right:18px;transform:translateY(-50%);width:min(396px,calc(100vw - 32px));height:min(760px,calc(100vh - 104px));max-height:calc(100vh - 104px);padding:0;display:flex;flex-direction:column;overflow:hidden}
.tw-settings-head{padding:13px 16px 11px;margin:0;border-bottom:1px solid var(--tw-line);background:var(--tw-pane);flex:none}
.tw-settings-head > div:first-child{min-width:0}
.tw-settings-head h2{margin:0;font-size:14px;line-height:20px;font-weight:600}
.tw-settings-head p{margin:2px 0 0;color:var(--tw-muted);font-size:10px;line-height:15px}
.tw-settings-body{padding:0 16px 8px;overflow-y:auto;min-height:0;flex:1}
.tw-config-section{padding:12px 0;border-bottom:1px solid var(--tw-line-soft)}
.tw-config-section:last-of-type{border-bottom:0}
.tw-config-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}
.tw-config-title h3{margin:0;font-size:11.5px;line-height:16px;font-weight:600;color:var(--tw-ink)}
.tw-config-title p{margin:0;color:var(--tw-muted);font-size:9.5px;line-height:14px;text-align:right;white-space:normal;max-width:68%}
.tw-material-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.tw-material{display:flex;flex-direction:column;gap:4px;padding:4px;border:1px solid var(--tw-line);border-radius:5px;background:var(--tw-pane);color:var(--tw-ink2);cursor:pointer;font-size:10.5px;text-align:left}
.tw-material:hover{background:var(--tw-code)}
.tw-material[data-active="true"]{border-color:var(--tw-ink);box-shadow:inset 0 0 0 1px var(--tw-ink)}
.tw-material-swatch{position:relative;display:block;height:28px;border-radius:3px;border:1px solid var(--tw-line-soft);overflow:hidden}
.tw-material-swatch b{position:absolute;left:4px;right:4px;bottom:4px;height:9px;border-radius:2px}
.tw-material-swatch i{position:absolute;right:4px;top:4px;width:6px;height:6px;border-radius:50%}
.tw-material-name{padding:0 1px 1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-config-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px}
.tw-config-row:first-of-type{margin-top:0}
.tw-config-label{font-size:11px;color:var(--tw-ink2);white-space:nowrap}
.tw-config-row .tw-segment{flex:0 0 auto;min-width:120px}
.tw-config-row .tw-segment button{height:25px;padding:0 8px;font-size:10px}
.tw-config-slider{margin-top:10px}
.tw-config-slider:first-of-type{margin-top:0}
.tw-config-line{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:3px;font-size:11px;color:var(--tw-ink2)}
.tw-config-line output{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;color:var(--tw-muted)}
.tw-config-slider input[type=range]{width:100%;height:18px;margin:0;accent-color:var(--tw-accent)}
.tw-config-hint{margin:5px 0 0;color:var(--tw-muted);font-size:9.5px;line-height:14px}
.tw-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;border:0;background:transparent;color:var(--tw-ink);padding:4px 0;cursor:pointer;text-align:left;gap:12px}
.tw-toggle-copy{display:flex;flex-direction:column;gap:1px;min-width:0}
.tw-toggle-copy b{font-size:11px;font-weight:500}
.tw-toggle-copy small{font-size:9.5px;color:var(--tw-muted)}
.tw-switch{position:relative;width:30px;height:17px;flex:none;border-radius:100px;background:var(--tw-line);transition:background .15s}
.tw-switch i{position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:var(--tw-pane);transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.18)}
.tw-switch[data-on="true"]{background:var(--tw-accent)}
.tw-switch[data-on="true"] i{transform:translateX(13px)}
.tw-settings .tw-settings-scope{margin:8px 0 0;padding:0 0 4px;font-size:9.5px;line-height:14px}
.tw-settings-foot{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:9px 16px 12px;border-top:1px solid var(--tw-line);background:var(--tw-pane)}
.tw-settings-foot .tw-log-open{margin-left:auto;height:25px;padding:0 8px;font-size:10px}
.tw-settings-foot .tw-reset{height:25px;font-size:10px}
.tw-settings-foot .tw-save{width:100%;height:29px;margin-top:1px;font-size:11px}
.tw-page[data-motion="off"] *, .tw-page[data-motion="off"] *::before, .tw-page[data-motion="off"] *::after{animation:none!important;transition:none!important}
.tw-page[data-paused="true"] *, .tw-page[data-paused="true"] *::before, .tw-page[data-paused="true"] *::after{animation-play-state:paused!important}
.tw-card.is-offscreen .tw-ants{display:none}
.tw-card.is-offscreen .tw-card-body{content-visibility:auto;contain-intrinsic-size:auto 320px}
.tw-page[data-radius="soft"] .tw-card{border-radius:8px}
.tw-page[data-radius="soft"] .tw-shelf{border-radius:8px}
.tw-page[data-radius="soft"] .tw-wspace{border-radius:8px}
.tw-settings-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding-top:10px;border-top:1px solid var(--tw-line-soft)}
.tw-log-open{margin-left:auto;border:1px solid var(--tw-line);background:transparent;border-radius:5px;height:26px;padding:0 8px;font-size:10.5px;color:var(--tw-ink2);cursor:pointer}
.tw-log-open:hover{background:var(--tw-code)}
.tw-log-backdrop{position:fixed;inset:0;z-index:80;background:rgba(11,13,12,.38);display:grid;place-items:center;padding:18px}
.tw-log-panel{width:min(720px,calc(100vw - 36px));max-height:calc(100vh - 36px);display:flex;flex-direction:column;background:var(--tw-pane);color:var(--tw-ink);border:1px solid var(--tw-line);border-top:3px solid var(--tw-accent);border-radius:8px;box-shadow:0 24px 70px rgba(0,0,0,.28);overflow:hidden}
.tw-log-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--tw-line)}
.tw-log-head h2{margin:0;font-size:14px;font-weight:600}
.tw-log-head .tw-log-count{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;color:var(--tw-muted)}
.tw-log-head .tw-log-x{margin-left:auto;width:26px;height:26px;border:0;border-radius:4px;background:transparent;color:var(--tw-muted);cursor:pointer;font-size:16px}
.tw-log-head .tw-log-x:hover{background:var(--tw-code);color:var(--tw-ink)}
.tw-log-actions{display:flex;gap:6px;padding:8px 14px;border-bottom:1px solid var(--tw-line-soft);flex-wrap:wrap}
.tw-log-actions button{height:26px;padding:0 9px;border:1px solid var(--tw-line);border-radius:4px;background:var(--tw-pane);color:var(--tw-ink2);font-size:10.5px;cursor:pointer}
.tw-log-actions button:hover{background:var(--tw-code)}
.tw-log-actions .tw-log-status{margin-left:auto;align-self:center;font-size:10px;color:var(--tw-accent)}
.tw-log-list{overflow-y:auto;padding:6px 14px 14px;min-height:120px}
.tw-log-entry{padding:8px 0;border-bottom:1px solid var(--tw-line-soft)}
.tw-log-entry:last-child{border-bottom:0}
.tw-log-meta{display:flex;align-items:center;gap:7px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9.5px;color:var(--tw-muted);white-space:nowrap;overflow:hidden}
.tw-log-meta time{flex:none}
.tw-log-level{flex:none;padding:1px 4px;border-radius:2px;background:var(--tw-code);color:var(--tw-ink2)}
.tw-log-entry[data-level="error"] .tw-log-level{background:#FDE8E6;color:#B42318}
.tw-log-entry[data-level="warn"] .tw-log-level{background:#FEF0D5;color:#9A5B00}
.tw-log-entry p{margin:4px 0 0;font-size:11px;line-height:1.5;color:var(--tw-ink);word-break:break-word;white-space:pre-wrap}
.tw-log-entry .tw-log-context,.tw-log-entry details pre{margin:5px 0 0;padding:5px 7px;background:var(--tw-code);border-radius:3px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9.5px;line-height:1.45;color:var(--tw-muted);white-space:pre-wrap;word-break:break-word;max-height:160px;overflow:auto}
.tw-log-entry details{margin-top:4px}
.tw-log-entry summary{font-size:10px;color:var(--tw-muted);cursor:pointer}
.tw-log-empty{padding:24px 0;color:var(--tw-muted);font-size:11px;text-align:center}
.tw-log-foot{display:flex;gap:6px;padding:8px 14px;border-top:1px solid var(--tw-line);font-size:9.5px;color:var(--tw-muted)}
.tw-crash{height:100%;min-height:320px;display:grid;place-items:center;padding:24px;background:var(--tw-paper);color:var(--tw-ink)}
.tw-crash-card{max-width:620px;border:1px solid var(--tw-line);border-top:3px solid #B42318;background:var(--tw-pane);border-radius:8px;padding:18px}
.tw-crash-card h1{margin:0 0 8px;font-size:18px}
.tw-crash-card p{margin:0;color:var(--tw-muted);font-size:12px;line-height:1.6}
.tw-crash-card pre{margin:12px 0 0;padding:8px 10px;background:var(--tw-code);border-radius:4px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;line-height:1.5;max-height:180px;overflow:auto;white-space:pre-wrap;word-break:break-word}
.tw-crash-actions{display:flex;gap:6px;margin-top:12px}
.tw-crash-actions button{height:28px;padding:0 10px;border:1px solid var(--tw-line);border-radius:4px;background:var(--tw-pane);color:var(--tw-ink);font-size:11px;cursor:pointer}
.tw-crash-actions button:hover{background:var(--tw-code)}
.tw-crash-actions button:first-child{background:var(--tw-ink);color:var(--tw-paper);border-color:var(--tw-ink)}
.tw-reset{border:1px solid var(--tw-line);background:transparent;border-radius:5px;height:26px;padding:0 9px;font-size:10.5px;color:var(--tw-ink2);cursor:pointer}
.tw-reset:hover{background:var(--tw-code)}
.tw-save{width:100%;height:30px;order:10;margin-top:2px;padding:0 11px;border:1px solid var(--tw-accent);border-radius:5px;background:var(--tw-accent);color:#fff;font-size:11px;font-weight:600;cursor:pointer}
.tw-save:hover{background:color-mix(in srgb,var(--tw-accent) 82%,#000)}
.tw-save:active{transform:translateY(1px)}
@media (max-width:760px){
  .tw-top{align-items:flex-start;flex-direction:column;gap:5px}
  .tw-summary{font-size:9.5px;flex-wrap:wrap}
  .tw-hint{white-space:normal}
  .tw-card.pin,.tw-card.active{width:100%;flex:1 1 auto}
  .tw-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .tw-top-right{width:100%;justify-content:space-between}
  .tw-hint{white-space:normal}
}
@media (max-width:1000px){
  .tw-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (prefers-reduced-motion:reduce){
  .tw-led.run,.tw-typing i{animation:none}
  .tw-ants rect{animation:none;stroke-dasharray:9 6}
  .tw-card.is-waiting{animation:none;box-shadow:0 0 0 1px color-mix(in srgb,var(--tw-accent) 42%,transparent)}

}

/* iOS light redesign */
.tw-page[data-style="ios"]{
  --tw-paper:#F2F2F7;--tw-pane:#FFFFFF;--tw-code:#F2F2F7;--tw-ink:#1C1C1E;--tw-ink2:#3A3A3C;
  --tw-muted:#6C6C70;--tw-line:rgba(60,60,67,.18);--tw-line-soft:rgba(60,60,67,.10);
  --tw-accent:#007AFF;--tw-accent-soft:#E9F2FF;--tw-accent-line:#BFDBFF;
  --tw-user-bg:#007AFF;--tw-user-ink:#FFFFFF;--tw-agent-bg:#E9E9EB;
  --tw-green:#34C759;--tw-slate:#8E8E93;--tw-rail-pin:#1C1C1E;--tw-rail-active:#007AFF;--tw-rail-collection:#8E8E93;
  --tw-top-bg:rgba(255,255,255,.86);--tw-top-ink:#1C1C1E;--tw-top-muted:#8E8E93;
}


.tw-page.tw-ios{
  background:var(--tw-paper);color:var(--tw-ink);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","PingFang SC","Hiragino Sans GB",sans-serif;
  letter-spacing:-.01em;
}
.tw-page.tw-ios .tw-top{
  width:100%;max-width:none;min-height:64px;padding:12px 20px;box-sizing:border-box;
  background:var(--tw-top-bg);color:var(--tw-top-ink);
  border-bottom:.5px solid rgba(60,60,67,.16);
  -webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);
}
.tw-page.tw-ios .tw-title{font-size:20px;line-height:26px;font-weight:700;letter-spacing:-.03em;color:var(--tw-ink)}
.tw-page.tw-ios .tw-mark i{background:var(--tw-ink);border-radius:2px}
.tw-page.tw-ios .tw-mark i:last-child{background:var(--tw-accent)}
.tw-page.tw-ios .tw-summary{
  margin-left:10px;padding:4px 10px;gap:7px;border-radius:100px;background:var(--tw-paper);
  color:var(--tw-muted);font-family:inherit;font-size:11px;line-height:16px;letter-spacing:0;
}
.tw-page.tw-ios .tw-summary b{color:var(--tw-ink);font-weight:600}
.tw-page.tw-ios .tw-summary .sep{color:var(--tw-line)}
.tw-page.tw-ios .tw-hint{color:var(--tw-muted);font-size:12px;letter-spacing:0}
.tw-page.tw-ios .tw-settings-btn{
  width:32px;height:32px;border:.5px solid rgba(60,60,67,.16);border-radius:50%;
  background:rgba(255,255,255,.7);color:var(--tw-ink);box-shadow:0 1px 2px rgba(0,0,0,.04);
}
.tw-page.tw-ios .tw-settings-btn:hover{background:#fff}
.tw-page.tw-ios .tw-board{padding:20px 20px 56px;background:var(--tw-paper)}
.tw-page.tw-ios .tw-shelf{
  max-width:1360px;margin:0 auto 22px;background:transparent;border:0;border-radius:0;overflow:visible;
}
.tw-page.tw-ios .tw-shelf-head{
  top:64px;min-height:40px;padding:8px 6px;background:rgba(242,242,247,.9);
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
  border-bottom:.5px solid rgba(60,60,67,.14);border-radius:0;color:var(--tw-muted);
}
.tw-page.tw-ios .tw-shelf-head h2{color:var(--tw-ink);font-size:14px;font-weight:600;letter-spacing:-.01em}
.tw-page.tw-ios .tw-shelf-head h2::before{display:none}
.tw-page.tw-ios .tw-shelf-hint{margin-left:4px;color:var(--tw-muted);font-size:11px}
.tw-page.tw-ios .tw-shelf-count{color:var(--tw-muted);font-family:inherit;font-size:13px;font-weight:500;letter-spacing:0}
.tw-page.tw-ios .tw-workspace{display:flex;flex-direction:column;gap:4px}
.tw-page.tw-ios .tw-workspace-tools{display:flex;align-items:center;gap:10px;padding:0 4px 2px;color:var(--tw-muted);font-family:inherit;font-size:11px}
.tw-page.tw-ios .tw-workspace-tools button{margin-left:auto;border:0;border-radius:100px;background:rgba(118,118,128,.12);color:var(--tw-ink2);font-size:11px;padding:5px 11px;cursor:pointer}
.tw-page.tw-ios .tw-workspace-tools button:hover{background:rgba(118,118,128,.18)}
.tw-page.tw-ios .tw-wspace{border:0;border-radius:0;background:transparent;overflow:visible}
.tw-page.tw-ios .tw-wspace-head{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:7px 4px;border:0;border-bottom:.5px solid rgba(60,60,67,.12);background:transparent;color:var(--tw-ink);cursor:pointer;text-align:left}
.tw-page.tw-ios .tw-wspace-head:hover{background:rgba(118,118,128,.05)}
.tw-page.tw-ios .tw-wspace-caret{width:10px;flex:none;color:var(--tw-muted);font-size:9px}
.tw-page.tw-ios .tw-wspace-name{min-width:0;flex:1;font-size:13px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-page.tw-ios .tw-wspace-count{flex:none;font-family:inherit;font-size:11px;color:var(--tw-muted);padding:1px 7px;border:0;border-radius:100px;background:rgba(118,118,128,.10)}
.tw-page.tw-ios .tw-wspace .tw-grid{padding:var(--tw-gap,12px) 0 6px;gap:var(--tw-gap,12px)}
.tw-page.tw-ios .tw-wspace-more{display:flex;justify-content:center;padding:10px 0 18px}
.tw-page.tw-ios .tw-wspace-more button{height:34px;padding:0 18px;border:0;border-radius:100px;background:var(--tw-accent);color:#fff;font-size:13px;font-weight:600;letter-spacing:-.01em;cursor:pointer;box-shadow:0 3px 12px color-mix(in srgb,var(--tw-accent) 24%,transparent)}
.tw-page.tw-ios .tw-wspace-more button:hover{background:color-mix(in srgb,var(--tw-accent) 86%,#000)}
.tw-page.tw-ios .tw-shelf-body{padding:12px 0 2px;background:transparent!important;border-radius:0}
.tw-page.tw-ios .tw-row{gap:var(--tw-gap,12px);padding-bottom:6px}
.tw-page.tw-ios .tw-grid{gap:var(--tw-gap,12px);padding-bottom:6px}
.tw-page.tw-ios .tw-card{
  border:0;border-radius:18px;background:var(--tw-pane);
  box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05);
  transition:box-shadow .18s,transform .18s,background .18s;
}
.tw-page.tw-ios .tw-card:hover{background:var(--tw-pane);box-shadow:0 2px 4px rgba(0,0,0,.05),0 14px 34px rgba(0,0,0,.09);transform:translateY(-1px)}
.tw-page.tw-ios .tw-card.pin{flex:0 0 calc((100% - (var(--tw-cols,3) - 1) * var(--tw-gap,12px)) / var(--tw-cols,3));max-width:none;height:var(--tw-card-h,450px);background:var(--tw-pane);border-top:0}
.tw-page.tw-ios .tw-card.active{
  flex:0 0 calc((100% - (var(--tw-cols,5) - 1) * var(--tw-gap,12px)) / var(--tw-cols,5));
  height:var(--tw-card-h,450px);background:var(--tw-pane);border-top:0;
}
.tw-page.tw-ios .tw-card.collection{height:var(--tw-card-h,450px);background:var(--tw-pane);border-top:0}
.tw-page.tw-ios .tw-card.is-running,.tw-page.tw-ios .tw-card.is-waiting{border-radius:18px;border-top:0;animation:none;box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05)}
.tw-page.tw-ios .tw-card.is-waiting{box-shadow:0 0 0 3px color-mix(in srgb,var(--tw-accent) 10%,transparent),0 8px 24px rgba(0,0,0,.05)}
.tw-page.tw-ios .tw-card-body{padding:12px 14px 10px;gap:0}
.tw-page.tw-ios .tw-card.active .tw-card-body{padding:12px 14px 10px}
.tw-page.tw-ios .tw-card-top{min-height:34px;padding:0 0 8px;gap:8px;background:transparent;border-bottom:0}
.tw-page.tw-ios .tw-card-title{font-size:calc(var(--tw-font) * .9);line-height:1.4;font-weight:600;letter-spacing:-.02em;color:var(--tw-ink)}
.tw-page.tw-ios .tw-led{width:8px;height:8px;border-radius:50%;background:#C7C7CC}
.tw-page.tw-ios .tw-led.run{background:var(--tw-green);box-shadow:0 0 0 3px color-mix(in srgb,var(--tw-green) 14%,transparent)}
.tw-page.tw-ios .tw-led.wait{background:var(--tw-accent)}
.tw-page.tw-ios .tw-icon-btn{
  width:26px;height:26px;border-radius:50%;background:transparent;color:var(--tw-muted);
  opacity:.7;pointer-events:auto;
}
.tw-page.tw-ios .tw-icon-btn:hover{background:var(--tw-paper);color:var(--tw-ink)}
.tw-page.tw-ios .tw-handle{height:22px;padding:0 8px;border:0;border-radius:100px;font-size:11px;font-weight:500}
.tw-page.tw-ios .tw-handle-static{background:var(--tw-accent);color:#fff}
.tw-page.tw-ios .tw-meta{padding:0 0 8px;font-family:inherit;font-size:11px;line-height:16px;color:var(--tw-muted);letter-spacing:0}
.tw-page.tw-ios .tw-meta .sep{color:var(--tw-line)}
.tw-page.tw-ios .tw-log{padding:2px 0 4px;gap:8px;margin:0;overscroll-behavior:auto}
.tw-page.tw-ios .tw-log-wrap{overscroll-behavior:auto}
.tw-page.tw-ios .tw-msg{padding:0;gap:0}
.tw-page.tw-ios .tw-msg.user{align-items:flex-end}
.tw-page.tw-ios .tw-msg.agent{align-items:flex-start}
.tw-page.tw-ios .tw-msg .role{display:none}
.tw-page.tw-ios .tw-msg p{
  max-width:84%;padding:9px 13px;border:0;border-radius:19px;
  background:var(--tw-agent-bg);color:var(--tw-ink);
  font-size:calc(var(--tw-font) * .84);line-height:1.42;letter-spacing:0;
  box-shadow:none;
}
.tw-page.tw-ios .tw-msg.agent p{border-bottom-left-radius:6px;background:var(--tw-agent-bg);color:var(--tw-ink)}
.tw-page.tw-ios .tw-msg.user p{border-bottom-right-radius:6px;border-bottom-left-radius:19px;background:var(--tw-user-bg);color:var(--tw-user-ink);box-shadow:0 1px 1px rgba(0,0,0,.05)}
.tw-page.tw-ios .tw-card[data-bubbles="left"] .tw-msg.user p{border-bottom-left-radius:6px;border-bottom-right-radius:19px}
.tw-page.tw-ios .tw-tool-group{border:0;border-radius:14px;background:rgba(118,118,128,.08);overflow:hidden}
.tw-page.tw-ios .tw-tool-group summary{padding:8px 11px;color:var(--tw-muted);font-size:12px;line-height:18px}
.tw-page.tw-ios .tw-tool-group-count{padding:1px 6px;border-radius:100px;background:rgba(118,118,128,.14);color:var(--tw-ink2);font-family:inherit;font-size:10px}
.tw-page.tw-ios .tw-tool-group-body{padding:0 12px 6px}
.tw-page.tw-ios .tw-tool-item{gap:8px;padding:7px 0;border-top:.5px solid rgba(60,60,67,.10)}
.tw-page.tw-ios .tw-tool-n{font-family:inherit;font-size:10px;color:var(--tw-muted);min-width:16px}
.tw-page.tw-ios .tw-tool-item pre{font-size:calc(var(--tw-font) * .62);line-height:1.5;color:var(--tw-ink2)}
.tw-page.tw-ios .tw-compose{border-top:.5px solid rgba(60,60,67,.10);margin-top:auto;padding:10px 0 0;gap:8px}
.tw-page.tw-ios .tw-compose textarea{
  min-height:36px;max-height:104px;border:0;border-radius:18px;background:var(--tw-paper);color:var(--tw-ink);
  padding:8px 44px 8px 40px;font-size:14px;line-height:20px;outline:none;resize:none;box-sizing:border-box;
}
.tw-page.tw-ios .tw-compose textarea::placeholder{color:var(--tw-muted)}
.tw-page.tw-ios .tw-msg-images{display:flex;flex-wrap:wrap;gap:4px;max-width:84%;justify-content:flex-end}
.tw-page.tw-ios .tw-msg.agent .tw-msg-images{justify-content:flex-start}
.tw-page.tw-ios .tw-msg-images img{display:block;max-width:172px;max-height:172px;border-radius:16px;object-fit:cover;border:.5px solid rgba(60,60,67,.12);background:var(--tw-paper)}
.tw-log{overscroll-behavior:auto}
.tw-log .tw-msg{transition:none!important}
.tw-log .tw-msg p,.tw-log .tw-msg-images,.tw-log .tw-msg-images img,.tw-log .tw-tool-group,.tw-log .tw-tool-group-body,.tw-log .tw-tool-group summary{animation:none!important;transition:none!important}
.tw-page,.tw-board{overflow-anchor:none}
.tw-log{justify-content:flex-start;align-items:stretch}
.tw-log .tw-msg{width:100%;flex:0 0 auto}
.tw-log .tw-msg.agent{align-items:flex-start!important}
.tw-log .tw-msg.user{align-items:flex-end!important}
.tw-log .tw-msg p{text-align:left}

.tw-log-wrap{overscroll-behavior:auto}
.tw-msg-images{display:flex;flex-wrap:wrap;gap:4px;max-width:92%;justify-content:flex-end}
.tw-msg.agent .tw-msg-images{justify-content:flex-start}
.tw-msg-images img{display:block;max-width:176px;max-height:176px;border-radius:10px;object-fit:cover;border:1px solid var(--tw-line-soft);background:var(--tw-code)}
.tw-page[data-style="qzone"] .tw-msg-images img{border-radius:12px;border-color:var(--tw-line);background:var(--tw-pane)}
.tw-page[data-style="hacker"] .tw-msg-images img{border-radius:0;border-color:var(--tw-line);background:#030603}
.tw-artifacts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;width:100%;max-width:100%}
.tw-artifact{display:flex;flex-direction:column;gap:6px;min-width:0;padding:8px;border:1px solid var(--tw-line-soft);border-radius:12px;background:var(--tw-pane);color:var(--tw-ink);text-align:left;cursor:pointer}
.tw-artifact:hover{background:var(--tw-code);border-color:var(--tw-line)}
.tw-artifact img{display:block;width:100%;height:96px;object-fit:cover;border-radius:8px;background:var(--tw-code)}
.tw-artifact-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:var(--tw-code);color:var(--tw-muted);font-size:16px}
.tw-artifact-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.tw-artifact-copy b{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-artifact-copy small{font-size:10px;line-height:14px;color:var(--tw-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-page[data-style="qzone"] .tw-artifact{border-radius:12px;border-color:var(--tw-line);background:var(--tw-pane)}
.tw-page[data-style="qzone"] .tw-artifact img{border-radius:8px}
.tw-page[data-style="qzone"] .tw-artifact-icon{border-radius:8px}
.tw-page[data-style="hacker"] .tw-artifact{border-radius:0;border-color:var(--tw-line);background:var(--tw-code)}
.tw-page[data-style="hacker"] .tw-artifact img{border-radius:0}
.tw-page[data-style="hacker"] .tw-artifact-icon{border-radius:0;background:#030603}
.tw-file-input{display:none!important}
.tw-page.tw-ios .tw-attach{width:32px;height:32px;flex:none;border:0;border-radius:50%;background:var(--tw-paper);color:var(--tw-ink2);display:grid;place-items:center;cursor:pointer}
.tw-page.tw-ios .tw-attach:hover{background:#E9E9EB;color:var(--tw-ink)}
.tw-page.tw-ios .tw-attach-strip{display:flex;gap:7px;padding:8px 0 2px;overflow-x:auto}
.tw-page.tw-ios .tw-attach-item{position:relative;flex:none;width:46px;height:46px;border-radius:11px;overflow:hidden;background:var(--tw-paper)}
.tw-page.tw-ios .tw-attach-item img{width:100%;height:100%;object-fit:cover;display:block}
.tw-page.tw-ios .tw-attach-item button{position:absolute;top:2px;right:2px;width:17px;height:17px;padding:0;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font-size:12px;line-height:17px;text-align:center;cursor:pointer}
.tw-page.tw-ios .tw-compose textarea:focus{background:#fff;border:1px solid var(--tw-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--tw-accent) 14%,transparent);padding:8px 44px 8px 40px}
.tw-page.tw-ios .tw-send{width:30px;height:30px;border-radius:50%;background:var(--tw-accent);color:#fff}
.tw-page.tw-ios .tw-send:hover{background:color-mix(in srgb,var(--tw-accent) 86%,#000);color:#fff}
.tw-page.tw-ios .tw-send:disabled{background:#C7C7CC;color:#fff;opacity:1}
.tw-page.tw-ios .tw-queue{margin-top:8px;padding:8px 10px;border:0;border-radius:14px;background:color-mix(in srgb,var(--tw-accent) 8%,#fff);gap:5px}
.tw-page.tw-ios .tw-queue-head{color:var(--tw-accent);font-size:12px;font-weight:600}
.tw-page.tw-ios .tw-queue-item{font-size:12px;color:var(--tw-ink2)}
.tw-page.tw-ios .tw-queue-list{gap:4px;max-height:74px}
.tw-page.tw-ios .tw-queue-item button{border-radius:50%;width:20px;height:20px}
.tw-page.tw-ios .tw-jump-bottom{right:4px;bottom:8px;width:36px;height:36px;border:.5px solid rgba(60,60,67,.12);border-radius:50%;background:rgba(255,255,255,.92);color:var(--tw-ink);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 4px 16px rgba(0,0,0,.14)}
.tw-page.tw-ios .tw-load-older{border:0;border-radius:100px;background:rgba(118,118,128,.10);color:var(--tw-muted);padding:4px 10px;font-size:11px}
.tw-page.tw-ios .tw-log-empty{color:var(--tw-muted);font-size:13px}
.tw-page.tw-ios .tw-typing{color:var(--tw-muted);padding:4px 2px}
.tw-page.tw-ios .tw-approval{border:0;border-radius:14px;background:#FFF8EC}
.tw-page.tw-ios .tw-approval-action{border:0;border-radius:100px;background:rgba(118,118,128,.12);height:28px;padding:0 12px;font-size:12px}
.tw-page.tw-ios .tw-approval-action.allow{background:var(--tw-accent);color:#fff}
.tw-page.tw-ios .tw-ants rect{stroke-width:2;stroke-dasharray:10 7}
.tw-page.tw-ios .tw-foot{color:var(--tw-muted);font-size:11px}
.tw-page.tw-ios .tw-foot i{border-color:var(--tw-accent);border-radius:50%}
.tw-page.tw-ios .tw-settings-backdrop{background:rgba(0,0,0,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.tw-page.tw-ios .tw-settings{
  top:calc(50% + 32px);right:18px;width:min(396px,calc(100vw - 32px));height:min(760px,calc(100vh - 104px));max-height:calc(100vh - 104px);
  border:0;border-radius:24px;background:rgba(255,255,255,.96);color:var(--tw-ink);
  box-shadow:0 24px 80px rgba(0,0,0,.20);padding:0;overflow:hidden;
  -webkit-backdrop-filter:saturate(180%) blur(28px);backdrop-filter:saturate(180%) blur(28px);
}
.tw-page.tw-ios .tw-settings-head{padding:20px 20px 12px;border-bottom:0;background:transparent}
.tw-page.tw-ios .tw-settings-head h2{font-size:22px;line-height:28px;font-weight:700;letter-spacing:-.03em}
.tw-page.tw-ios .tw-settings-head p{margin-top:3px;color:var(--tw-muted);font-size:12px;line-height:17px}
.tw-page.tw-ios .tw-settings-close{width:28px;height:28px;border-radius:50%;background:var(--tw-paper);color:var(--tw-muted);font-size:18px}
.tw-page.tw-ios .tw-settings-body{padding:0 16px 10px;background:var(--tw-paper)}
.tw-page.tw-ios .tw-config-section{border:0;border-radius:14px;background:#fff;padding:13px 14px;margin:0 0 10px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.tw-page.tw-ios .tw-config-title{margin-bottom:10px}
.tw-page.tw-ios .tw-config-title h3{font-size:13px;line-height:18px;font-weight:600;letter-spacing:-.01em}
.tw-page.tw-ios .tw-config-title p{color:var(--tw-muted);font-size:11px;line-height:15px}
.tw-page.tw-ios .tw-material{padding:4px;border:.5px solid rgba(60,60,67,.14);border-radius:10px;background:#fff;font-size:11px}
.tw-page.tw-ios .tw-material-swatch{height:28px;border-radius:7px;border:.5px solid rgba(60,60,67,.12)}
.tw-page.tw-ios .tw-material[data-active="true"]{border-color:var(--tw-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--tw-accent) 16%,transparent)}
.tw-page.tw-ios .tw-config-label{font-size:13px;color:var(--tw-ink)}
.tw-page.tw-ios .tw-config-row .tw-segment{min-width:156px;flex:0 0 auto}
.tw-page.tw-ios .tw-config-row .tw-segment button{white-space:nowrap;padding:0 4px;font-size:12px}
.tw-page.tw-ios .tw-segment{border:0;border-radius:9px;background:rgba(118,118,128,.12);padding:2px;gap:2px;overflow:visible}
.tw-page.tw-ios .tw-segment button{height:26px;border:0!important;border-radius:7px;color:var(--tw-ink2);font-size:12px;font-weight:500}
.tw-page.tw-ios .tw-segment button[data-active="true"]{background:#fff;color:var(--tw-ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.tw-page.tw-ios .tw-config-slider{margin-top:12px}
.tw-page.tw-ios .tw-config-line{font-size:13px;color:var(--tw-ink)}
.tw-page.tw-ios .tw-config-line output{font-family:inherit;font-size:12px;color:var(--tw-muted)}
.tw-page.tw-ios .tw-config-slider input[type=range]{height:22px;accent-color:var(--tw-accent)}
.tw-page.tw-ios .tw-config-hint{font-size:11px;line-height:15px;color:var(--tw-muted)}
.tw-page.tw-ios .tw-toggle{padding:5px 0}
.tw-page.tw-ios .tw-toggle-copy b{font-size:13px;font-weight:500}
.tw-page.tw-ios .tw-toggle-copy small{font-size:11px;color:var(--tw-muted)}
.tw-page.tw-ios .tw-switch{width:44px;height:26px;background:rgba(120,120,128,.20)}
.tw-page.tw-ios .tw-switch i{top:2px;left:2px;width:22px;height:22px;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.2)}
.tw-page.tw-ios .tw-switch[data-on="true"]{background:var(--tw-success,#34C759)}
.tw-page.tw-ios .tw-switch[data-on="true"] i{transform:translateX(18px)}
.tw-page.tw-ios .tw-settings .tw-settings-scope{font-size:11px;line-height:16px;color:var(--tw-muted);padding:0 4px 8px}
.tw-page.tw-ios .tw-settings-foot{padding:10px 16px 16px;gap:8px;border-top:.5px solid rgba(60,60,67,.10);background:rgba(255,255,255,.96)}
.tw-page.tw-ios .tw-settings-foot .tw-log-open,.tw-page.tw-ios .tw-reset{height:30px;border:0;border-radius:100px;background:rgba(118,118,128,.12);color:var(--tw-ink2);font-size:12px;padding:0 12px}
.tw-page.tw-ios .tw-save{height:44px;border:0;border-radius:14px;background:var(--tw-accent);font-size:15px;font-weight:600;letter-spacing:-.01em;box-shadow:0 4px 14px color-mix(in srgb,var(--tw-accent) 28%,transparent)}
.tw-page.tw-ios .tw-save:hover{background:color-mix(in srgb,var(--tw-accent) 88%,#000)}
.tw-page.tw-ios .tw-settings-alert{background:#FF3B30;box-shadow:0 0 0 2px #fff}
.tw-page.tw-ios .tw-log-backdrop{background:rgba(0,0,0,.24);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.tw-page.tw-ios .tw-log-panel{border:0;border-radius:22px;background:rgba(255,255,255,.98);box-shadow:0 24px 80px rgba(0,0,0,.24)}
.tw-page.tw-ios .tw-log-head{padding:18px 18px 12px;border-bottom:.5px solid rgba(60,60,67,.10)}
.tw-page.tw-ios .tw-log-head h2{font-size:20px;font-weight:700;letter-spacing:-.02em}
.tw-page.tw-ios .tw-log-actions{padding:10px 18px;border-bottom:.5px solid rgba(60,60,67,.10);gap:8px}
.tw-page.tw-ios .tw-log-actions button,.tw-page.tw-ios .tw-log-foot button{height:30px;border:0;border-radius:100px;background:rgba(118,118,128,.12);font-size:12px;padding:0 12px}
.tw-page.tw-ios .tw-log-list{padding:10px 18px 18px}
.tw-page.tw-ios .tw-log-entry{padding:10px 0;border-bottom:.5px solid rgba(60,60,67,.10)}
.tw-page.tw-ios .tw-log-entry p{font-size:12px}
.tw-page.tw-ios .tw-log-entry .tw-log-context,.tw-page.tw-ios .tw-log-entry details pre{border-radius:10px;background:var(--tw-paper)}
.tw-page.tw-ios .tw-crash-card{border:0;border-radius:20px;box-shadow:0 18px 50px rgba(0,0,0,.16)}
.tw-page.tw-ios .tw-crash-card h1{font-size:22px;letter-spacing:-.02em}
.tw-page.tw-ios .tw-empty{border:0;border-radius:16px;background:#fff;font-size:13px;padding:20px}
@media (max-width:760px){
  .tw-page.tw-ios .tw-top{padding:10px 14px}
  .tw-page.tw-ios .tw-board{padding:16px 14px 48px}
  .tw-page.tw-ios .tw-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .tw-page.tw-ios .tw-card.pin,.tw-page.tw-ios .tw-card.active{width:100%;flex:1 1 auto}
  .tw-settings{right:10px;width:calc(100vw - 20px);height:calc(100vh - 24px);max-height:calc(100vh - 24px);top:calc(50% + 24px)}
  .tw-page.tw-ios .tw-summary{flex-wrap:wrap}
  .tw-page.tw-ios .tw-hint{display:none}
}
/* Theme style selector */
.tw-config-sublabel{margin:10px 0 5px;font-size:10px;font-weight:600;color:var(--tw-muted);letter-spacing:.01em}
.tw-style-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.tw-style{display:flex;flex-direction:column;gap:5px;padding:5px;border:1px solid var(--tw-line);border-radius:6px;background:var(--tw-pane);color:var(--tw-ink);cursor:pointer;text-align:left}
.tw-style[data-active="true"]{border-color:var(--tw-accent);box-shadow:inset 0 0 0 1px var(--tw-accent)}
.tw-style-preview{display:block;height:26px;border-radius:4px;border:1px solid rgba(60,60,67,.14);background:#F2F2F7;position:relative;overflow:hidden}
.tw-style-preview i{position:absolute;left:4px;top:4px;width:9px;height:9px;border-radius:50%;background:#007AFF}
.tw-style-preview b{position:absolute;left:17px;right:4px;bottom:4px;height:7px;border-radius:2px;background:#fff;box-shadow:0 0 0 1px rgba(60,60,67,.12)}
.tw-style[data-style="qzone"] .tw-style-preview{background:linear-gradient(180deg,#4AA3FF,#2F7BE8);border-radius:7px}
.tw-style[data-style="qzone"] .tw-style-preview i{border-radius:50%;background:#FFD75E}
.tw-style[data-style="qzone"] .tw-style-preview b{border-radius:5px;background:#fff;box-shadow:0 2px 6px rgba(47,128,237,.22)}
.tw-style[data-style="hacker"] .tw-style-preview{background:#050805;border-color:#1D4B28;border-radius:0}
.tw-style[data-style="hacker"] .tw-style-preview i{border-radius:0;background:#39FF14}
.tw-style[data-style="hacker"] .tw-style-preview b{border-radius:0;background:#0A120A;box-shadow:0 0 0 1px #1D4B28}
.tw-style-copy{display:flex;flex-direction:column;gap:1px;min-width:0}
.tw-style-copy b{font-size:10.5px;font-weight:600}
.tw-style-copy small{font-size:9px;line-height:12px;color:var(--tw-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw-page.tw-ios .tw-config-sublabel{color:var(--tw-muted);font-size:11px;margin:10px 0 6px}
.tw-page.tw-ios .tw-style{border:.5px solid rgba(60,60,67,.14);border-radius:10px;padding:4px;background:#fff}
.tw-page.tw-ios .tw-style-preview{height:28px;border-radius:7px}
.tw-page.tw-ios .tw-style[data-active="true"]{border-color:var(--tw-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--tw-accent) 16%,transparent)}
.tw-page.tw-ios .tw-style-copy b{font-size:11px}
.tw-page.tw-ios .tw-style-copy small{font-size:9px}

/* Qzone theme: sky blue, white cards, playful social */
.tw-page[data-style="qzone"]{
  --tw-paper:#EAF5FF;--tw-pane:#FFFFFF;--tw-code:#EAF4FF;--tw-ink:#123A66;--tw-ink2:#35587C;
  --tw-muted:#6C8BA8;--tw-line:#BFDDF8;--tw-line-soft:#DCECFB;--tw-agent-bg:#F2F8FF;
  --tw-accent:#2F80ED;--tw-accent-soft:#E8F3FF;--tw-accent-line:#B9DAFF;
  --tw-top-bg:linear-gradient(180deg,#4AA3FF,#2F7BE8);--tw-top-ink:#FFFFFF;--tw-top-muted:#DDEEFF;
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB",sans-serif;
}
.tw-page[data-style="qzone"] .tw-top{
  min-height:64px;padding:12px 20px;background:linear-gradient(180deg,#4AA3FF,#2F7BE8);color:#fff;
  border-bottom:1px solid #1E6CD4;box-shadow:0 2px 10px rgba(47,128,237,.22);
}
.tw-page[data-style="qzone"] .tw-title{font-size:20px;font-weight:700;letter-spacing:-.02em;color:#fff}
.tw-page[data-style="qzone"] .tw-mark i{background:#fff;border-radius:2px}
.tw-page[data-style="qzone"] .tw-mark i:last-child{background:#FFD75E}
.tw-page[data-style="qzone"] .tw-summary{color:#DDEEFF;font-family:inherit;font-size:11px;background:rgba(255,255,255,.14);border-radius:100px;padding:4px 10px}
.tw-page[data-style="qzone"] .tw-summary b{color:#fff}
.tw-page[data-style="qzone"] .tw-summary .sep{color:rgba(255,255,255,.38)}
.tw-page[data-style="qzone"] .tw-hint{color:#E4F1FF;font-size:11px}
.tw-page[data-style="qzone"] .tw-settings-btn{width:30px;height:30px;border:1px solid rgba(255,255,255,.42);border-radius:50%;background:rgba(255,255,255,.12);color:#fff}
.tw-page[data-style="qzone"] .tw-settings-btn:hover{background:rgba(255,255,255,.22)}
.tw-page[data-style="qzone"] .tw-board{
  padding:18px 20px 48px;background-color:#EAF5FF;
  background-image:radial-gradient(circle at 18% 22%,rgba(255,255,255,.95) 0 2px,transparent 2.6px),radial-gradient(circle at 72% 58%,rgba(255,255,255,.8) 0 1.5px,transparent 2.1px),radial-gradient(circle at 42% 82%,rgba(255,255,255,.85) 0 1.5px,transparent 2.1px);
  background-size:220px 220px,260px 260px,300px 300px;
}
.tw-page[data-style="qzone"] .tw-shelf{max-width:1360px;margin:0 auto 18px;background:transparent;border:0;border-radius:0;overflow:visible}
.tw-page[data-style="qzone"] .tw-shelf-head{top:64px;min-height:40px;padding:8px 8px;background:rgba(255,255,255,.92);color:#123A66;border-bottom:2px solid #2F80ED;border-radius:10px 10px 0 0;box-shadow:0 1px 0 rgba(47,128,237,.06)}
.tw-page[data-style="qzone"] .tw-shelf-head h2{color:#123A66;font-size:14px;font-weight:700}
.tw-page[data-style="qzone"] .tw-shelf-head h2::before{display:inline-block;width:4px;height:13px;margin-right:7px;background:#2F80ED;border-radius:2px}
.tw-page[data-style="qzone"] .tw-shelf-hint{color:#6C8BA8;font-size:11px}
.tw-page[data-style="qzone"] .tw-shelf-count{color:#2F80ED;font-family:inherit;font-size:14px;font-weight:700}
.tw-page[data-style="qzone"] .tw-shelf-body{padding:12px 0 2px;background:transparent!important;border-radius:0}
.tw-page[data-style="qzone"] .tw-row,.tw-page[data-style="qzone"] .tw-grid{gap:var(--tw-gap,12px);padding-bottom:8px}
.tw-page[data-style="qzone"] .tw-card{border:1px solid #CBE4FA;border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(18,58,102,.04),0 6px 18px rgba(47,128,237,.07)}
.tw-page[data-style="qzone"] .tw-card:hover{background:#fff;border-color:#9CCBF5;box-shadow:0 2px 4px rgba(18,58,102,.05),0 10px 24px rgba(47,128,237,.09);transform:translateY(-1px)}
.tw-page[data-style="qzone"] .tw-card.pin,.tw-page[data-style="qzone"] .tw-card.active,.tw-page[data-style="qzone"] .tw-card.collection{background:#fff;border:1px solid #CBE4FA;border-top:3px solid #2F80ED;border-radius:14px}
.tw-page[data-style="qzone"] .tw-card.is-running,.tw-page[data-style="qzone"] .tw-card.is-waiting{border-radius:14px;box-shadow:0 1px 2px rgba(18,58,102,.04),0 6px 18px rgba(47,128,237,.07);animation:none}
.tw-page[data-style="qzone"] .tw-card-body{padding:10px 11px 8px}
.tw-page[data-style="qzone"] .tw-card-top{min-height:32px;padding:5px 0 7px;background:transparent;border-bottom:1px solid #E3F0FC}
.tw-page[data-style="qzone"] .tw-card-title{font-size:calc(var(--tw-font) * .9);font-weight:700;letter-spacing:-.01em;color:#123A66}
.tw-page[data-style="qzone"] .tw-meta{padding:5px 0 6px;font-family:inherit;font-size:10px;color:#6C8BA8}
.tw-page[data-style="qzone"] .tw-icon-btn{width:24px;height:24px;border-radius:50%;opacity:.8;pointer-events:auto;color:#6C8BA8}
.tw-page[data-style="qzone"] .tw-icon-btn:hover{background:#EAF4FF;color:#2F80ED}
.tw-page[data-style="qzone"] .tw-handle{border-radius:100px;height:22px;font-size:11px;background:var(--tw-accent)}
.tw-page[data-style="qzone"] .tw-log{padding:4px 0;gap:7px}
.tw-page[data-style="qzone"] .tw-msg{padding:1px 0;gap:1px}
.tw-page[data-style="qzone"] .tw-msg .role{display:block;font-family:inherit;font-size:9px;color:#8AA9C4}
.tw-page[data-style="qzone"] .tw-msg p{max-width:86%;padding:8px 12px;border:1px solid #DCECFB;border-radius:18px;background:#fff;color:#234B75;box-shadow:0 1px 2px rgba(47,128,237,.05);font-size:calc(var(--tw-font) * .82);line-height:1.5}
.tw-page[data-style="qzone"] .tw-msg.agent p{border-bottom-left-radius:6px;background:#F7FBFF;color:#234B75}
.tw-page[data-style="qzone"] .tw-msg.user p{border:0;border-bottom-right-radius:6px;border-bottom-left-radius:18px;background:linear-gradient(180deg,#4AA3FF,#2F80ED);color:#fff;box-shadow:0 2px 8px rgba(47,128,237,.24)}
.tw-page[data-style="qzone"] .tw-tool-group{border:1px solid #DCECFB;border-radius:12px;background:#F4FAFF}
.tw-page[data-style="qzone"] .tw-tool-group summary{font-family:inherit;font-size:11px;color:#6C8BA8}
.tw-page[data-style="qzone"] .tw-tool-group-count{border-radius:100px;background:#E4F1FE;color:#2F80ED;font-family:inherit}
.tw-page[data-style="qzone"] .tw-tool-item pre{color:#35587C;font-size:calc(var(--tw-font) * .62)}
.tw-page[data-style="qzone"] .tw-compose{border-top:1px solid #E3F0FC;padding:8px 0 0;gap:6px}
.tw-page[data-style="qzone"] .tw-compose textarea{min-height:34px;max-height:96px;border:1px solid #CBE4FA;border-radius:17px;background:#F4FAFF;color:#123A66;padding:8px 42px 8px 38px;font-size:calc(var(--tw-font) * .8);line-height:1.4;resize:none;box-sizing:border-box}
.tw-page[data-style="qzone"] .tw-compose textarea::placeholder{color:#8AA9C4}
.tw-page[data-style="qzone"] .tw-compose textarea:focus{background:#fff;border:1px solid #2F80ED;box-shadow:0 0 0 3px rgba(47,128,237,.12);padding:8px 42px 8px 38px}
.tw-page[data-style="qzone"] .tw-attach{width:32px;height:32px;border-radius:50%;background:#EAF4FF;color:#2F80ED}
.tw-page[data-style="qzone"] .tw-send{width:30px;height:30px;border-radius:50%;background:#2F80ED;color:#fff}
.tw-page[data-style="qzone"] .tw-queue{border:1px solid #CBE4FA;border-radius:12px;background:#F4FAFF}
.tw-page[data-style="qzone"] .tw-jump-bottom{border-radius:50%;border:1px solid #CBE4FA;background:rgba(255,255,255,.94);color:#2F80ED;box-shadow:0 4px 14px rgba(47,128,237,.18)}
.tw-page[data-style="qzone"] .tw-load-older{border-radius:100px;border:1px solid #CBE4FA;background:#fff;color:#2F80ED}
.tw-page[data-style="qzone"] .tw-wspace{border:1px solid #CBE4FA;border-radius:14px;background:#fff;overflow:hidden}
.tw-page[data-style="qzone"] .tw-wspace-head{background:#F4FAFF;border-bottom:1px solid #DCECFB;border-radius:0}
.tw-page[data-style="qzone"] .tw-wspace-name{font-size:13px;font-weight:700;color:#123A66}
.tw-page[data-style="qzone"] .tw-wspace-count{border:0;border-radius:100px;background:#E4F1FE;color:#2F80ED;font-family:inherit}
.tw-page[data-style="qzone"] .tw-wspace-more button{height:32px;border:0;border-radius:100px;background:#2F80ED;color:#fff;font-size:12px;font-weight:600;box-shadow:0 3px 10px rgba(47,128,237,.22)}
.tw-page[data-style="qzone"] .tw-workspace-tools{font-family:inherit;font-size:11px;color:#6C8BA8}
.tw-page[data-style="qzone"] .tw-workspace-tools button{border:0;border-radius:100px;background:#EAF4FF;color:#2F80ED;font-size:11px}
.tw-page[data-style="qzone"] .tw-foot{font-family:inherit;font-size:10px;color:#6C8BA8}
.tw-page[data-style="qzone"] .tw-settings-backdrop{background:rgba(23,58,102,.20);backdrop-filter:blur(6px)}
.tw-page[data-style="qzone"] .tw-settings{border:1px solid #CBE4FA;border-top:3px solid #2F80ED;border-radius:20px;background:#fff;box-shadow:0 24px 70px rgba(47,128,237,.24)}
.tw-page[data-style="qzone"] .tw-settings-head{background:linear-gradient(180deg,#F4FAFF,#fff);border-bottom:1px solid #E3F0FC;border-radius:17px 17px 0 0}
.tw-page[data-style="qzone"] .tw-settings-body{background:#F4FAFF}
.tw-page[data-style="qzone"] .tw-config-section{border:0;border-radius:14px;background:#fff;padding:13px 14px;margin:0 0 10px;box-shadow:0 1px 2px rgba(47,128,237,.05)}
.tw-page[data-style="qzone"] .tw-style,.tw-page[data-style="qzone"] .tw-material{border-radius:10px;border-color:#DCECFB;background:#fff}
.tw-page[data-style="qzone"] .tw-style-preview,.tw-page[data-style="qzone"] .tw-material-swatch{border-radius:7px}
.tw-page[data-style="qzone"] .tw-segment{border-radius:9px;background:#EAF4FF}
.tw-page[data-style="qzone"] .tw-segment button{border-radius:7px}
.tw-page[data-style="qzone"] .tw-save{border-radius:14px;background:#2F80ED;box-shadow:0 4px 14px rgba(47,128,237,.24)}
.tw-page[data-style="qzone"] .tw-settings-foot{background:#fff;border-top:1px solid #E3F0FC}
/* Hacker theme: dark terminal, mono, square */
.tw-page[data-style="hacker"]{
  --tw-paper:#050805;--tw-pane:#080E08;--tw-code:#0C140C;--tw-ink:#B9FFC9;--tw-ink2:#7BDC92;
  --tw-muted:#4C8C5B;--tw-line:#1D4B28;--tw-line-soft:#14371D;--tw-agent-bg:#0A120A;
  --tw-top-bg:#020402;--tw-top-ink:#B9FFC9;--tw-top-muted:#4C8C5B;
  --tw-accent:#39FF14;--tw-accent-soft:#0A1F0A;--tw-accent-line:#1D4B28;
  font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
.tw-page[data-style="hacker"] .tw-top{min-height:64px;padding:12px 18px;background:var(--tw-top-bg);color:var(--tw-top-ink);border-bottom:1px solid var(--tw-line)}
.tw-page[data-style="hacker"] .tw-title{font-size:17px;font-weight:500;letter-spacing:0;color:var(--tw-ink);font-family:inherit}
.tw-page[data-style="hacker"] .tw-title::before{content:"> ";color:var(--tw-accent)}
.tw-page[data-style="hacker"] .tw-mark i{background:var(--tw-accent);border-radius:0}
.tw-page[data-style="hacker"] .tw-mark i:last-child{background:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-summary{color:var(--tw-muted);font-family:inherit;font-size:10px;background:transparent}
.tw-page[data-style="hacker"] .tw-summary b{color:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-summary .sep{color:var(--tw-line)}
.tw-page[data-style="hacker"] .tw-hint{color:var(--tw-muted);font-size:10px}
.tw-page[data-style="hacker"] .tw-settings-btn{width:28px;height:28px;border:1px solid var(--tw-line);border-radius:0;background:transparent;color:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-settings-btn:hover{background:var(--tw-code)}
.tw-page[data-style="hacker"] .tw-board{padding:16px 18px 44px;background:var(--tw-paper)}
.tw-page[data-style="hacker"] .tw-shelf{max-width:1320px;margin:0 auto 16px;background:transparent;border:1px solid var(--tw-line);border-radius:0}
.tw-page[data-style="hacker"] .tw-shelf-head{position:sticky;top:64px;min-height:40px;padding:8px 10px;background:#060B06;color:var(--tw-ink);border-bottom:1px solid var(--tw-accent);border-radius:0}
.tw-page[data-style="hacker"] .tw-shelf-head h2{color:var(--tw-ink);font-size:12px;font-weight:500;letter-spacing:0;font-family:inherit}
.tw-page[data-style="hacker"] .tw-shelf-head h2::before{display:inline-block;content:">";width:auto;height:auto;margin-right:6px;background:none;color:var(--tw-accent);border-radius:0}
.tw-page[data-style="hacker"] .tw-shelf-hint{color:var(--tw-muted);font-size:10px}
.tw-page[data-style="hacker"] .tw-shelf-count{color:var(--tw-accent);font-family:inherit;font-size:13px}
.tw-page[data-style="hacker"] .tw-shelf-body{padding:10px 0 2px;background:transparent!important;border-radius:0}
.tw-page[data-style="hacker"] .tw-row,.tw-page[data-style="hacker"] .tw-grid{gap:var(--tw-gap,12px);padding-bottom:8px}
.tw-page[data-style="hacker"] .tw-card{border:1px solid var(--tw-line);border-radius:0;background:var(--tw-pane);box-shadow:none}
.tw-page[data-style="hacker"] .tw-card:hover{background:#0B130B;border-color:var(--tw-accent);box-shadow:none;transform:none}
.tw-page[data-style="hacker"] .tw-card.pin,.tw-page[data-style="hacker"] .tw-card.active,.tw-page[data-style="hacker"] .tw-card.collection{background:var(--tw-pane);border:1px solid var(--tw-line);border-radius:0}
.tw-page[data-style="hacker"] .tw-card.is-running,.tw-page[data-style="hacker"] .tw-card.is-waiting{border-radius:0;box-shadow:none;animation:none}
.tw-page[data-style="hacker"] .tw-card-body{padding:8px 10px 7px}
.tw-page[data-style="hacker"] .tw-card-top{min-height:30px;padding:5px 0 7px;background:transparent;border-bottom:1px dashed var(--tw-line)}
.tw-page[data-style="hacker"] .tw-card-title{font-size:13px;font-weight:500;letter-spacing:0;color:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-card-title::before{content:"./";color:var(--tw-accent)}
.tw-page[data-style="hacker"] .tw-led{width:6px;height:6px;border-radius:0}
.tw-page[data-style="hacker"] .tw-meta{padding:5px 0 6px;font-family:inherit;font-size:9px;color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-icon-btn{width:22px;height:22px;border-radius:0;opacity:.8;pointer-events:auto;color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-handle{border-radius:0;height:20px;font-size:10px;background:var(--tw-accent);color:#020402}
.tw-page[data-style="hacker"] .tw-log{padding:4px 0;gap:6px}
.tw-page[data-style="hacker"] .tw-msg{padding:1px 0;gap:1px}
.tw-page[data-style="hacker"] .tw-msg .role{display:block;font-family:inherit;font-size:9px;color:var(--tw-muted);text-transform:uppercase}
.tw-page[data-style="hacker"] .tw-msg p{max-width:100%;padding:3px 0 3px 8px;border:0;border-left:2px solid var(--tw-line);border-radius:0;background:transparent;color:var(--tw-ink);box-shadow:none;font-size:calc(var(--tw-font) * .78);line-height:1.55;white-space:pre-wrap}
.tw-page[data-style="hacker"] .tw-msg.agent p{border-left-color:var(--tw-line);background:transparent;color:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-msg.user p{border-left-color:var(--tw-accent);background:rgba(57,255,20,.04);color:#D8FFE1}
.tw-page[data-style="hacker"] .tw-tool-group{border:1px solid var(--tw-line);border-radius:0;background:var(--tw-code)}
.tw-page[data-style="hacker"] .tw-tool-group summary{font-family:inherit;font-size:10px;color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-tool-group-count{border-radius:0;background:#061006;color:var(--tw-ink);font-family:inherit}
.tw-page[data-style="hacker"] .tw-tool-item pre{color:var(--tw-ink2)}
.tw-page[data-style="hacker"] .tw-compose{border-top:1px solid var(--tw-line);padding:8px 0 0;gap:5px}
.tw-page[data-style="hacker"] .tw-compose textarea{min-height:30px;max-height:96px;border:1px solid var(--tw-line);border-radius:0;background:#030603;color:var(--tw-ink);padding:6px 36px 6px 34px;font-size:11.5px;font-family:inherit;line-height:1.4;resize:none;box-sizing:border-box}
.tw-page[data-style="hacker"] .tw-compose textarea::placeholder{color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-compose textarea:focus{background:#061006;border:1px solid var(--tw-accent);box-shadow:none;padding:6px 36px 6px 34px}
.tw-page[data-style="hacker"] .tw-attach{width:30px;height:30px;border-radius:0;background:var(--tw-code);color:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-send{width:26px;height:26px;border-radius:0;background:var(--tw-accent);color:#020402}
.tw-page[data-style="hacker"] .tw-queue{border:1px solid var(--tw-line);border-radius:0;background:#061006}
.tw-page[data-style="hacker"] .tw-jump-bottom{border-radius:0;border:1px solid var(--tw-line);background:#061006;color:var(--tw-ink);box-shadow:none}
.tw-page[data-style="hacker"] .tw-load-older{border-radius:0;border:1px solid var(--tw-line);background:transparent;color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-wspace{border:1px solid var(--tw-line);border-radius:0;background:#060C06}
.tw-page[data-style="hacker"] .tw-wspace-head{background:#060B06;border-bottom:1px solid var(--tw-line);border-radius:0}
.tw-page[data-style="hacker"] .tw-wspace-name{font-size:12px;font-weight:500}
.tw-page[data-style="hacker"] .tw-wspace-count{border:1px solid var(--tw-line);border-radius:0;background:transparent;font-family:inherit}
.tw-page[data-style="hacker"] .tw-wspace-more button{height:28px;border:1px solid var(--tw-accent);border-radius:0;background:transparent;color:var(--tw-accent);font-size:11px;box-shadow:none}
.tw-page[data-style="hacker"] .tw-workspace-tools{font-family:inherit;font-size:10px;color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-workspace-tools button{border:1px solid var(--tw-line);border-radius:0;background:transparent;color:var(--tw-ink);font-size:10px}
.tw-page[data-style="hacker"] .tw-foot{font-family:inherit;font-size:9px;color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-foot i{border-color:var(--tw-accent);border-radius:0}
.tw-page[data-style="hacker"] .tw-settings-backdrop{background:rgba(0,0,0,.68);backdrop-filter:none}
.tw-page[data-style="hacker"] .tw-settings{border:1px solid var(--tw-accent);border-radius:0;background:#060B06;color:var(--tw-ink);box-shadow:0 0 0 1px #000,0 24px 60px rgba(0,0,0,.7)}
.tw-page[data-style="hacker"] .tw-settings-head{background:#040804;border-bottom:1px solid var(--tw-line)}
.tw-page[data-style="hacker"] .tw-settings-head h2{font-size:18px;font-weight:500;letter-spacing:0}
.tw-page[data-style="hacker"] .tw-settings-head h2::before{content:"> ";color:var(--tw-accent)}
.tw-page[data-style="hacker"] .tw-settings-head p{color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-settings-body{background:#060B06}
.tw-page[data-style="hacker"] .tw-config-section{border:1px solid var(--tw-line);border-radius:0;background:#070D07;padding:11px 12px;margin:0 0 8px;box-shadow:none}
.tw-page[data-style="hacker"] .tw-config-title h3{color:var(--tw-ink);font-size:11px;font-weight:500;text-transform:uppercase}
.tw-page[data-style="hacker"] .tw-config-sublabel{color:var(--tw-muted);font-family:inherit;text-transform:uppercase;font-size:9px}
.tw-page[data-style="hacker"] .tw-style,.tw-page[data-style="hacker"] .tw-material{border-radius:0;border-color:var(--tw-line);background:#060B06;color:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-style-preview,.tw-page[data-style="hacker"] .tw-material-swatch{border-radius:0}
.tw-page[data-style="hacker"] .tw-config-label,.tw-page[data-style="hacker"] .tw-config-line{color:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-config-line output{color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-segment{border-radius:0;background:#030603;border:1px solid var(--tw-line)}
.tw-page[data-style="hacker"] .tw-segment button{border-radius:0;color:var(--tw-muted)}
.tw-page[data-style="hacker"] .tw-segment button[data-active="true"]{background:var(--tw-accent);color:#020402;box-shadow:none}
.tw-page[data-style="hacker"] .tw-switch{width:30px;height:17px;border-radius:0;background:#030603;border:1px solid var(--tw-line)}
.tw-page[data-style="hacker"] .tw-switch i{border-radius:0;background:var(--tw-muted);box-shadow:none}
.tw-page[data-style="hacker"] .tw-switch[data-on="true"]{background:var(--tw-accent);border-color:var(--tw-accent)}
.tw-page[data-style="hacker"] .tw-switch[data-on="true"] i{background:#020402}
.tw-page[data-style="hacker"] .tw-toggle-copy b{color:var(--tw-ink);font-weight:500}
.tw-page[data-style="hacker"] .tw-settings-foot{background:#040804;border-top:1px solid var(--tw-line)}
.tw-page[data-style="hacker"] .tw-save{border-radius:0;background:var(--tw-accent);color:#020402;box-shadow:none}
.tw-page[data-style="hacker"] .tw-log-open,.tw-page[data-style="hacker"] .tw-reset{border-radius:0;border:1px solid var(--tw-line);background:transparent;color:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-ants rect{stroke:var(--tw-accent)}

.tw-page .tw-card.pin,.tw-page .tw-card.active{
  flex:0 0 calc((100% - (var(--tw-cols,3) - 1) * var(--tw-gap,12px)) / var(--tw-cols,3));
  max-width:none;height:var(--tw-card-h,450px);
}
@media (max-width:760px){
  .tw-page .tw-card.pin,.tw-page .tw-card.active{width:100%;flex:1 1 auto}
}
/* Theme-aware motion */
@keyframes tw-card-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes tw-msg-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
@keyframes tw-sheet-in{from{opacity:0;transform:translateY(calc(-50% + 8px)) scale(.985)}to{opacity:1;transform:translateY(-50%) scale(1)}}
@keyframes tw-fade-in{from{opacity:0}to{opacity:1}}
@keyframes tw-attach-in{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes tw-terminal-in{0%{opacity:0}50%{opacity:.55}100%{opacity:1}}
.tw-card.is-entering{animation:none}
.tw-msg:last-child{animation:none}
.tw-tool-group[open] .tw-tool-group-body{animation:tw-msg-in .18s ease both}
.tw-settings{animation:tw-sheet-in .28s cubic-bezier(.2,.8,.2,1) both}
.tw-settings-backdrop{animation:tw-fade-in .2s ease both}
.tw-attach-item{animation:tw-attach-in .18s cubic-bezier(.2,.8,.2,1) both}
.tw-send:active,.tw-attach:active,.tw-settings-btn:active,.tw-icon-btn:active,.tw-wspace-more button:active,.tw-jump-bottom:active,.tw-update-now:active{transform:scale(.94)}
.tw-page,.tw-top,.tw-shelf,.tw-shelf-head,.tw-shelf-body,.tw-card,.tw-card-top,.tw-msg p,.tw-tool-group,.tw-compose,.tw-compose textarea,.tw-settings,.tw-settings-head,.tw-settings-body,.tw-settings-foot,.tw-config-section,.tw-wspace,.tw-wspace-head,.tw-workspace-tools button,.tw-wspace-more button,.tw-style,.tw-material,.tw-segment,.tw-segment button,.tw-save,.tw-reset,.tw-log-open{transition:background-color .24s ease,color .24s ease,border-color .24s ease,box-shadow .2s ease}
.tw-page .tw-card{transition:background-color .24s ease,color .24s ease,border-color .24s ease,box-shadow .18s ease,transform .18s ease}


.tw-page[data-motion="off"] .tw-card.is-entering,.tw-page[data-motion="off"] .tw-msg:last-child,.tw-page[data-motion="off"] .tw-settings,.tw-page[data-motion="off"] .tw-settings-backdrop,.tw-page[data-motion="off"] .tw-attach-item{animation:none!important}
@media (prefers-reduced-motion:reduce){
  .tw-settings,.tw-settings-backdrop,.tw-attach-item,.tw-tool-group[open] .tw-tool-group-body{animation:none!important}
}

/* Breathing status LED (all themes) */
.tw-led{--tw-led-color:#C7C7CC;background:var(--tw-led-color);opacity:1;box-shadow:0 0 0 2px color-mix(in srgb,var(--tw-led-color) 10%,transparent);animation:none}
.tw-led.run{--tw-led-color:var(--tw-green);background:var(--tw-led-color);opacity:1;box-shadow:0 0 0 2px color-mix(in srgb,var(--tw-led-color) 18%,transparent);animation:none}
.tw-led.wait{--tw-led-color:var(--tw-accent);background:var(--tw-led-color);opacity:1;box-shadow:0 0 0 2px color-mix(in srgb,var(--tw-led-color) 18%,transparent);animation:none}
@media (prefers-reduced-motion:reduce){
  .tw-led,.tw-led.run,.tw-led.wait{animation:none;opacity:1}
}

/* Common shape + type settings override every theme */
.tw-page[data-radius="sharp"] .tw-card,
.tw-page[data-style="ios"][data-radius="sharp"] .tw-card,
.tw-page[data-style="qzone"][data-radius="sharp"] .tw-card,
.tw-page[data-style="hacker"][data-radius="sharp"] .tw-card,
.tw-page[data-radius="sharp"] .tw-card.is-running,
.tw-page[data-radius="sharp"] .tw-card.is-waiting,
.tw-page[data-radius="sharp"] .tw-shelf,
.tw-page[data-radius="sharp"] .tw-wspace{border-radius:0}
.tw-page[data-radius="soft"] .tw-card,
.tw-page[data-style="ios"][data-radius="soft"] .tw-card,
.tw-page[data-style="qzone"][data-radius="soft"] .tw-card,
.tw-page[data-style="hacker"][data-radius="soft"] .tw-card,
.tw-page[data-radius="soft"] .tw-card.is-running,
.tw-page[data-radius="soft"] .tw-card.is-waiting,
.tw-page[data-radius="soft"] .tw-shelf,
.tw-page[data-radius="soft"] .tw-wspace{border-radius:18px}
.tw-page[data-style="qzone"] .tw-card-title,.tw-page[data-style="hacker"] .tw-card-title{font-size:calc(var(--tw-font) * .9)}
.tw-page[data-style="qzone"] .tw-compose textarea,.tw-page[data-style="hacker"] .tw-compose textarea{font-size:calc(var(--tw-font) * .8)}

/* Approval-needed cards: theme-accent breathing shadow */
.tw-page{--tw-card-shadow:0 0 0 transparent}
.tw-page.tw-ios{--tw-card-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05)}
.tw-page[data-style="qzone"]{--tw-card-shadow:0 1px 2px rgba(18,58,102,.04),0 6px 18px rgba(47,128,237,.07)}
.tw-page[data-style="hacker"]{--tw-card-shadow:0 0 0 transparent}
@keyframes tw-approval-breathe{
  0%,100%{box-shadow:var(--tw-card-shadow,0 0 0 transparent),0 0 0 0 transparent}
  50%{box-shadow:var(--tw-card-shadow,0 0 0 transparent),0 0 0 3px color-mix(in srgb,var(--tw-accent) 20%,transparent),0 12px 30px color-mix(in srgb,var(--tw-accent) 20%,transparent)}
}
.tw-page .tw-card.is-waiting,
.tw-page.tw-ios .tw-card.is-waiting,
.tw-page[data-style="qzone"] .tw-card.is-waiting,
.tw-page[data-style="hacker"] .tw-card.is-waiting{animation:tw-approval-breathe 2.8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){
  .tw-card.is-waiting{animation:none!important}
}

.tw-new-chat{display:flex;align-items:center;gap:5px;height:32px;padding:0 11px;margin-right:2px;border:1px solid var(--tw-line);border-radius:100px;background:var(--tw-pane);color:var(--tw-ink);font-size:11px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;flex:none}
.tw-new-chat:hover{background:var(--tw-code);border-color:var(--tw-line)}
.tw-page.tw-ios .tw-new-chat{height:32px;border:0;background:var(--tw-accent);color:#fff;box-shadow:0 2px 8px color-mix(in srgb,var(--tw-accent) 22%,transparent)}
.tw-page.tw-ios .tw-new-chat:hover{background:color-mix(in srgb,var(--tw-accent) 86%,#000)}
.tw-page[data-style="qzone"] .tw-new-chat{border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.18);color:#fff}
.tw-page[data-style="qzone"] .tw-new-chat:hover{background:rgba(255,255,255,.28)}
.tw-page[data-style="hacker"] .tw-new-chat{border:1px solid var(--tw-accent);border-radius:0;background:transparent;color:var(--tw-accent)}
.tw-page[data-style="hacker"] .tw-new-chat:hover{background:rgba(57,255,20,.08)}

.tw-card-action-error{margin:3px 0 0;padding:4px 7px;border-radius:5px;background:rgba(180,35,24,.07);color:#B42318;font-size:10.5px;line-height:1.4}
.tw-shelf-head-toggle{cursor:pointer;user-select:none}
.tw-shelf-head-toggle:hover{background:color-mix(in srgb,var(--tw-pane) 88%,var(--tw-ink) 3%)}
.tw-shelf-caret{flex:none;color:var(--tw-muted);font-size:10px;line-height:1}
/* Card-level crash fallback */
.tw-card-error{border-top-color:#B42318!important;min-height:180px}
.tw-card-error .tw-card-title{color:#B42318}
.tw-card-error .tw-card-actions{display:flex;flex-wrap:wrap;gap:5px;padding:8px 0 2px}
.tw-card-error .tw-card-actions button{height:26px;padding:0 9px;border:1px solid var(--tw-line);border-radius:5px;background:var(--tw-pane);color:var(--tw-ink);font:inherit;font-size:11px;cursor:pointer}
.tw-card-error .tw-card-actions button:hover{background:var(--tw-code)}
/* Card action menu */
.tw-card[data-menu-open="true"]{overflow:visible;z-index:31}
.tw-card-menu{position:absolute;top:33px;right:28px;z-index:50;width:158px;padding:5px;border:1px solid var(--tw-line);border-radius:9px;background:var(--tw-pane);color:var(--tw-ink);box-shadow:0 14px 34px rgba(0,0,0,.18)}
.tw-card-menu button{display:block;width:100%;min-height:27px;padding:4px 8px;border:0;border-radius:5px;background:transparent;color:inherit;font:inherit;font-size:11.5px;text-align:left;cursor:pointer;white-space:nowrap}
.tw-card-menu button:hover{background:var(--tw-code)}
.tw-card-menu button.is-danger{color:#B42318}
.tw-card-menu button.is-danger:hover{background:rgba(180,35,24,.08)}
.tw-rename-input{flex:1;min-width:0;height:24px;padding:0 6px;border:1px solid var(--tw-accent);border-radius:5px;background:var(--tw-pane);color:var(--tw-ink);font:inherit;font-size:calc(var(--tw-font) * .84);line-height:22px;outline:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--tw-accent) 14%,transparent)}
.tw-page.tw-ios .tw-card-menu{border:0;border-radius:14px;background:rgba(255,255,255,.98);box-shadow:0 18px 48px rgba(0,0,0,.20);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
.tw-page.tw-ios .tw-card-menu button{border-radius:8px;font-size:13px;min-height:32px;padding:5px 9px}
.tw-page.tw-ios .tw-rename-input{height:28px;border-radius:8px;font-size:calc(var(--tw-font) * .84)}
.tw-page[data-style="qzone"] .tw-card-menu{border-color:#CBE4FA;border-radius:10px;background:#fff;color:#123A66}
.tw-page[data-style="qzone"] .tw-card-menu button:hover{background:#EAF4FF}
.tw-page[data-style="hacker"] .tw-card-menu{border-color:var(--tw-line);border-radius:0;background:#060C06;color:var(--tw-ink)}
.tw-page[data-style="hacker"] .tw-card-menu button{border-radius:0;font-family:inherit;font-size:11px}
.tw-page[data-style="hacker"] .tw-rename-input{border-radius:0;background:#030603;color:var(--tw-accent)}
/* Theme-specific typing indicators */
@keyframes tw-qzone-typing{
  0%,60%,100%{transform:translateY(0);opacity:.45}
  30%{transform:translateY(-2px);opacity:1}
}
@keyframes tw-hacker-typing{
  0%,100%{opacity:.35;transform:scaleY(.5)}
  50%{opacity:1;transform:scaleY(1)}
}
@keyframes tw-hacker-cursor{50%{opacity:0}}
.tw-page[data-style="qzone"] .tw-typing{
  position:relative;align-self:flex-start;width:max-content;max-width:100%;
  padding:7px 11px;border:1px solid #DCECFB;border-radius:16px;border-bottom-left-radius:4px;
  background:#fff;color:#2F80ED;font-family:inherit;font-size:11px;line-height:1.4;
  box-shadow:0 1px 2px rgba(47,128,237,.06);
}
.tw-page[data-style="qzone"] .tw-typing::after{
  content:"";position:absolute;left:-5px;bottom:7px;width:0;height:0;
  border-top:4px solid transparent;border-bottom:4px solid transparent;border-right:5px solid #fff;
}
.tw-page[data-style="qzone"] .tw-typing i{width:5px;height:5px;border-radius:50%;background:#2F80ED;animation:tw-qzone-typing 1.05s ease-in-out infinite}
.tw-page[data-style="qzone"] .tw-typing i:nth-child(2){animation-delay:.12s}
.tw-page[data-style="qzone"] .tw-typing i:nth-child(3){animation-delay:.24s}
.tw-page[data-style="qzone"] .tw-typing span{margin-left:3px;color:#6C8BA8;font-size:10px}
.tw-page[data-style="hacker"] .tw-typing{
  align-self:flex-start;padding:3px 0 3px 8px;border-left:2px solid var(--tw-accent);
  background:transparent;color:var(--tw-accent);font-family:inherit;font-size:10px;line-height:1.5;letter-spacing:.03em;
}
.tw-page[data-style="hacker"] .tw-typing::before{content:">";color:var(--tw-accent);margin-right:5px;font-weight:700}
.tw-page[data-style="hacker"] .tw-typing i{width:4px;height:9px;border-radius:0;background:var(--tw-accent);animation:tw-hacker-typing .9s steps(2,end) infinite}
.tw-page[data-style="hacker"] .tw-typing i:nth-child(2){animation-delay:.15s}
.tw-page[data-style="hacker"] .tw-typing i:nth-child(3){animation-delay:.3s}
.tw-page[data-style="hacker"] .tw-typing span{color:var(--tw-muted);margin-left:4px;font-size:9px;text-transform:lowercase}
.tw-page[data-style="hacker"] .tw-typing span::after{content:"_";color:var(--tw-accent);animation:tw-hacker-cursor 1s steps(2,end) infinite}
@media (prefers-reduced-motion:reduce){
  .tw-page[data-style="qzone"] .tw-typing i,
  .tw-page[data-style="hacker"] .tw-typing i,
  .tw-page[data-style="hacker"] .tw-typing span::after{animation:none!important}
}
/* Per-card current-model picker in the meta row */
.tw-model-picker{position:relative;display:inline-flex;align-items:center;min-width:0;max-width:46%;margin-left:auto;flex:none}
.tw-model-select{appearance:none;-webkit-appearance:none;max-width:100%;height:18px;padding:0 13px 0 5px;border:0;border-radius:100px;background:transparent;color:var(--tw-muted);font:inherit;font-size:9.5px;line-height:18px;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;outline:none}
.tw-model-select:hover{background:var(--tw-code);color:var(--tw-ink)}
.tw-model-select:disabled{opacity:.6;cursor:default}
.tw-model-select option,.tw-model-select optgroup{background:var(--tw-pane);color:var(--tw-ink)}
.tw-model-caret{position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:7px;line-height:1;color:var(--tw-muted);pointer-events:none}
.tw-page.tw-ios .tw-model-select{height:20px;font-size:10.5px;line-height:20px;color:var(--tw-muted)}
.tw-page.tw-ios .tw-model-select:hover{background:var(--tw-paper);color:var(--tw-ink)}
.tw-page[data-style="qzone"] .tw-model-select{color:#6C8BA8}
.tw-page[data-style="qzone"] .tw-model-select:hover{background:#EAF4FF;color:#2F80ED}
.tw-page[data-style="hacker"] .tw-model-select{color:var(--tw-muted);font-size:9px;border-radius:0}
.tw-page[data-style="hacker"] .tw-model-select:hover{background:#061006;color:var(--tw-accent)}
/* Shared settings layout: same metrics across themes, theme only changes color */
.tw-page .tw-settings .tw-settings-head{padding:18px 20px 12px;border-bottom:1px solid var(--tw-line);background:var(--tw-pane);flex:none}
.tw-page .tw-settings .tw-settings-head h2{font-size:20px;line-height:26px;font-weight:700;letter-spacing:-.02em}
.tw-page .tw-settings .tw-settings-head p{margin:3px 0 0;font-size:12px;line-height:17px;color:var(--tw-muted)}
.tw-page .tw-settings .tw-settings-close{width:28px;height:28px;border-radius:50%}
.tw-page .tw-settings .tw-settings-body{padding:0 16px 10px;overflow-y:auto;min-height:0;flex:1;background:var(--tw-paper)}
.tw-page .tw-settings .tw-settings-body .tw-config-section{box-sizing:border-box;padding:13px 14px;margin:0 0 10px;border-top:0;border-bottom:0}
.tw-page .tw-settings .tw-config-title{margin-bottom:10px;align-items:flex-start}
.tw-page .tw-settings .tw-config-title h3{font-size:12.5px;line-height:18px;font-weight:600}
.tw-page .tw-settings .tw-config-title p{font-size:11px;line-height:15px}
.tw-page .tw-settings .tw-config-sublabel{margin:10px 0 6px;font-size:10.5px;line-height:15px}
.tw-page .tw-settings .tw-style-grid{gap:8px}
.tw-page .tw-settings .tw-style{padding:5px;gap:5px;border-radius:10px}
.tw-page .tw-settings .tw-style-preview{height:26px;border-radius:7px}
.tw-page .tw-settings .tw-style-copy b{font-size:10.5px;line-height:15px}
.tw-page .tw-settings .tw-style-copy small{font-size:9px;line-height:13px}
.tw-page .tw-settings .tw-config-row{margin-top:10px;min-height:30px}
.tw-page .tw-settings .tw-config-row:first-of-type{margin-top:0}
.tw-page .tw-settings .tw-config-label{font-size:12.5px}
.tw-page .tw-settings .tw-config-slider{margin-top:12px}
.tw-page .tw-settings .tw-config-line{font-size:12.5px}
.tw-page .tw-settings .tw-config-hint{margin-top:5px;font-size:10.5px;line-height:15px}
.tw-page .tw-settings .tw-toggle-copy b{font-size:12.5px;line-height:18px}
.tw-page .tw-settings .tw-toggle-copy small{font-size:10.5px;line-height:15px}
.tw-page .tw-settings .tw-settings-foot{padding:10px 16px 16px;gap:8px;flex:none}
.tw-page .tw-settings .tw-settings-foot .tw-log-open,.tw-page .tw-settings .tw-settings-foot .tw-reset{height:30px;font-size:12px;padding:0 12px}
.tw-page .tw-settings .tw-save{height:44px;font-size:15px;font-weight:600;line-height:1.2;padding:0 14px}

/* iMessage-style interactions (iOS theme, live messages only) */
@keyframes imessage-in{
  0%{opacity:0;transform:translateY(10px) scale(.95)}
  55%{opacity:1;transform:translateY(-1px) scale(1.012)}
  100%{opacity:1;transform:translateY(0) scale(1)}
}
@keyframes imessage-typing{
  0%,60%,100%{transform:translateY(0);opacity:.45}
  30%{transform:translateY(-3px);opacity:1}
}
.tw-page.tw-ios .tw-msg.is-new{animation:imessage-in .34s cubic-bezier(.22,.9,.3,1.18) both;transform-origin:bottom center}
.tw-page.tw-ios .tw-msg.is-new.user{transform-origin:bottom right}
.tw-page.tw-ios .tw-msg.is-new.agent{transform-origin:bottom left}
.tw-page.tw-ios .tw-msg p{transition:transform .12s ease,opacity .12s ease}
.tw-page.tw-ios .tw-msg p:active{transform:scale(.97)}
.tw-page.tw-ios .tw-send:active{transform:scale(.9)}
.tw-page.tw-ios .tw-typing i{animation:imessage-typing 1.25s ease-in-out infinite}
.tw-page.tw-ios .tw-typing i:nth-child(2){animation-delay:.12s}
.tw-page.tw-ios .tw-typing i:nth-child(3){animation-delay:.24s}
@media (prefers-reduced-motion:reduce){
  .tw-page.tw-ios .tw-msg.is-new,.tw-page.tw-ios .tw-typing i{animation:none!important}
}

/* Theme backgrounds */
.tw-page.tw-ios{
  background-color:#F3F6FC;
  background-image:
    radial-gradient(1100px 620px at 6% -12%, rgba(0,122,255,.18), transparent 62%),
    radial-gradient(900px 560px at 102% -4%, rgba(255,149,0,.12), transparent 58%),
    radial-gradient(900px 700px at 48% 118%, rgba(88,86,214,.12), transparent 62%),
    radial-gradient(rgba(60,60,67,.045) 1px, transparent 1.2px),
    linear-gradient(180deg,#FAFBFE 0%,#F2F6FC 48%,#F6F7FB 100%);
  background-size:auto,auto,auto,24px 24px,auto;
}
.tw-page[data-style="qzone"]{
  background-color:#D8EEFF;
  background-image:
    radial-gradient(760px 300px at 10% 4%, rgba(255,255,255,.92), transparent 64%),
    radial-gradient(560px 240px at 86% 14%, rgba(255,255,255,.78), transparent 66%),
    radial-gradient(420px 190px at 58% 38%, rgba(255,255,255,.55), transparent 70%),
    radial-gradient(rgba(47,128,237,.10) 1px, transparent 1.2px),
    linear-gradient(180deg,#BFE4FF 0%,#DDF1FF 42%,#F3FAFF 100%);
  background-size:auto,auto,auto,28px 28px,auto;
}
.tw-page[data-style="hacker"]{
  background-color:#020502;
  background-image:
    radial-gradient(900px 520px at 50% -12%, rgba(57,255,20,.15), transparent 62%),
    linear-gradient(rgba(57,255,20,.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(57,255,20,.055) 1px, transparent 1px),
    linear-gradient(180deg,#020502 0%,#030803 60%,#010301 100%);
  background-size:auto,24px 24px,24px 24px,auto;
}

`;

    const Icon = ({ size = 16 }) => h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
      h("rect", { x: 3.5, y: 4.5, width: 7.5, height: 6.5, rx: 1.5 }),
      h("rect", { x: 13, y: 4.5, width: 7.5, height: 6.5, rx: 1.5 }),
      h("rect", { x: 3.5, y: 13, width: 7.5, height: 6.5, rx: 1.5 }),
      h("rect", { x: 13, y: 13, width: 7.5, height: 6.5, rx: 1.5 })
    );
    const PinIcon = ({ off = false }) => h("svg", { viewBox: "0 0 24 24", width: 12, height: 12, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
      h("path", { d: "M12 17v5" }), h("path", { d: "M9 4h6l-1 6 3 3H7l3-3z" }),
      off ? h("path", { d: "M4 4l16 16" }) : null
    );
    const OpenIcon = () => h("svg", { viewBox: "0 0 24 24", width: 12, height: 12, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
      h("path", { d: "M14 4h6v6" }), h("path", { d: "M20 4 11 13" }), h("path", { d: "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" })
    );
    const StopIcon = () => h("svg", { viewBox: "0 0 24 24", width: 11, height: 11, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", "aria-hidden": true },
      h("rect", { x: 6.5, y: 6.5, width: 11, height: 11, rx: 2 })
    );
    const SendIcon = () => h("svg", { viewBox: "0 0 24 24", width: 13, height: 13, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
      h("path", { d: "M12 19V5" }), h("path", { d: "m6 11 6-6 6 6" })
    );
    const SummaryIcon = ({ kind }) => {
      const common = { viewBox: "0 0 24 24", width: 10, height: 10, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
      if (kind === "pin") return h("svg", common, h("path", { d: "M9 4h6l-1 6 4 4H6l4-4-1-6z" }), h("path", { d: "M12 14v6" }));
      if (kind === "wait") return h("svg", common, h("circle", { cx: 12, cy: 12, r: 8 }), h("path", { d: "M12 8v4l3 2" }));
      if (kind === "archived") return h("svg", common, h("path", { d: "M4 7h16v3H4z" }), h("path", { d: "M6 10v8h12v-8" }), h("path", { d: "M10 14h4" }));
      return h("svg", common, h("path", { d: "M5 6h14v5H5z" }), h("path", { d: "M7 11v7h10v-7" }), h("path", { d: "M9 14h6" }));
    };
    const MoreIcon = () => h("svg", { viewBox: "0 0 24 24", width: 14, height: 14, fill: "currentColor", "aria-hidden": true },
      h("circle", { cx: 5, cy: 12, r: 1.5 }),
      h("circle", { cx: 12, cy: 12, r: 1.5 }),
      h("circle", { cx: 19, cy: 12, r: 1.5 })
    );
    const PlusIcon = () => h("svg", { viewBox: "0 0 24 24", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", "aria-hidden": true },
      h("path", { d: "M12 5v14M5 12h14" })
    );
    const ImageIcon = () => h("svg", { viewBox: "0 0 24 24", width: 17, height: 17, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
      h("rect", { x: 3.5, y: 4.5, width: 17, height: 15, rx: 4 }), h("circle", { cx: 8.5, cy: 9.5, r: 1.6 }), h("path", { d: "m5 17 4.5-4.5 3 3 2.5-2.5L19.5 17" })
    );
    const GearIcon = () => h("svg", { viewBox: "0 0 24 24", width: 15, height: 15, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
      h("circle", { cx: 12, cy: 12, r: 3 }),
      h("path", { d: "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.96 4.6 1.7 1.7 0 0 0 10 3.04V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.63.7 1.08 1.35 1.08H21v4h-.08A1.7 1.7 0 0 0 19.4 15z" })
    );

    function readPins() {
      try {
        const raw = localStorage.getItem(PIN_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string").slice(0, MAX_PINS) : [];
      } catch { return []; }
    }
    function readCollapsed() {
      try {
        const parsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : [];
      } catch { return []; }
    }
    function baseName(path) {
      if (!path) return "";
      const parts = String(path).split(/[\\/]+/).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : "";
    }
    function relativeTime(ts, t) {
      const diff = Math.max(0, Date.now() - (Number(ts) || 0));
      const minute = 60e3;
      if (diff < minute) return t("justNow");
      if (diff < 60 * minute) return t("minutesAgo").replace("{n}", String(Math.floor(diff / minute)));
      if (diff < 24 * 60 * minute) return t("hoursAgo").replace("{n}", String(Math.floor(diff / (60 * minute))));
      return t("daysAgo").replace("{n}", String(Math.floor(diff / (24 * 60 * minute))));
    }
    function textOf(content) {
      if (!Array.isArray(content)) return "";
      return content.filter((block) => block && typeof block === "object" && block.type === "text" && typeof block.text === "string")
        .map((block) => block.text).join("\n").trim();
    }
    function plainText(value) {
      let text = String(value || "");
      text = text.replace(/```[a-zA-Z0-9_-]*\n?/g, "").replace(/```/g, "");
      text = text.replace(/^#{1,6}\s+/gm, "");
      text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
      text = text.replace(/`([^`]+)`/g, "$1");
      text = text.replace(/^>\s?/gm, "");
      text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      text = text.replace(/\n{3,}/g, "\n\n");
      return text.trim();
    }
    function imagesOf(content) {
      if (!Array.isArray(content)) return [];
      return content.filter((block) => block && block.type === "image" && (typeof block.data === "string" || typeof block.url === "string")).map((block) => {
        const src = typeof block.url === "string" ? block.url : (block.data.startsWith("data:") ? block.data : `data:${block.mediaType || "image/png"};base64,${block.data}`);
        return { src, name: typeof block.name === "string" ? block.name : "" };
      });
    }
    function fileName(path) {
      const value = String(path || "");
      const at = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
      return at === -1 ? value : value.slice(at + 1);
    }
    function isImagePath(path) {
      return /\.(png|jpe?g|webp|gif)$/i.test(String(path || ""));
    }
    function artifactsOf(data) {
      if (!data || !Array.isArray(data.files)) return [];
      return data.files
        .filter((file) => file && typeof file.path === "string" && file.path.trim().length > 0)
        .map((file, index) => ({ index, path: file.path, description: typeof file.description === "string" ? file.description : "" }));
    }
    function readImageFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result || "");
          const comma = url.indexOf(",");
          if (!url.startsWith("data:image/") || comma < 0) { reject(new Error("unsupported image")); return; }
          const meta = url.slice(5, comma);
          const mediaType = meta.split(";")[0] || "image/png";
          resolve({
            id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2),
            name: file.name || "image",
            mediaType,
            data: url.slice(comma + 1),
            previewUrl: url,
          });
        };
        reader.onerror = () => reject(reader.error || new Error("read failed"));
        reader.readAsDataURL(file);
      });
    }
    function toolPreview(text) {
      const line = String(text || "").split("\n").map((item) => item.trim()).find(Boolean) || "工具结果";
      return line.length > 92 ? line.slice(0, 92) + "…" : line;
    }
    function groupMessages(messages) {
      const blocks = [];
      for (const message of messages) {
        if (message.role === "tool") {
          const last = blocks[blocks.length - 1];
          if (last && last.role === "tool-group") { last.items.push(message); last.lastSeq = message.seq; }
          else blocks.push({ role: "tool-group", key: message.key, items: [message], lastSeq: message.seq });
        } else blocks.push(message);
      }
      return blocks;
    }
    function messagesOf(entries) {
      const out = [];
      for (const entry of entries || []) {
        if (!entry || entry.type !== "event" || !entry.event) continue;
        const ev = entry.event;
        if (ev.type === "user/message") {
          const message = ev.data || {};
          if (message.source && message.source.kind !== "user") continue;
          const text = textOf(message.content);
          const images = imagesOf(message.content);
          if (!text && !images.length) continue;
          out.push({ role: "user", key: "e" + ev.seq, text: plainText(text), images, seq: ev.seq, time: ev.time });
        } else if (ev.type === "assistant/message") {
          const message = (ev.data && ev.data.message) || {};
          const text = textOf(message.content) || (typeof message.text === "string" ? message.text : "");
          const images = imagesOf(message.content);
          if (!text && !images.length) continue;
          out.push({ role: "agent", key: "e" + ev.seq, text: plainText(text), images, seq: ev.seq, time: ev.time });
        } else if (ev.type === "deliverables/presented") {
          const files = artifactsOf(ev.data);
          if (files.length) out.push({ role: "artifact", key: "e" + ev.seq, files, seq: ev.seq, time: ev.time });
        } else if (ev.type === "tool/result") {
          const message = (ev.data && ev.data.message) || ev.data || {};
          const text = textOf(message.content) || (typeof message.text === "string" ? message.text : "") || (typeof ev.data.output === "string" ? ev.data.output : "");
          if (!text) continue;
          out.push({ role: "tool", key: "e" + ev.seq, text, seq: ev.seq, time: ev.time });
        }
      }
      return out;
    }

    function useInView(ref, margin) {
      const [inView, setInView] = useState(false);
      useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === "undefined") return;
        const pad = margin == null ? 320 : margin;
        const observer = new IntersectionObserver((entries) => {
          for (const entry of entries) setInView(entry.isIntersecting);
        }, { rootMargin: pad + "px 0px " + pad + "px 0px" });
        observer.observe(el);
        return () => observer.disconnect();
      }, [margin]);
      return inView;
    }

    function useDocumentVisible() {
      const [visible, setVisible] = useState(() => (typeof document === "undefined" ? true : !document.hidden));
      useEffect(() => {
        const update = () => setVisible(!document.hidden);
        document.addEventListener("visibilitychange", update);
        return () => document.removeEventListener("visibilitychange", update);
      }, []);
      return visible;
    }

    /** Retain the session only while the card is near the viewport. */
    function useRetained(sessions, id, enabled) {
      const [state, setState] = useState({ status: enabled === false ? "idle" : "loading", binding: null, error: null });
      useEffect(() => {
        if (enabled === false) {
          setState({ status: "idle", binding: null, error: null });
          return () => {};
        }
        let alive = true;
        let ref;
        try {
          ref = sessions.retain(id, { source: "topic-wall" });
        } catch (error) {
          setState({ status: "error", binding: null, error });
          return () => {};
        }
        if (!ref || !ref.ready || typeof ref.ready.then !== "function") {
          setState({ status: "error", binding: null, error: new Error("retain returned no ready promise") });
          return () => {};
        }
        ref.ready.then((binding) => {
          if (alive) setState({ status: "ready", binding, error: null });
        }, (error) => {
          if (alive) setState({ status: "error", binding: null, error });
        }).catch((error) => {
          if (alive) setState({ status: "error", binding: null, error });
        });
        return () => {
          alive = false;
          try { ref.release(); } catch {}
        };
      }, [sessions, id, enabled]);
      return state;
    }

    function approvalText(value) {
      if (value == null) return "";
      if (typeof value === "string") return value;
      if (typeof value === "object") return value.text || value.en || value.zh || value.fallback || value.reason || "";
      return String(value);
    }

    function LongText({ text, t, className }) {
      const value = String(text == null ? "" : text);
      const [expanded, setExpanded] = useState(false);
      const scrollRef = useRef(null);
      const timerRef = useRef(null);
      const long = value.length > 90;
      const stop = () => {
        if (timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
      const start = () => {
        if (expanded || !long) return;
        const el = scrollRef.current;
        if (!el) return;
        stop();
        el.scrollLeft = 0;
        timerRef.current = setInterval(() => {
          if (!el || el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) { stop(); return; }
          el.scrollLeft += 1;
        }, 16);
      };
      useEffect(() => stop, []);
      if (!long) return h("div", { className }, value);
      return h("button", {
        type: "button",
        className: className + " tw-long",
        "data-expanded": expanded,
        "aria-expanded": expanded,
        title: expanded ? t("collapseText") : t("expandText"),
        onClick: () => { stop(); setExpanded((open) => !open); },
        onMouseEnter: start,
        onMouseLeave: stop,
      }, h("span", { className: "tw-long-scroll", ref: scrollRef }, value));
    }

    function ApprovalDock({ pending, t, onOpen }) {
      const [busy, setBusy] = useState(false);
      const [failed, setFailed] = useState(false);
      const answer = async (outcome) => {
        if (busy || !pending || pending.answerable === false) return;
        setBusy(true); setFailed(false);
        try { await pending.answer(outcome); }
        catch (error) {
          setBusy(false); setFailed(true);
          logStore.add({ level: "error", source: "approval", message: error && error.message || t("approvalFailed"), stack: error && error.stack });
        }
      };
      const name = pending && pending.toolName;
      const reason = approvalText(pending && (pending.displayReason || pending.reason));
      const toolText = name ? t("approvalTool").replace("{name}", name) : t("approvalWaiting");
      return h("div", { className: "tw-approval", "data-approval": "true" },
        h("div", { className: "tw-approval-head" },
          h("span", { className: "tw-approval-dot", "aria-hidden": true }),
          h("span", null, t("approvalWaiting")),
          name ? h("span", { className: "tw-approval-tool" }, name) : null
        ),
        h(LongText, { className: "tw-approval-reason", text: reason || toolText, t }),
        h("div", { className: "tw-approval-actions" },
          h("button", { className: "tw-approval-action reject", type: "button", disabled: busy || pending.answerable === false, onClick: () => { void answer("rejected"); } }, t("reject")),
          h("button", { className: "tw-approval-action allow", type: "button", disabled: busy || pending.answerable === false, onClick: () => { void answer("allowed-once"); } }, busy ? t("approvalAnswering") : t("allowOnce")),
          h("button", { className: "tw-approval-action open", type: "button", disabled: busy, onClick: onOpen }, t("approvalOpen"))
        ),
        failed ? h("div", { className: "tw-approval-error" }, t("approvalFailed")) : null
      );
    }

    function QuestionDock({ pending, t, onOpen }) {
      const [busy, setBusy] = useState(false);
      const [failed, setFailed] = useState(false);
      const questions = Array.isArray(pending.questions) ? pending.questions : [];
      const question = questions[0];
      const options = question && Array.isArray(question.options) ? question.options.slice(0, 3) : [];
      const simple = questions.length === 1 && options.length > 0 && question.multiSelect !== true;
      if (!simple) return h("div", { className: "tw-approval", "data-approval": "generic" },
        h("div", { className: "tw-approval-head" }, h("span", { className: "tw-approval-dot", "aria-hidden": true }), h("span", null, t("pendingQuestion"))),
        h(LongText, { className: "tw-approval-reason", text: question && (question.question || question.header || question.detail) || t("pendingQuestionHint"), t }),
        h("div", { className: "tw-approval-actions" }, h("button", { className: "tw-approval-action open", type: "button", onClick: onOpen }, t("approvalOpen")))
      );
      const submit = async (label) => {
        if (busy) return;
        setBusy(true); setFailed(false);
        try {
          await pending.answer({ answers: questions.map((item) => ({ id: item.id, selected: item.id === question.id ? [label] : [] })) });
        } catch (error) {
          setBusy(false); setFailed(true);
          logStore.add({ level: "error", source: "question", message: error && error.message || t("answerFailed"), stack: error && error.stack });
        }
      };
      const title = question.question || question.header || question.detail || t("pendingQuestion");
      return h("div", { className: "tw-approval", "data-approval": "question" },
        h("div", { className: "tw-approval-head" },
          h("span", { className: "tw-approval-dot", "aria-hidden": true }),
          h("span", null, t("answerQuestion")),
          h("span", { className: "tw-approval-tool" }, pending.kind === "plan-review" ? "plan review" : "question")
        ),
        h(LongText, { className: "tw-approval-reason", text: title, t }),
        h("div", { className: "tw-approval-actions question" },
          options.map((option) => h("button", { key: option.label, className: "tw-approval-action", type: "button", disabled: busy, onClick: () => { void submit(option.label); } }, busy ? t("answerSubmitting") : option.label)),
          h("button", { className: "tw-approval-action open", type: "button", onClick: onOpen, disabled: busy }, t("approvalOpen"))
        ),
        failed ? h("div", { className: "tw-approval-error" }, t("answerFailed")) : null
      );
    }

    function PendingDock({ pending, t, onOpen }) {
      if (!pending) return null;
      if (pending.kind === "approval") return h(ApprovalDock, { pending, t, onOpen });
      if (pending.kind === "question" || pending.kind === "plan-review") return h(QuestionDock, { pending, t, onOpen });
      return h("div", { className: "tw-approval", "data-approval": "generic" },
        h("div", { className: "tw-approval-head" }, h("span", { className: "tw-approval-dot", "aria-hidden": true }), h("span", null, t("pendingQuestion"))),
        h("div", { className: "tw-approval-reason" }, t("pendingQuestionHint")),
        h("div", { className: "tw-approval-actions" },
          h("button", { className: "tw-approval-action open", type: "button", onClick: onOpen }, t("approvalOpen"))
        )
      );
    }

    function ToolGroup({ message, t, onToggle }) {
      const [open, setOpen] = useState(false);
      const last = message.items[message.items.length - 1];
      return h("details", {
        className: "tw-tool-group",
        onClick: (event) => event.stopPropagation(),
        onToggle: (event) => {
          setOpen(event.currentTarget.open);
          if (onToggle) onToggle();
        },
      },
        h("summary", null,
          h("span", { className: "tw-tool-group-count" }, "× " + message.items.length),
          h("span", { className: "tw-tool-preview" }, toolPreview(last.text))
        ),
        open ? h("div", { className: "tw-tool-group-body" }, message.items.map((item, itemIndex) => h("div", { className: "tw-tool-item", key: itemIndex },
          h("span", { className: "tw-tool-n" }, String(itemIndex + 1).padStart(2, "0")),
          h("pre", null, item.text)
        ))) : null
      );
    }

    function CardConversation({ binding, status, t, layoutKey, tools, pending, onOpen }) {
      const [draft, setDraft] = useState(() => draftCache.get(binding.sessionId) || readDraft(binding.sessionId) || "");
      const textareaRef = useRef(null);
      const updateDraft = (value) => {
        draftCache.set(binding.sessionId, value);
        saveDraft(binding.sessionId, value);
        setDraft(value);
      };
      useEffect(() => { draftCache.set(binding.sessionId, draft); saveDraft(binding.sessionId, draft); }, [binding.sessionId, draft]);
      const [images, setImages] = useState([]);
      const [attachError, setAttachError] = useState(null);
      const [sending, setSending] = useState(false);
      const [sendError, setSendError] = useState(null);
      const imageInputRef = useRef(null);
      const [atBottom, setAtBottom] = useState(true);
      const logRef = useRef(null);
      const followRef = useRef(true);
      const lastScrollTop = useRef(0);
      const touchStartY = useRef(0);
      const eventSnap = useSyncExternalStore(
        (cb) => binding.eventSource.subscribe(cb),
        () => binding.eventSource.getSnapshot(),
        () => binding.eventSource.getSnapshot()
      );
      const sessionSnap = useSyncExternalStore(
        (cb) => binding.session.subscribe(cb),
        () => binding.session.getSnapshot(),
        () => binding.session.getSnapshot()
      );
      const inboxFace = binding.session.projections.faceOf("inbox");
      const inbox = useSyncExternalStore(
        (cb) => inboxFace.subscribe(cb),
        () => inboxFace.getSnapshot(),
        () => inboxFace.getSnapshot()
      );
      const queueRows = (inbox && inbox["next-turn"]) || [];
      const pendingSubmissions = sessionSnap.pendingSubmissions || [];
      const admittedRpcIds = new Set(queueRows.map((row) => row.source && row.source.kind === "user" && "rpcId" in row.source ? row.source.rpcId : null).filter(Boolean));
      const sendingQueue = pendingSubmissions.filter((item) => item.placement === "queued" && !admittedRpcIds.has(item.requestId));
      const queueCount = queueRows.length + sendingQueue.length;
      const [queueOpen, setQueueOpen] = useState(false);
      const [editingQueueId, setEditingQueueId] = useState(null);
      const [queueDraft, setQueueDraft] = useState("");
      const [queueError, setQueueError] = useState(null);
      useEffect(() => {
        if (queueCount === 0) { setQueueOpen(false); setEditingQueueId(null); }
      }, [queueCount]);
      const messages = useMemo(() => {
        let all = messagesOf(eventSnap.entries);
        if (tools === "hidden") all = all.filter((message) => message.role !== "tool");
        return all;
      }, [eventSnap, tools]);
      const blocks = useMemo(() => groupMessages(messages), [messages]);
      const maxSeqRef = useRef(0);
      const messagesReadyRef = useRef(false);
      const animatedKeys = useMemo(() => {
        let max = maxSeqRef.current;
        const incoming = new Set();
        for (const block of blocks) {
          const seq = block.lastSeq != null ? block.lastSeq : (block.seq || 0);
          if (!messagesReadyRef.current) { if (seq > max) max = seq; continue; }
          if (seq > max) { if (block.key) incoming.add(block.key); max = seq; }
        }
        if (blocks.length > 0) { messagesReadyRef.current = true; maxSeqRef.current = max; }
        return incoming;
      }, [blocks]);
      const running = !!(status && status.running) || !!sessionSnap.running;
      const hasMore = !!eventSnap.hasMore;
      const loadingOlder = !!sessionSnap.loadingOlder;
      const loadOlder = async () => {
        if (!hasMore || loadingOlder) return;
        try { await binding.session.loadOlder(); } catch (error) { logStore.add({ level: "error", source: "history", message: error && error.message || "loadOlder failed", stack: error && error.stack }); }
      };
      const autoLoading = useRef(false);
      useEffect(() => {
        if (!hasMore || autoLoading.current) return;
        autoLoading.current = true;
        let cancelled = false;
        olderQueue.enqueue(async () => {
          try {
            let pages = 0;
            while (!cancelled) {
              if (++pages > 200) break;
              const snapshot = binding.eventSource.getSnapshot();
              if (!snapshot.hasMore) break;
              let oldest = Infinity;
              for (const entry of snapshot.entries || []) {
                const time = entry && entry.type === "event" && entry.event ? entry.event.time : NaN;
                if (Number.isFinite(time) && time < oldest) oldest = time;
              }
              if (oldest !== Infinity && oldest < Date.now() - RECENT_HISTORY_MS) break;
              if (binding.session.getSnapshot().loadingOlder) {
                await new Promise((resolve) => setTimeout(resolve, 120));
                continue;
              }
              await binding.session.loadOlder();
              await new Promise((resolve) => setTimeout(resolve, 40));
            }
          } catch (error) {
            logStore.add({ level: "error", source: "history", message: error && error.message || "auto loadOlder failed", stack: error && error.stack });
          } finally {
            if (!cancelled) autoLoading.current = false;
          }
        });
        return () => { cancelled = true; };
      }, [hasMore, binding]);

      useEffect(() => {
        const el = logRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
          lastScrollTop.current = el.scrollTop;
          followRef.current = true;
          setAtBottom(true);
        }
      }, [layoutKey]);
      const lastMessageCount = useRef(0);
      useEffect(() => {
        const el = logRef.current;
        if (!el) return;
        const grew = messages.length > lastMessageCount.current;
        // Follow only while the reader is truly at the bottom. followRef is updated
        // on scroll, so a light wheel/touch nudge is never pulled back.
        if ((grew && lastMessageCount.current === 0) || followRef.current) {
          el.scrollTop = el.scrollHeight;
          lastScrollTop.current = el.scrollTop;
        }
        lastMessageCount.current = messages.length;
        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
      }, [messages.length]);

      const addImages = async (files) => {
        const list = Array.from(files || []);
        if (list.length === 0) return;
        setAttachError(null);
        if (images.length + list.length > 6) { setAttachError(t("imageLimit")); return; }
        try {
          const next = [];
          for (const file of list) {
            if (!file.type || !file.type.startsWith("image/")) { setAttachError(t("imageUnsupported")); continue; }
            if (file.size > 10 * 1024 * 1024) { setAttachError(t("imageTooLarge")); continue; }
            next.push(await readImageFile(file));
          }
          if (next.length) setImages((current) => [...current, ...next]);
        } catch (error) {
          setAttachError(t("imageUnsupported"));
          logStore.add({ level: "error", source: "attachment", message: error && error.message || "read image failed", stack: error && error.stack });
        }
      };
      useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 96) + "px";
        el.style.overflowY = el.scrollHeight > 96 ? "auto" : "hidden";
      }, [draft]);

      const send = async () => {
        const text = draft.trim();
        if ((!text && images.length === 0) || sending) return;
        setSendError(null);
        setAttachError(null);
        setSending(true);
        let submission;
        try {
          const pendingAttachments = images.map((image) => ({ type: "image", value: { previewUrl: image.previewUrl, name: image.name } }));
          submission = binding.session.beginSubmission({ mode: "queue", text, attachments: pendingAttachments });
          updateDraft("");
          const content = [
            ...images.map((image) => ({ type: "image", mediaType: image.mediaType, data: image.data, name: image.name })),
            ...(text ? [{ type: "text", text }] : []),
          ];
          const result = await binding.session.prompt(content, "queue", undefined, submission.requestId);
          const log = logRef.current;
          if (log) setTimeout(() => { log.scrollTop = log.scrollHeight; }, 80);
          if (!result.ok) {
            submission.abandon();
            updateDraft(text);
            const reason = result.error && result.error.message ? result.error.message : t("sendError");
            setSendError(reason);
            logStore.add({ level: "error", source: "prompt", message: reason, context: { code: result.error && result.error.code, hasImages: images.length > 0 } });
          } else {
            setImages([]);
          }
        } catch (error) {
          if (submission) submission.abandon();
          updateDraft(text);
          setSendError(error && error.message ? error.message : t("sendError"));
          logStore.add({ level: "error", source: "prompt", message: error && error.message || t("sendError"), stack: error && error.stack });
        } finally {
          setSending(false);
        }
      };

      useEffect(() => {
        const el = logRef.current;
        if (el && followRef.current) el.scrollTop = el.scrollHeight;
      }, [queueCount]);

      const removeQueued = async (itemId) => {
        try { await binding.session.updateQueue(itemId, { kind: "remove" }); }
        catch (error) { logStore.add({ level: "error", source: "queue", message: error && error.message || "remove queued failed", stack: error && error.stack }); }
      };
      const queueEditable = (row) => Array.isArray(row.content) ? row.content.every((block) => block && block.type === "text") : !row.content;
      const startQueueEdit = (row) => { setEditingQueueId(row.id); setQueueDraft(textOf(row.content) || ""); };
      const saveQueueEdit = async (itemId) => {
        const next = queueDraft.trim();
        if (!next) return;
        setQueueError(null);
        try {
          await binding.session.updateQueue(itemId, { kind: "edit", content: [{ type: "text", text: next }] });
          setEditingQueueId(null);
          setQueueDraft("");
        } catch (error) {
          setQueueError(error && error.message || t("actionFailed"));
          logStore.add({ level: "error", source: "queue", message: error && error.message || "edit queued failed", stack: error && error.stack });
        }
      };
      const steerQueued = async (itemId) => {
        try { await binding.session.updateQueue(itemId, { kind: "steer" }); }
        catch (error) { logStore.add({ level: "error", source: "queue", message: error && error.message || "steer queued failed", stack: error && error.stack }); }
      };
      const steerAllQueued = async () => {
        for (const row of queueRows) {
          try { await binding.session.updateQueue(row.id, { kind: "steer" }); } catch {}
        }
      };
      const openArtifact = async (message, file) => {
        try {
          const sessionId = binding.session.sessionId;
          const url = "/api/present.open?" + new URLSearchParams({ sessionId, seq: String(message.seq), index: String(file.index) });
          const response = await fetch(url, { method: "POST" });
          if (!response.ok) throw new Error(`present.open returned ${response.status}`);
        } catch (error) {
          setAttachError(t("artifactOpenError"));
          logStore.add({ level: "error", source: "artifact", message: error && error.message || t("artifactOpenError"), stack: error && error.stack });
        }
      };
      return h(React.Fragment, null,
        h("div", { className: "tw-log-wrap" },
          h("div", {
            className: "tw-log", ref: logRef,
            onScroll: (event) => {
              const el = event.currentTarget;
              const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
              if (el.scrollTop < lastScrollTop.current - 0.5) followRef.current = false;
              if (remaining < 0.5) followRef.current = true;
              lastScrollTop.current = el.scrollTop;
              setAtBottom(remaining < 24);
              if (el.scrollTop < 6 && hasMore && !loadingOlder) void loadOlder();
            },
            onWheel: (event) => { if (event.deltaY < 0) followRef.current = false; },
            onTouchStart: (event) => { touchStartY.current = event.touches[0] ? event.touches[0].clientY : 0; },
            onTouchMove: (event) => { const y = event.touches[0] ? event.touches[0].clientY : 0; if (y > touchStartY.current + 2) followRef.current = false; },
          },
            hasMore ? h("button", { className: "tw-load-older", type: "button", disabled: loadingOlder, onClick: () => { void loadOlder(); } }, loadingOlder ? t("loadingOlder") : t("loadOlder")) : null,
            messages.length === 0 ? h("div", { className: "tw-log-empty" }, t("noHistory")) : null,
            blocks.map((message, index) => {
              if (message.role === "artifact") {
                return h("div", { className: "tw-msg artifact" + (animatedKeys.has(message.key) ? " is-new" : ""), key: message.key || index },
                  h("span", { className: "role" }, t("artifact")),
                  h("div", { className: "tw-artifacts" }, message.files.map((file) => {
                    const canPreview = file.path.startsWith("/") && isImagePath(file.path);
                    return h("button", { className: "tw-artifact", type: "button", key: file.index, title: file.path, onClick: () => { void openArtifact(message, file); } },
                      canPreview ? h("img", { src: "/api/file?path=" + encodeURIComponent(file.path), alt: file.description || fileName(file.path), loading: "lazy", onError: (event) => { event.currentTarget.style.display = "none"; } }) : h("span", { className: "tw-artifact-icon" }, "▤"),
                      h("span", { className: "tw-artifact-copy" }, h("b", null, fileName(file.path)), h("small", null, file.description || file.path))
                    );
                  }))
                );
              }
              if (message.role === "tool-group") {
                return h("div", { className: "tw-msg tool" + (animatedKeys.has(message.key) ? " is-new" : ""), key: message.key || index },
                  h("span", { className: "role" }, t("toolGroup")),
                  h(ToolGroup, {
                    message,
                    t,
                    onToggle: () => { const el = logRef.current; if (el && followRef.current) { el.scrollTop = el.scrollHeight; lastScrollTop.current = el.scrollTop; } },
                  })
                );
              }
              const roleLabel = message.role === "user" ? "你" : "agent";
              return h("div", { className: "tw-msg " + message.role + (animatedKeys.has(message.key) ? " is-new" : ""), key: message.key || index },
                h("span", { className: "role" }, roleLabel),
                message.images && message.images.length ? h("div", { className: "tw-msg-images" }, message.images.map((image, imageIndex) => h("img", { key: imageIndex, src: image.src, alt: image.name || "image", loading: "lazy" }))) : null,
                message.text ? h("p", null, message.text) : null
              );
            }),
            running ? h("div", { className: "tw-typing" }, h("i"), h("i"), h("i"), h("span", null, t("typing"))) : null
          ),
          !atBottom ? h("button", {
            className: "tw-jump-bottom", type: "button", title: t("jumpLatest"), "aria-label": t("jumpLatest"),
            onClick: () => {
              const el = logRef.current;
              if (el) { el.scrollTop = el.scrollHeight; lastScrollTop.current = el.scrollTop; followRef.current = true; setAtBottom(true); }
            },
          }, h("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
            h("path", { d: "M3.5 6L8 10.5L12.5 6", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" })
          )) : null
        ),
        queueCount > 0 ? h("div", { className: "tw-queue" },
          queueCount > 1 ? h("div", { className: "tw-queue-head" },
            h("button", {
              className: "tw-queue-toggle", type: "button", "aria-expanded": queueOpen,
              title: queueOpen ? t("queueCollapse") : t("queueExpand"),
              onClick: () => setQueueOpen((open) => !open),
            },
              h("span", { className: "tw-queue-caret" }, queueOpen ? "▾" : "▸"),
              h("span", null, t("queueCount").replace("{n}", String(queueCount)))
            ),
            queueRows.length > 1 ? h("button", { type: "button", onClick: () => { void steerAllQueued(); } }, t("steerAll")) : null
          ) : null,
          queueCount === 1 || queueOpen ? h("div", { className: "tw-queue-list" },
            queueRows.map((row) => {
              const text = textOf(row.content) || "[附件]";
              const editable = queueEditable(row);
              const editing = editingQueueId === row.id;
              if (editing) {
                return h("div", { className: "tw-queue-item is-editing", key: row.id },
                  h("input", {
                    className: "tw-queue-edit", value: queueDraft, autoFocus: true, "aria-label": t("queueEdit"),
                    onChange: (event) => setQueueDraft(event.currentTarget.value),
                    onKeyDown: (event) => {
                      if (event.key === "Enter") { event.preventDefault(); void saveQueueEdit(row.id); }
                      if (event.key === "Escape") { event.preventDefault(); setEditingQueueId(null); }
                    },
                  }),
                  h("button", { type: "button", title: t("queueSave"), "aria-label": t("queueSave"), onClick: () => { void saveQueueEdit(row.id); } }, "✓"),
                  h("button", { type: "button", title: t("queueCancel"), "aria-label": t("queueCancel"), onClick: () => setEditingQueueId(null) }, "×")
                );
              }
              return h("div", { className: "tw-queue-item", key: row.id },
                h("span", { className: "tw-queue-text", title: text }, text),
                editable
                  ? h("button", { type: "button", title: t("queueEdit"), "aria-label": t("queueEdit"), onClick: () => startQueueEdit(row) }, "✎")
                  : h("span", { className: "tw-queue-noedit", title: t("queueEditOnlyText"), "aria-label": t("queueEditOnlyText") }, "⊘"),
                h("button", { type: "button", title: t("steer"), "aria-label": t("steer"), onClick: () => { void steerQueued(row.id); } }, "↗"),
                h("button", { type: "button", title: t("remove"), "aria-label": t("remove"), onClick: () => { void removeQueued(row.id); } }, "×")
              );
            }),
            sendingQueue.map((item) => h("div", { className: "tw-queue-item", key: item.requestId },
              h("span", { className: "tw-queue-text", title: item.text }, item.text || "[附件]"),
              h("span", { className: "tw-queue-sending" }, t("sending"))
            )),
            queueError ? h("div", { className: "tw-error" }, queueError) : null
          ) : null
        ) : null,
        h(PendingDock, { pending, t, onOpen }),
        sendError ? h("div", { className: "tw-error" }, sendError) : null,
        attachError ? h("div", { className: "tw-error" }, attachError) : null,
        images.length > 0 ? h("div", { className: "tw-attach-strip" }, images.map((image) => h("div", { className: "tw-attach-item", key: image.id },
          h("img", { src: image.previewUrl, alt: image.name }),
          h("button", { type: "button", title: t("removeImage"), "aria-label": t("removeImage"), onClick: () => setImages((current) => current.filter((item) => item.id !== image.id)) }, "×")
        ))) : null,
        h("form", { className: "tw-compose", onSubmit: (event) => { event.preventDefault(); void send(); },
          onDragOver: (event) => event.preventDefault(),
          onDrop: (event) => { event.preventDefault(); void addImages(event.dataTransfer.files); },
        },
          h("input", { ref: imageInputRef, className: "tw-file-input", type: "file", accept: "image/*", multiple: true, onChange: (event) => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; void addImages(files); } }),
          h("div", { className: "tw-compose-field" },
            h("button", { className: "tw-attach", type: "button", title: t("attachImage"), "aria-label": t("attachImage"), onClick: () => imageInputRef.current && imageInputRef.current.click() }, h(ImageIcon)),
            h("textarea", {
              ref: textareaRef, rows: 1, value: draft, placeholder: running ? t("queuePlaceholder") : t("reply"), "aria-label": running ? t("queuePlaceholder") : t("reply"),
              onChange: (event) => updateDraft(event.currentTarget.value),
              onKeyDown: (event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                if (event.nativeEvent && event.nativeEvent.isComposing) return;
                event.preventDefault();
                if (!sending) void send();
              },
              onPaste: (event) => { const files = Array.from(event.clipboardData && event.clipboardData.files || []).filter((file) => file.type && file.type.startsWith("image/")); if (files.length) { event.preventDefault(); void addImages(files); } },
            }),
            h("button", { className: "tw-send", type: "submit", title: t("send"), "aria-label": t("send"), disabled: sending || (draft.trim() === "" && images.length === 0) }, h(SendIcon))
          )
        )
      );
    }

    class CardBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) { return { error }; }
      componentDidCatch(error, info) {
        logStore.add({
          level: "error", source: "card", message: (error && error.message) || String(error || "card render error"),
          stack: (error && error.stack) || "", context: { sessionId: this.props.sessionId, componentStack: (info && info.componentStack) || "" },
        });
      }
      render() {
        if (!this.state.error) return this.props.children;
        const { t, sessionId, onOpen, onArchive } = this.props;
        return h("article", { className: "tw-card tw-card-error" },
          h("div", { className: "tw-card-body" },
            h("div", { className: "tw-card-top" },
              h("span", { className: "tw-led wait" }),
              h("h3", { className: "tw-card-title" }, t("cardCrashed"))
            ),
            h("div", { className: "tw-log" }, h("div", { className: "tw-log-empty" }, sessionId)),
            h("div", { className: "tw-card-actions" },
              h("button", { type: "button", onClick: () => this.setState({ error: null }) }, t("retry")),
              h("button", { type: "button", onClick: onOpen }, t("open")),
              onArchive ? h("button", { type: "button", onClick: onArchive }, t("archive")) : null
            )
          )
        );
      }
    }

    function Card({ row, status, pinned, layout, radius, entering, pinFull, t, sessions, openSession, onPin, onPinId, layoutKey, bubbleAlign, tools, models, forkSession, archiveSession, unarchiveSession, archived }) {
      const cardRef = useRef(null);
      const menuRef = useRef(null);
      const renameRef = useRef(null);
      const [menuOpen, setMenuOpen] = useState(false);
      const [renaming, setRenaming] = useState(false);
      const [renameValue, setRenameValue] = useState("");
      const [acting, setActing] = useState(false);
      const [actionError, setActionError] = useState("");
      const inView = useInView(cardRef, 600);
      const retained = useRetained(sessions, row.id, inView);
      const focusTimer = useRef(null);
      const pointerStart = useRef(null);
      const cancelFocus = () => {
        if (focusTimer.current !== null) {
          clearTimeout(focusTimer.current);
          focusTimer.current = null;
        }
      };
      useEffect(() => {
        const onPointerDown = () => cancelFocus();
        const onScroll = () => cancelFocus();
        const onWheel = () => cancelFocus();
        const onTouchMove = () => cancelFocus();
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("scroll", onScroll, true);
        window.addEventListener("wheel", onWheel, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: true });
        return () => {
          cancelFocus();
          document.removeEventListener("pointerdown", onPointerDown, true);
          document.removeEventListener("scroll", onScroll, true);
          window.removeEventListener("wheel", onWheel);
          window.removeEventListener("touchmove", onTouchMove);
        };
      }, []);
      const scheduleFocus = () => {
        cancelFocus();
        focusTimer.current = setTimeout(() => {
          focusTimer.current = null;
          const input = cardRef.current && cardRef.current.querySelector(".tw-compose textarea");
          if (input && !input.disabled) input.focus({ preventScroll: true });
        }, 2000);
      };
      const running = !!(status && status.running) || !!row.running;
      const waiting = !!(status && status.pendingInteraction);
      const title = row.title || row.displayTitle || t("unnamed");
      const workspace = baseName(row.cwd) || t("workspace");
      const stateLabel = waiting ? t("waiting") : running ? t("running") : t("idle");
      const stateClass = waiting ? "wait" : running ? "run" : "";
      const statusClass = waiting ? " is-waiting" : running ? " is-running" : "";
      const ledClass = waiting ? "wait" : running ? "run" : "";
      const variant = layout || (pinned ? "pin" : (running || waiting ? "active" : "collection"));
      useEffect(() => {
        if (retained.status === "error") logStore.add({ level: "error", source: "history", message: "conversation history unavailable", context: { sessionId: row.id } });
      }, [retained.status, row.id]);
      useEffect(() => {
        if (!menuOpen) return;
        const close = (event) => {
          if (menuRef.current && menuRef.current.contains(event.target)) return;
          if (event.target && event.target.closest && event.target.closest(".tw-menu-trigger")) return;
          setMenuOpen(false);
        };
        const key = (event) => { if (event.key === "Escape") setMenuOpen(false); };
        document.addEventListener("pointerdown", close, true);
        document.addEventListener("keydown", key);
        return () => {
          document.removeEventListener("pointerdown", close, true);
          document.removeEventListener("keydown", key);
        };
      }, [menuOpen]);
      useEffect(() => {
        if (!renaming || !renameRef.current) return;
        renameRef.current.focus({ preventScroll: true });
        renameRef.current.select();
      }, [renaming]);
      const commitRename = async () => {
        const next = renameValue.trim();
        if (!next || next === title) { setRenaming(false); return; }
        setActing(true);
        try {
          const result = await sessions.rename(row.id, next);
          if (!result || result.ok !== true) throw new Error((result && result.error && result.error.message) || t("renameFailed"));
          setRenaming(false);
        } catch (error) {
          setActionError(t("renameFailed"));
          logStore.add({ level: "error", source: "rename", message: error && error.message || t("renameFailed"), stack: error && error.stack, context: { sessionId: row.id } });
        } finally {
          setActing(false);
        }
      };
      const startRename = () => {
        setMenuOpen(false);
        setRenameValue(title);
        setRenaming(true);
      };
      const doFork = async () => {
        setMenuOpen(false);
        if (typeof forkSession !== "function") return;
        setActing(true);
        setActionError("");
        try { await forkSession(row.id); }
        catch (error) { setActionError(t("forkFailed")); logStore.add({ level: "error", source: "fork", message: error && error.message || t("forkFailed"), stack: error && error.stack, context: { sessionId: row.id } }); }
        finally { setActing(false); }
      };
      const doUnarchive = async () => {
        setMenuOpen(false);
        if (typeof unarchiveSession !== "function") return;
        setActing(true);
        setActionError("");
        try { await unarchiveSession(row.id); }
        catch (error) { setActionError(t("actionFailed")); logStore.add({ level: "error", source: "unarchive", message: error && error.message || t("actionFailed"), stack: error && error.stack, context: { sessionId: row.id } }); }
        finally { setActing(false); }
      };
      const doArchive = async () => {
        setMenuOpen(false);
        if (typeof archiveSession !== "function") return;
        if (!window.confirm(t("archiveConfirm"))) return;
        setActing(true);
        setActionError("");
        try {
          try {
            await archiveSession(row.id);
          } catch (error) {
            const code = error && error.rpcError && error.rpcError.code;
            if (code !== "workspace/session-active") throw error;
            if (!window.confirm(t("stopAndArchiveConfirm"))) return;
            await archiveSession(row.id, { stopActivity: true });
          }
        } catch (error) {
          setActionError(t("archiveFailed"));
          logStore.add({ level: "error", source: "archive", message: error && error.message || t("archiveFailed"), stack: error && error.stack, context: { sessionId: row.id, code: error && error.rpcError && error.rpcError.code } });
        } finally {
          setActing(false);
        }
      };
      return h("article", {
        className: "tw-card " + variant + statusClass + (entering ? " is-entering" : "") + (inView ? "" : " is-offscreen") + (archived ? " is-archived" : ""), ref: cardRef, "data-menu-open": menuOpen ? "true" : "false",
        "data-bubbles": (pinned || variant === "active") ? "split" : (bubbleAlign === "left" ? "left" : "split"),
        onPointerDown: (event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; },
        onClick: (event) => {
          if (event.target.closest("button,input,textarea,select,a,summary")) return;
          const start = pointerStart.current;
          pointerStart.current = null;
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
          const selection = window.getSelection && window.getSelection();
          if (selection && String(selection).trim()) return;
          scheduleFocus();
        },
      },
        h("div", { className: "tw-card-body" },
          h("div", { className: "tw-card-top" },
            h("span", { className: "tw-led " + ledClass }),
            renaming ? h("input", {
              ref: renameRef, className: "tw-rename-input", type: "text", value: renameValue, disabled: acting,
              onChange: (event) => setRenameValue(event.currentTarget.value),
              onKeyDown: (event) => {
                if (event.key === "Enter") { event.preventDefault(); void commitRename(); }
                if (event.key === "Escape") { event.preventDefault(); setRenaming(false); }
              },
              onBlur: () => { if (!acting) setRenaming(false); },
              onClick: (event) => event.stopPropagation(),
            }) : h("h3", { className: "tw-card-title", title }, title),
            waiting ? h("span", { className: "tw-handle tw-handle-static" }, t("waiting")) : null,
            running ? h("button", { className: "tw-icon-btn", type: "button", title: t("stop"), "aria-label": t("stop"), onClick: (event) => { event.stopPropagation(); if (retained.binding) void retained.binding.session.cancel().catch((error) => { logStore.add({ level: "error", source: "cancel", message: error && error.message || "cancel failed", stack: error && error.stack }); }); } }, h(StopIcon)) : null,
            h("button", { className: "tw-icon-btn", type: "button", title: t("open"), "aria-label": t("open"), onClick: (event) => { event.stopPropagation(); openSession(row.id); } }, h(OpenIcon)),
            h("button", { className: "tw-icon-btn", type: "button", title: pinned ? t("unpin") : (pinFull ? t("pinFull") : t("pin")), "aria-label": pinned ? t("unpin") : t("pin"), onClick: (event) => { event.stopPropagation(); onPin(onPinId); } }, h(PinIcon, { off: pinned })),
            h("button", { className: "tw-icon-btn tw-menu-trigger", type: "button", title: t("more"), "aria-label": t("more"), "aria-expanded": menuOpen, disabled: acting, onClick: (event) => { event.stopPropagation(); setMenuOpen((value) => !value); } }, h(MoreIcon))
          ),
          h("div", { className: "tw-meta" },
            h("span", null, workspace), h("span", { className: "sep" }, "/"),
            h("span", { className: stateClass }, stateLabel), h("span", { className: "sep" }, "/"),
            h("span", null, relativeTime(row.updatedAt, t)),
            h(ModelPicker, { models, sessionId: row.id, t })
          ),
          actionError ? h("div", { className: "tw-card-action-error" }, actionError) : null,
          retained.status === "ready"
            ? h(CardConversation, { binding: retained.binding, status, t, layoutKey, tools, pending: status && status.pendingInteraction, onOpen: () => openSession(row.id) })
            : h(React.Fragment, null,
                h("div", { className: "tw-log" }, h("div", { className: "tw-log-empty" }, retained.status === "error" ? t("historyError") : t("loadingHistory"))),
                h("div", { className: "tw-compose" },
                  h("div", { className: "tw-compose-field" },
                    h("textarea", { rows: 1, disabled: true, placeholder: t("reply") }),
                    h("button", { className: "tw-send", type: "button", disabled: true }, h(SendIcon))
                  )
                )
              )
        ),
        menuOpen ? h("div", { className: "tw-card-menu", ref: menuRef, role: "menu", onClick: (event) => event.stopPropagation() },
          h("button", { type: "button", role: "menuitem", onClick: () => { setMenuOpen(false); openSession(row.id); } }, t("open")),
          h("button", { type: "button", role: "menuitem", onClick: startRename }, t("rename")),
          h("button", { type: "button", role: "menuitem", onClick: () => { void doFork(); } }, t("fork")),
          archived ? h("button", { type: "button", role: "menuitem", onClick: () => { void doUnarchive(); } }, t("unarchive")) : h("button", { type: "button", role: "menuitem", className: "is-danger", onClick: () => { void doArchive(); } }, t("archive"))
        ) : null,
        (running || waiting) && inView ? h("span", { className: "tw-ants" + (running ? " run" : ""), "aria-hidden": true }, h("svg", { preserveAspectRatio: "none" }, h("rect", { rx: radius === "soft" ? 18 : 0 }))) : null
      );
    }

    // The wall re-renders on every session/list event; memo keeps untouched cards
    // from reconciling thousands of transcript nodes each time.
    const CardMemo = React.memo(Card, (a, b) => (
      a.row.id === b.row.id &&
      a.row.title === b.row.title &&
      (a.row.displayTitle || "") === (b.row.displayTitle || "") &&
      a.row.cwd === b.row.cwd &&
      a.row.updatedAt === b.row.updatedAt &&
      a.row.running === b.row.running &&
      a.row.blank === b.row.blank &&
      a.pinned === b.pinned && a.layout === b.layout && a.radius === b.radius &&
      a.entering === b.entering && a.pinFull === b.pinFull &&
      a.bubbleAlign === b.bubbleAlign && a.tools === b.tools && a.layoutKey === b.layoutKey &&
      a.status === b.status && a.onPinId === b.onPinId && a.onPin === b.onPin &&
      a.t === b.t && a.sessions === b.sessions && a.openSession === b.openSession
    ));


    function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        const area = document.createElement("textarea");
        area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
        document.body.appendChild(area); area.select();
        const ok = document.execCommand("copy");
        area.remove();
        return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
      } catch (error) { return Promise.reject(error); }
    }

    function LogPanel({ t, onClose }) {
      const logs = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot, logStore.getSnapshot);
      useEffect(() => { logStore.markSeen(); }, [logs]);
      const errorCount = logs.filter((entry) => entry.level === "error").length;
      const [status, setStatus] = useState("");
      const copyAll = async () => {
        try { await copyText(logStore.export() || "(no logs)"); setStatus(t("logCopied")); }
        catch { setStatus("copy failed"); }
        setTimeout(() => setStatus(""), 1600);
      };
      const download = () => {
        try {
          const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url; link.download = "dsh-topic-wall-logs.json"; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {}
      };
      return h("div", { className: "tw-log-backdrop", onClick: onClose },
        h("section", { className: "tw-log-panel", role: "dialog", "aria-label": t("log"), onClick: (event) => event.stopPropagation() },
          h("header", { className: "tw-log-head" },
            h("h2", null, t("log")),
            h("span", { className: "tw-log-count" }, t("logCount").replace("{n}", String(logs.length))),
            h("button", { className: "tw-log-x", type: "button", title: t("close"), "aria-label": t("close"), onClick: onClose }, "×")
          ),
          h("div", { className: "tw-log-actions" },
            h("button", { type: "button", onClick: copyAll }, t("logCopy")),
            h("button", { type: "button", onClick: download }, t("logDownload")),
            h("button", { type: "button", onClick: () => { if (window.confirm(t("logClear") + "?")) logStore.clear(); } }, t("logClear")),
            status ? h("span", { className: "tw-log-status" }, status) : null
          ),
          h("div", { className: "tw-log-list" },
            logs.length === 0 ? h("p", { className: "tw-log-empty" }, t("logEmpty")) : logs.map((entry) => h("article", {
              className: "tw-log-entry", key: entry.id, "data-level": entry.level,
            },
              h("div", { className: "tw-log-meta" },
                h("time", null, logTime(entry.time)),
                h("span", { className: "tw-log-level" }, entry.level),
                h("span", null, entry.source)
              ),
              h("p", null, entry.message),
              entry.context ? h("pre", { className: "tw-log-context" }, entry.context) : null,
              entry.stack ? h("details", null, h("summary", null, t("logStack")), h("pre", null, entry.stack)) : null
            ))
          ),
          h("footer", { className: "tw-log-foot" }, t("localOnly") + " · " + t("logPersist"))
        )
      );
    }

    class WallErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) { return { error }; }
      componentDidCatch(error, info) {
        logStore.add({
          level: "error", source: "react",
          message: (error && error.message) || String(error || "render error"),
          stack: (error && error.stack) || "",
          context: { componentStack: (info && info.componentStack) || "" },
        });
      }
      render() {
        if (!this.state.error) return this.props.children;
        const t = this.props.t;
        const error = this.state.error;
        const copy = async () => { try { await copyText(logStore.export() || "(no logs)"); } catch {} };
        return h("div", { className: "tw-crash" },
          h("div", { className: "tw-crash-card" },
            h("h1", null, t("logCrashTitle")),
            h("p", null, t("logCrashHint")),
            h("pre", null, clip((error && error.stack) || error, 4000)),
            h("div", { className: "tw-crash-actions" },
              h("button", { type: "button", onClick: () => this.setState({ error: null }) }, t("logRetry")),
              h("button", { type: "button", onClick: () => location.reload() }, t("logReload")),
              h("button", { type: "button", onClick: copy }, t("logCopy"))
            )
          )
        );
      }
    }

    let styleNode = null;
    let styleUsers = 0;
    function retainStyles() {
      if (typeof document === "undefined") return () => {};
      if (styleNode === null) {
        styleNode = document.createElement("style");
        styleNode.dataset.plugin = "dsh-topic-wall";
        styleNode.textContent = CSS;
        document.head.appendChild(styleNode);
      }
      styleUsers += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        styleUsers -= 1;
        if (styleUsers <= 0 && styleNode) { styleNode.remove(); styleNode = null; }
      };
    }

    function SettingsTrigger({ t, settingsOpen, onToggle }) {
      const logs = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot, logStore.getSnapshot);
      const seenAt = logStore.getSeenAt();
      const errorCount = logs.filter((entry) => entry.level === "error" && Date.parse(entry.time) > seenAt).length;
      return h("button", { className: "tw-settings-btn", type: "button", title: errorCount ? `${t("settings")} · ${errorCount} errors` : t("settings"), "aria-label": t("settings"), "aria-expanded": settingsOpen, "data-has-error": errorCount > 0, onClick: onToggle }, h(GearIcon), errorCount ? h("span", { className: "tw-settings-alert", "aria-hidden": true }) : null);
    }

    function WallPage(props) {
      React.useLayoutEffect(() => retainStyles(), []);
      return h(WallErrorBoundary, { t: props.t }, h(TopicWallPage, props));
    }

    function ModelPicker({ models, sessionId, t }) {
      const directory = useMemo(() => {
        if (!models || !sessionId || typeof models.directoryFor !== "function") return null;
        try { return models.directoryFor(sessionId); } catch { return null; }
      }, [models, sessionId]);
      const subscribe = useCallback((listener) => {
        if (!directory) return () => {};
        try { return directory.store.subscribe(listener); } catch { return () => {}; }
      }, [directory]);
      const getSnapshot = useCallback(() => {
        if (!directory) return EMPTY_MODEL_STATE;
        try { return directory.store.getSnapshot() || EMPTY_MODEL_STATE; } catch { return EMPTY_MODEL_STATE; }
      }, [directory]);
      const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      useEffect(() => {
        if (!directory) return;
        directory.load().catch(() => {});
      }, [directory]);
      const groups = state.groups || EMPTY;
      const current = state.current;
      const choices = groups.flatMap((group) => (group.models || []).map((model) => ({ group, model })));
      const value = current ? JSON.stringify([current.provider, current.model]) : "";
      const pick = async (event) => {
        let selected;
        try { selected = JSON.parse(event.currentTarget.value); } catch { return; }
        const choice = choices.find((item) => item.group.id === selected[0] && item.model.id === selected[1]);
        if (!choice || !directory) return;
        const selection = { provider: choice.group.id, model: choice.model.id };
        if (choice.model.reasoning && choice.model.reasoning.defaultEffort !== undefined) selection.reasoningEffort = choice.model.reasoning.defaultEffort;
        try {
          const result = await directory.select(selection);
          if (!result || result.ok !== true) {
            const message = result && result.error ? (result.error.message || result.error.code) : t("modelSwitchFailed");
            logStore.add({ level: "error", source: "model", message: message || t("modelSwitchFailed"), context: { sessionId, provider: choice.group.id, model: choice.model.id } });
          }
        } catch (error) {
          logStore.add({ level: "error", source: "model", message: error && error.message || t("modelSwitchFailed"), stack: error && error.stack, context: { sessionId } });
        }
      };
      if (!sessionId || !directory) return null;
      return h("span", { className: "tw-model-picker" },
        h("select", {
          className: "tw-model-select",
          value,
          disabled: groups.length === 0,
          title: t("model"),
          "aria-label": t("model"),
          onChange: (event) => { void pick(event); },
        },
          h("option", { value: "", disabled: true }, groups.length === 0 ? (state.status === "loading" ? t("modelLoading") : t("modelEmpty")) : t("model")),
          groups.map((group) => h("optgroup", { label: group.id === "deepseek-account" ? t("modelAccount") : (group.name || group.id), key: group.id },
            (group.models || []).map((model) => h("option", { value: JSON.stringify([group.id, model.id]), key: model.id }, model.name || model.id))
          ))
        ),
        h("span", { className: "tw-model-caret", "aria-hidden": true }, "▾")
      );
    }

    function TopicWallPage(props) {
      const { sessionsStore, statusStore, workspacesStore, t, sessions, openSession, newChatIn, modelDirectories, forkSession, archiveSession, unarchiveSession } = props;
      const list = useSyncExternalStore(
        (cb) => sessionsStore.subscribe(cb), () => sessionsStore.getSnapshot(), () => sessionsStore.getSnapshot()
      );
      const statusMap = useSyncExternalStore(
        (cb) => statusStore.subscribe(cb), () => statusStore.getSnapshot(), () => statusStore.getSnapshot()
      );
      const workspaceState = useSyncExternalStore(
        (cb) => (workspacesStore ? workspacesStore.subscribe(cb) : () => {}),
        () => (workspacesStore ? workspacesStore.getSnapshot() : EMPTY_WORKSPACE_STATE),
        () => (workspacesStore ? workspacesStore.getSnapshot() : EMPTY_WORKSPACE_STATE)
      );
      const archivedIds = useMemo(() => new Set((workspaceState && workspaceState.archivedSessionIds) || EMPTY), [workspaceState]);
      const [, tick] = useState(0);
      const activeSeq = useRef(0);
      const activeSince = useRef(new Map());
      const seenCardIds = useRef(new Set());
      const cardsReady = useRef(false);
      const [newChatIds, setNewChatIds] = useState(() => new Set());
      const [pins, setPins] = useState(readPins);
      const [settings, setSettings] = useState(readSettings);
      const [settingsOpen, setSettingsOpen] = useState(false);
      const [showArchived, setShowArchived] = useState(false);
      const [logOpen, setLogOpen] = useState(false);
      const [collapsedSpaces, setCollapsedSpaces] = useState(() => new Set(readCollapsed()));
      const [expandedSpaces, setExpandedSpaces] = useState(() => new Set());
      const pageVisible = useDocumentVisible();
      const toggleSettings = useCallback(() => setSettingsOpen((value) => !value), []);
      const saveSettings = () => {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
          setSettingsOpen(false);
        } catch (error) {
          logStore.add({ level: "error", source: "settings", message: error && error.message || t("saveFailed"), stack: error && error.stack });
        }
      };
      const refreshPage = () => {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
        location.reload();
      };
      useEffect(() => {
        const timer = setInterval(() => tick((v) => v + 1), 30000);
        return () => clearInterval(timer);
      }, []);
      useEffect(() => {
        if (list && list.phase !== "pending") cardsReady.current = true;
      }, [list]);
      useEffect(() => {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
      }, [settings]);
      useEffect(() => {
        if (!settingsOpen) return;
        const onKey = (event) => { if (event.key === "Escape") setSettingsOpen(false); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
      }, [settingsOpen]);
      useEffect(() => {
        try { localStorage.setItem(PIN_KEY, JSON.stringify(pins)); } catch {}
      }, [pins]);
      useEffect(() => {
        try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsedSpaces])); } catch {}
      }, [collapsedSpaces]);

      const items = useMemo(() => {
        if (!list || !list.ids || !list.byId) return EMPTY;
        return list.ids.map((id) => list.byId[id]).filter(Boolean);
      }, [list]);
      const rows = useMemo(() => {
        const seen = new Set();
        return items.filter((row) => {
          if (!row || seen.has(row.id)) return false;
          seen.add(row.id);
          if (row.parentId || (row.depth || 0) > 0 || row.origin === "subagent") return false;
          if (archivedIds.has(row.id)) return false;
          if (row.blank && !newChatIds.has(row.id)) return false;
          return true;
        }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      }, [items, newChatIds, archivedIds]);
      const byId = useMemo(() => Object.fromEntries(rows.map((row) => [row.id, row])), [rows]);
      const validPins = pins.filter((id) => byId[id]);
      const pinnedRows = validPins.map((id) => byId[id]);
      const activeRaw = rows.filter((row) => (
        (statusMap.get(row.id) && (statusMap.get(row.id).running || statusMap.get(row.id).pendingInteraction)) || row.running || newChatIds.has(row.id)
      ));
      const activeRows = useMemo(() => {
        const currentIds = new Set(activeRaw.map((row) => row.id));
        for (const row of [...activeRaw].sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))) {
          if (!activeSince.current.has(row.id)) activeSince.current.set(row.id, ++activeSeq.current);
        }
        for (const id of [...activeSince.current.keys()]) {
          if (!currentIds.has(id)) activeSince.current.delete(id);
        }
        return [...activeRaw].sort((a, b) => (activeSince.current.get(a.id) || 0) - (activeSince.current.get(b.id) || 0));
      }, [activeRaw]);
      const collectionRows = rows.filter((row) => !validPins.includes(row.id) && !activeRows.includes(row));
      const workspaceGroups = useMemo(() => {
        const map = new Map();
        for (const row of collectionRows) {
          const path = row.cwd || "";
          const key = path || "__none__";
          let group = map.get(key);
          if (!group) {
            group = { key, path, label: baseName(path) || t("workspaceUnknown"), rows: [] };
            map.set(key, group);
          }
          group.rows.push(row);
        }
        return [...map.values()];
      }, [collectionRows, t]);
      const allSpacesCollapsed = workspaceGroups.length > 0 && workspaceGroups.every((group) => collapsedSpaces.has(group.key));
      const toggleSpace = (key) => setCollapsedSpaces((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
      const toggleAllSpaces = () => setCollapsedSpaces(() => {
        if (allSpacesCollapsed) return new Set();
        return new Set(workspaceGroups.map((group) => group.key));
      });
      const pendingCount = rows.filter((row) => {
        const st = statusMap.get(row.id);
        return !!(st && st.pendingInteraction);
      }).length;
      const archivedRows = useMemo(() => {
        const seen = new Set();
        return items.filter((row) => {
          if (!row || seen.has(row.id)) return false;
          seen.add(row.id);
          if (row.parentId || (row.depth || 0) > 0 || row.origin === "subagent") return false;
          return archivedIds.has(row.id);
        }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      }, [items, archivedIds]);
      const archivedCount = archivedRows.length;
      const toggleArchived = () => {
        setShowArchived((value) => {
          const next = !value;
          if (next) requestAnimationFrame(() => { const el = document.getElementById("tw-archived"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
          return next;
        });
      };

      const togglePin = useCallback((id) => {
        setPins((current) => {
          if (current.includes(id)) return current.filter((x) => x !== id);
          if (current.length >= MAX_PINS) return current;
          return [...current, id];
        });
      }, []);
      const open = useCallback((id) => { if (typeof openSession === "function") openSession(id); }, [openSession]);

      if (!list || list.phase === "pending") {
        return h("div", { className: "tw-page tw-ios" }, h("div", { className: "tw-top" }, h("div", { className: "tw-brand" }, h("span", { className: "tw-mark" }, h("i"), h("i")), h("h1", { className: "tw-title" }, t("title")))), h("div", { className: "tw-board" }, h("p", { className: "tw-empty" }, t("loading"))));
      }

      const shelf = (key, label, count, hint, body, empty) => h("section", { className: "tw-shelf", "data-shelf": key },
        h("div", { className: "tw-shelf-head" },
          h("h2", null, label),
          h("span", { className: "tw-shelf-hint" }, hint),
          h("span", { className: "tw-shelf-count" }, String(count).padStart(2, "0"))
        ),
        h("div", { className: "tw-shelf-body" }, body || h("p", { className: "tw-empty" }, empty))
      );
      const createChat = async (cwd) => {
        if (typeof newChatIn !== "function" || !cwd) return;
        const sessionId = await newChatIn(cwd);
        if (!sessionId) return;
        setNewChatIds((current) => new Set(current).add(sessionId));
      };
      const renderCard = (props) => h(CardBoundary, {
        key: props.key, t, sessionId: props.row && props.row.id,
        onOpen: () => openSession(props.row.id),
        onArchive: archiveSession ? () => { if (window.confirm(t("archiveConfirm"))) Promise.resolve(archiveSession(props.row.id)).catch((error) => logStore.add({ level: "error", source: "archive", message: error && error.message || t("archiveFailed"), stack: error && error.stack, context: { sessionId: props.row.id } })); } : null,
      }, h(CardMemo, props));
      const cardProps = (row, pinned, layout) => {
        let entering = false;
        if (!cardsReady.current) {
          seenCardIds.current.add(row.id);
        } else if (!seenCardIds.current.has(row.id)) {
          seenCardIds.current.add(row.id);
          entering = true;
        }
        return {
        key: row.id, row, status: statusMap.get(row.id), pinned, layout, radius: settings.radius, entering,
        pinFull: pins.length >= MAX_PINS, t, sessions, openSession: open,
        onPin: togglePin, onPinId: row.id, bubbleAlign: settings.bubbleAlign, tools: settings.tools, models: modelDirectories,
        forkSession, archiveSession, unarchiveSession,
        layoutKey: settings.cardHeight + ":" + settings.font + ":" + settings.columns,
      };
      };

      return h("div", { className: "tw-page" + (settings.style === "ios" ? " tw-ios" : ""), "data-style": settings.style, "data-motion": settings.motion, "data-radius": settings.radius, "data-paused": pageVisible ? "false" : "true", style: { "--tw-font": settings.font + "px", "--tw-cols": String(settings.columns), "--tw-card-h": settings.cardHeight + "px" } },
        h("header", { className: "tw-top" },
          h("div", { className: "tw-brand" },
            h("span", { className: "tw-mark" }, h("i"), h("i")),
            h("h1", { className: "tw-title" }, t("title")),
            h("div", { className: "tw-summary" },
              h("span", { className: "tw-summary-item" }, h(SummaryIcon, { kind: "sessions" }), h("b", null, rows.length), " " + t("sessions")),
              h("span", { className: "sep" }, "/"),
              h("span", { className: "tw-summary-item" }, h(SummaryIcon, { kind: "pin" }), h("b", null, validPins.length), " " + t("pinned")),
              h("span", { className: "sep" }, "/"),
              h("span", { className: "tw-summary-item" + (pendingCount ? " wait" : "") }, h(SummaryIcon, { kind: "wait" }), h("b", null, pendingCount), " " + t("waiting")),
              h("span", { className: "sep" }, "/"),
              h("button", { className: "tw-summary-item tw-summary-archived" + (showArchived ? " is-active" : ""), type: "button", title: t("archivedHint"), "aria-expanded": showArchived, onClick: toggleArchived },
                h(SummaryIcon, { kind: "archived" }), h("b", null, archivedCount), " " + t("archived"))
            )
          ),
          h("div", { className: "tw-top-right" },
            h("div", { className: "tw-hint" }, t("hint")),
            h(SettingsTrigger, { t, settingsOpen, onToggle: toggleSettings })
          )
        ),
        h("main", { className: "tw-board" },
          shelf("pin", t("pinned"), pinnedRows.length, t("pinnedHint"),
            pinnedRows.length ? h("div", { className: "tw-row" }, pinnedRows.map((row) => renderCard(cardProps(row, true)))) : null, t("emptyPinned")),
          shelf("active", t("active"), activeRows.length, t("activeHint"),
            activeRows.length ? h("div", { className: "tw-row" }, activeRows.map((row) => renderCard(cardProps(row, validPins.includes(row.id), "active")))) : null, t("emptyActive")),
          shelf("collection", t("collection"), collectionRows.length, t("collectionHint"),
            collectionRows.length ? h("div", { className: "tw-workspace" },
              h("div", { className: "tw-workspace-tools" },
                h("span", null, t("groups").replace("{n}", String(workspaceGroups.length))),
                h("button", { type: "button", onClick: toggleAllSpaces }, allSpacesCollapsed ? t("expandAll") : t("collapseAll"))
              ),
              workspaceGroups.map((group) => {
                const open = !collapsedSpaces.has(group.key);
                return h("section", { className: "tw-wspace", "data-open": open, key: group.key },
                  h("div", { className: "tw-wspace-head" },
                    h("button", { className: "tw-wspace-toggle", type: "button", "aria-expanded": open, onClick: () => toggleSpace(group.key) },
                      h("span", { className: "tw-wspace-caret" }, open ? "▾" : "▸"),
                      h("span", { className: "tw-wspace-name", title: group.path }, group.label),
                      h("span", { className: "tw-wspace-count" }, group.rows.length)
                    ),
                    group.path ? h("button", { className: "tw-wspace-new", type: "button", title: t("newChat"), "aria-label": t("newChat"), onClick: () => { void createChat(group.path); } }, h(PlusIcon)) : null
                  ),
                  open ? (() => {
                    const limit = Math.max(2, settings.columns) * Math.max(1, settings.spaceRows);
                    const expanded = expandedSpaces.has(group.key);
                    const visibleRows = expanded ? group.rows : group.rows.slice(0, limit);
                    const hidden = group.rows.length - visibleRows.length;
                    return h(React.Fragment, null,
                      h("div", { className: "tw-grid" }, visibleRows.map((row) => renderCard(cardProps(row, false)))),
                      expanded && group.rows.length > limit ? h("div", { className: "tw-wspace-more" },
                        h("button", { type: "button", onClick: () => setExpandedSpaces((current) => { const next = new Set(current); next.delete(group.key); return next; }) }, t("showLess"))
                      ) : null,
                      !expanded && hidden > 0 ? h("div", { className: "tw-wspace-more" },
                        h("button", { type: "button", onClick: () => setExpandedSpaces((current) => new Set(current).add(group.key)), title: `${hidden} more` }, t("showMore") + " (" + hidden + ")")
                      ) : null
                    );
                  })() : null
                );
              })
            ) : null, t("emptyCollection")),
          archivedRows.length > 0 || showArchived ? h("section", { className: "tw-shelf", id: "tw-archived", "data-shelf": "archived" },
            h("div", { className: "tw-shelf-head tw-shelf-head-toggle", role: "button", tabIndex: 0, "aria-expanded": showArchived, onClick: toggleArchived, onKeyDown: (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleArchived(); } } },
              h("h2", null, t("archived")),
              h("span", { className: "tw-shelf-hint" }, t("archivedHint")),
              h("span", { className: "tw-shelf-count" }, String(archivedRows.length).padStart(2, "0")),
              h("span", { className: "tw-shelf-caret", "aria-hidden": true }, showArchived ? "▾" : "▸")
            ),
            showArchived ? h("div", { className: "tw-shelf-body" },
              archivedRows.length ? h("div", { className: "tw-grid" }, archivedRows.map((row) => renderCard({ ...cardProps(row, false, "collection"), archived: true }))) : h("p", { className: "tw-empty" }, t("emptyArchived"))
            ) : null
          ) : null,
          h("div", { className: "tw-foot" }, h("i"), t("footer"))
        ),
        settingsOpen ? h(React.Fragment, null,
          h("div", { className: "tw-settings-backdrop", onClick: () => setSettingsOpen(false) }),
          h("aside", { className: "tw-settings", role: "dialog", "aria-label": t("settings"), onClick: (event) => event.stopPropagation() },
            h("div", { className: "tw-settings-head" },
              h("div", null, h("h2", null, t("settings")), h("p", null, t("settingsDesc"))),
              h("button", { className: "tw-settings-close", type: "button", "aria-label": t("close"), title: t("close"), onClick: () => setSettingsOpen(false) }, "×")
            ),
            h("div", { className: "tw-settings-body" },
              h("section", { className: "tw-config-section" },
                h("div", { className: "tw-config-title" }, h("h3", null, t("appearance")), h("p", null, t("appearanceHint"))),
                h("div", { className: "tw-config-sublabel" }, t("style")),
                h("div", { className: "tw-style-grid" }, STYLES.map((style) => h("button", {
                  key: style.id, type: "button", className: "tw-style", "data-active": settings.style === style.id, "data-style": style.id,
                  onClick: () => setSettings((current) => ({ ...current, style: style.id })),
                },
                  h("span", { className: "tw-style-preview" }, h("i"), h("b")),
                  h("span", { className: "tw-style-copy" }, h("b", null, t(style.labelKey)), h("small", null, t(style.hintKey)))
                ))),
                h("div", { className: "tw-config-row" },
                  h("span", { className: "tw-config-label" }, t("radius")),
                  h("div", { className: "tw-segment" },
                    h("button", { type: "button", "data-active": settings.radius === "sharp", onClick: () => setSettings((current) => ({ ...current, radius: "sharp" })) }, t("radiusSharp")),
                    h("button", { type: "button", "data-active": settings.radius === "soft", onClick: () => setSettings((current) => ({ ...current, radius: "soft" })) }, t("radiusSoft"))
                  )
                )
              ),
              h("section", { className: "tw-config-section" },
                h("div", { className: "tw-config-title" }, h("h3", null, t("layout")), h("p", null, t("layoutHint"))),
                h("div", { className: "tw-config-slider" },
                  h("div", { className: "tw-config-line" }, h("label", { htmlFor: "tw-setting-columns" }, t("columns")), h("output", null, settings.columns + " " + t("columnsUnit"))),
                  h("input", { id: "tw-setting-columns", type: "range", min: 2, max: 6, step: 1, value: settings.columns, onChange: (event) => { const value = event.currentTarget.value; setSettings((current) => ({ ...current, columns: clampInt(value, 2, 6, current.columns) })); } })
                ),
                h("div", { className: "tw-config-row" },
                  h("span", { className: "tw-config-label" }, t("spaceRows")),
                  h("div", { className: "tw-segment" }, [1, 2, 3].map((rows) => h("button", {
                    key: rows, type: "button", "data-active": settings.spaceRows === rows,
                    onClick: () => setSettings((current) => ({ ...current, spaceRows: rows })),
                  }, rows + " " + t("spaceRowsUnit"))))
                ),
                h("p", { className: "tw-config-hint" }, t("spaceRowsHint")),
                h("div", { className: "tw-config-slider" },
                  h("div", { className: "tw-config-line" }, h("label", { htmlFor: "tw-setting-height" }, t("cardHeight")), h("output", null, settings.cardHeight + "px")),
                  h("input", { id: "tw-setting-height", type: "range", min: 280, max: 560, step: 10, value: settings.cardHeight, onChange: (event) => { const value = event.currentTarget.value; setSettings((current) => ({ ...current, cardHeight: clampInt(value, 280, 560, current.cardHeight) })); } })
                )
              ),
              h("section", { className: "tw-config-section" },
                h("div", { className: "tw-config-title" }, h("h3", null, t("typography")), h("p", null, t("fontSizeHint"))),
                h("div", { className: "tw-config-slider" },
                  h("div", { className: "tw-config-line" }, h("label", { htmlFor: "tw-setting-font" }, t("fontSize")), h("output", null, settings.font + "px")),
                  h("input", { id: "tw-setting-font", type: "range", min: 12, max: 20, step: 1, value: settings.font, onChange: (event) => { const value = event.currentTarget.value; setSettings((current) => ({ ...current, font: clampInt(value, 12, 20, current.font) })); } })
                )
              ),
              h("section", { className: "tw-config-section" },
                h("div", { className: "tw-config-title" }, h("h3", null, t("behavior")), h("p", null, t("behaviorHint"))),
                h("button", { className: "tw-toggle", type: "button", role: "switch", "aria-checked": settings.motion === "on", onClick: () => setSettings((current) => ({ ...current, motion: current.motion === "on" ? "off" : "on" })) },
                  h("span", { className: "tw-toggle-copy" }, h("b", null, t("motion")), h("small", null, t("motionHint"))),
                  h("span", { className: "tw-switch", "data-on": settings.motion === "on" }, h("i"))
                ),
                h("div", { className: "tw-config-row" },
                  h("span", { className: "tw-config-label" }, t("tools")),
                  h("div", { className: "tw-segment" },
                    h("button", { type: "button", "data-active": settings.tools === "folded", onClick: () => setSettings((current) => ({ ...current, tools: "folded" })) }, t("toolsFolded")),
                    h("button", { type: "button", "data-active": settings.tools === "hidden", onClick: () => setSettings((current) => ({ ...current, tools: "hidden" })) }, t("toolsHidden"))
                  )
                ),
                h("p", { className: "tw-config-hint" }, t("toolsHint"))
              ),
              h("p", { className: "tw-settings-scope" }, t("collectionOnly"))
            ),
            h("div", { className: "tw-settings-foot" },
              h("button", { className: "tw-log-open", type: "button", onClick: () => setLogOpen(true) }, t("log")),
              h("button", { className: "tw-reset tw-refresh", type: "button", onClick: refreshPage }, t("refresh")),
              h("button", { className: "tw-reset", type: "button", onClick: () => setSettings({ ...DEFAULT_SETTINGS }) }, t("reset")),
              h("button", { className: "tw-save", type: "button", onClick: saveSettings }, t("save"))
            )
          )
        ) : null,
        logOpen ? h(LogPanel, { t, onClose: () => setLogOpen(false) }) : null
      );
    }

    function TopicWallIcon(props) { return h(Icon, { size: (props && props.size) || 18 }); }

    return {
      inject: ["slots", "sessions", "layout", "locale", "uiSession", "uiWorkspace"],
      apply(ctx) {
        installLogCapture();
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), "topic-wall: dictionaries");
        const t = ctx.locale.bind(NS);
        const uiSession = ctx.get("uiSession");
        const statusStore = uiSession && uiSession.sessionStatus
          ? uiSession.sessionStatus
          : { getSnapshot: () => EMPTY_STATUS, subscribe: () => () => {} };
        const sessionsStore = ctx.sessions.list;
        const uiWorkspace = ctx.get("uiWorkspace");
        const injected = {
          sessionsStore, statusStore, t, sessions: ctx.sessions,
          workspacesStore: uiWorkspace && uiWorkspace.workspaces ? uiWorkspace.workspaces.list : null,
          get modelDirectories() { return ctx.get("modelDirectories"); },
          openSession(id) {
            try { if (uiWorkspace && typeof uiWorkspace.openSession === "function") uiWorkspace.openSession(id); }
            catch (error) { logStore.add({ level: "error", source: "open-session", message: error && error.message || "openSession failed", stack: error && error.stack, context: { id } }); }
            try { ctx.layout.selectPanel(null); }
            catch (error) { logStore.add({ level: "error", source: "layout", message: error && error.message || "selectPanel failed", stack: error && error.stack }); }
          },
          async forkSession(sessionId) {
            if (!uiWorkspace || typeof uiWorkspace.forkSession !== "function") throw new Error("fork is unavailable");
            return uiWorkspace.forkSession(sessionId);
          },
          async archiveSession(sessionId, options) {
            if (!uiWorkspace || typeof uiWorkspace.archiveSession !== "function") throw new Error("archive is unavailable");
            return options === undefined ? uiWorkspace.archiveSession(sessionId) : uiWorkspace.archiveSession(sessionId, options);
          },
          async unarchiveSession(sessionId) {
            if (!uiWorkspace || typeof uiWorkspace.unarchiveSession !== "function") throw new Error("unarchive is unavailable");
            return uiWorkspace.unarchiveSession(sessionId);
          },
          async newChatIn(cwd) {
            try {
              if (!cwd) throw new Error("new chat requires a workspace cwd");
              const workspaces = uiWorkspace && uiWorkspace.workspaces && uiWorkspace.workspaces.list
                ? uiWorkspace.workspaces.list.getSnapshot().items
                : [];
              const workspace = workspaces.find((item) => item.path === cwd);
              if (!workspace) throw new Error(`workspace not found for ${cwd}`);
              const created = await ctx.sessions.create({ workspaceId: workspace.workspaceId });
              const sessionId = typeof created === "string" ? created : (created && created.value && created.value.sessionId) || (created && created.sessionId);
              if (!sessionId) throw new Error("session create returned no id");
              return sessionId;
            } catch (error) {
              logStore.add({ level: "error", source: "new-chat", message: error && error.message || "new chat failed", stack: error && error.stack, context: { cwd } });
              return null;
            }
          },
        };
        ctx.slots.inject("main", function* () {
          yield ctx.slots.register({ name: "main", key: "topic-wall", locale: NS, inject: () => injected }, WallPage);
        });
        ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
          name: "sidebar.panellist", id: "topic-wall", order: 4, label: () => t("panel"), locale: NS,
        }, TopicWallIcon));
      },
    };
  },
});

// autoreload test

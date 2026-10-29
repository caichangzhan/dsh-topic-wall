import net from "node:net";

const GUARD_FLAG = "__dshTopicWallTosGuard";
const TOS_PATCH_FLAG = "__dshTopicWallTosPatched";

function isTypeOfServiceEINVAL(error) {
  const text = String((error && (error.stack || error.message)) || error || "");
  return text.includes("setTypeOfService") && text.includes("EINVAL");
}

function logSuppressed() {
  console.warn("[dsh-topic-wall] suppressed benign undici setTypeOfService EINVAL");
}

/**
 * Host half: the Electron main process can crash on macOS when undici marks an
 * outbound HTTP/1.1 socket with an advisory IP TOS value and the kernel rejects
 * it with EINVAL. Prefer Node's capture callback (which replaces the default
 * uncaught handler, including Electron's crash dialog); fall back to an
 * uncaughtException listener when a callback is already installed.
 *
 * Only this exact error is swallowed. Everything else is rethrown / forwarded
 * so genuine failures keep their normal behavior.
 */
function patchTypeOfService() {
  const proto = net.Socket && net.Socket.prototype;
  if (!proto || proto[TOS_PATCH_FLAG]) return;
  const original = proto.setTypeOfService;
  if (typeof original !== "function") return;
  try {
    Object.defineProperty(proto, "setTypeOfService", {
      configurable: true,
      writable: true,
      value: function patchedTypeOfService(...args) {
        try {
          return original.apply(this, args);
        } catch (error) {
          if (error && error.code === "EINVAL" && String(error.stack || "").includes("setTypeOfService")) {
            console.warn("[dsh-topic-wall] ignored advisory setTypeOfService EINVAL");
            return;
          }
          throw error;
        }
      },
    });
    proto[TOS_PATCH_FLAG] = true;
  } catch {
    // The prototype may be frozen; the uncaught guard below remains the fallback.
  }
}

export function apply() {
  // Workaround for a DSH/Node undici bug on macOS/Electron. Enabled by default
  // because the failure is an uncaught main-process exception dialog; set
  // DSH_TOPIC_WALL_TOS_GUARD=0 to disable the monkey-patch explicitly.
  if (typeof process === "undefined" || process.env.DSH_TOPIC_WALL_TOS_GUARD === "0") return;
  patchTypeOfService();
  if (process[GUARD_FLAG]) return;
  process[GUARD_FLAG] = true;

  if (typeof process.setUncaughtExceptionCaptureCallback === "function") {
    try {
      process.setUncaughtExceptionCaptureCallback((error) => {
        if (isTypeOfServiceEINVAL(error)) {
          logSuppressed();
          return;
        }
        process.setUncaughtExceptionCaptureCallback(null);
        process.nextTick(() => { throw error; });
      });
      return;
    } catch {
      // A capture callback is already installed; fall through to the listener.
    }
  }

  const previous = process.listeners("uncaughtException");
  process.on("uncaughtException", (error) => {
    if (isTypeOfServiceEINVAL(error)) {
      logSuppressed();
      return;
    }
    if (previous.length === 0) {
      process.nextTick(() => { throw error; });
      return;
    }
    for (const listener of previous) {
      try { listener(error); } catch {}
    }
  });
}

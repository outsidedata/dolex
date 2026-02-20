/**
 * MCP App HTML shell for Dolex chart viewer.
 *
 * A minimal HTML page served as a `ui://dolex/chart.html` resource.
 * It connects to the MCP Apps host via a lightweight JSON-RPC 2.0 bridge
 * and renders charts by receiving pre-built HTML in `structuredContent.html`.
 *
 * The shell is loaded once by the host, cached, and reused for each tool call.
 * Chart data arrives dynamically via the MCP Apps notification protocol.
 */

/** Chart viewer resource URI used by both the tool and the resource. */
export const CHART_RESOURCE_URI = 'ui://dolex/chart.html';

/** Returns the complete HTML string for the MCP App shell. */
export function getAppShellHtml(): string {
  return APP_SHELL_HTML;
}

// ─── SHELL HTML ──────────────────────────────────────────────────────────────

const APP_SHELL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dolex Chart</title>
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: #0f1117; color: #d1d5db;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
#root {
  width: 100%; min-height: 120px;
  display: flex; align-items: center; justify-content: center;
}
#chart-frame {
  width: 100%; height: 100%; border: none;
}
.status { text-align: center; padding: 24px; }
.status-text {
  font-size: 13px; color: #9ca3af; line-height: 1.5;
}
.status-detail {
  font-size: 11px; color: #6b7280; margin-top: 8px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  max-width: 400px; word-break: break-word;
}
.error-text { color: #ef4444; }
.spinner {
  width: 24px; height: 24px; margin: 0 auto 12px;
  border: 2px solid #374151; border-top-color: #3366AA;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div id="root">
  <div class="status">
    <div class="spinner"></div>
    <div class="status-text">Connecting to host...</div>
  </div>
</div>

<script>
// ─── MINIMAL MCP APPS BRIDGE ────────────────────────────────────────────────
// Implements the JSON-RPC 2.0 / MCP Apps protocol subset needed to:
//   1. Initialize with the host (handshake)
//   2. Receive tool input + results
//   3. Display pre-rendered chart HTML via srcdoc iframe
//
// This is intentionally minimal (~80 lines) to avoid bundling the full
// ext-apps SDK (319KB). It handles the core happy path; the host manages
// error recovery and retries.
(function() {
  var msgId = 1;
  var pending = {};

  function post(data) {
    try { window.parent.postMessage(data, '*'); } catch(e) {}
  }

  function request(method, params) {
    var id = msgId++;
    return new Promise(function(resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      post({ jsonrpc: '2.0', id: id, method: method, params: params || {} });
    });
  }

  function notify(method, params) {
    post({ jsonrpc: '2.0', method: method, params: params || {} });
  }

  function respond(id, result) {
    post({ jsonrpc: '2.0', id: id, result: result || {} });
  }

  // ── Message Router ─────────────────────────────────────────────────────────

  window.addEventListener('message', function(event) {
    var msg = event.data;
    if (!msg || msg.jsonrpc !== '2.0') return;

    // Response to our request
    if (msg.id != null && 'result' in msg) {
      var p = pending[msg.id];
      if (p) { delete pending[msg.id]; p.resolve(msg.result); }
      return;
    }
    if (msg.id != null && 'error' in msg) {
      var p2 = pending[msg.id];
      if (p2) { delete pending[msg.id]; p2.reject(msg.error); }
      return;
    }

    // Request from host (respond immediately)
    if (msg.id != null && msg.method) {
      if (msg.method === 'ui/resource-teardown' || msg.method === 'ping') {
        respond(msg.id, {});
      }
      return;
    }

    // Notification from host
    if (msg.method && msg.id == null) {
      switch (msg.method) {
        case 'ui/notifications/tool-result':
          onToolResult(msg.params); break;
        case 'ui/notifications/tool-input':
          onToolInput(msg.params); break;
        case 'ui/notifications/tool-input-partial':
          showStatus('loading', 'Receiving data...'); break;
        case 'ui/notifications/tool-cancelled':
          showStatus('cancelled', 'Visualization cancelled'); break;
      }
    }
  });

  // ── Event Handlers ─────────────────────────────────────────────────────────

  function onToolInput(params) {
    var args = params.arguments || {};
    var rows = args.data ? args.data.length : 0;
    showStatus('loading',
      'Analyzing ' + rows + ' row' + (rows !== 1 ? 's' : '') + '...',
      args.intent || null);
  }

  function onToolResult(params) {
    if (params.isError) {
      var msg = 'Visualization failed';
      if (params.content) {
        for (var i = 0; i < params.content.length; i++) {
          if (params.content[i].type === 'text') { msg = params.content[i].text; break; }
        }
      }
      showStatus('error', msg);
      return;
    }

    // Primary path: pre-rendered chart HTML in structuredContent
    var sc = params.structuredContent;
    if (sc && sc.html) {
      displayChart(sc.html);
      return;
    }

    // Fallback: show the text content as formatted JSON
    if (params.content) {
      for (var i = 0; i < params.content.length; i++) {
        if (params.content[i].type === 'text') {
          showStatus('info', 'Chart data received',
            params.content[i].text.substring(0, 300));
          return;
        }
      }
    }
    showStatus('error', 'No chart data in tool result');
  }

  // ── Display ────────────────────────────────────────────────────────────────

  var MIN_HEIGHT = 120;
  var MAX_HEIGHT = 1200;
  var DEFAULT_HEIGHT = 500;

  function displayChart(html) {
    var root = document.getElementById('root');
    root.style.display = 'block';
    root.innerHTML = '';

    var isDashboard = html.indexOf('dashboard-grid') !== -1;
    var isCompound = html.indexOf('compound-container') !== -1;
    var initialHeight = isDashboard ? 900 : isCompound ? 700 : DEFAULT_HEIGHT;

    var iframe = document.createElement('iframe');
    iframe.id = 'chart-frame';
    iframe.style.cssText = 'width:100%;border:none;height:' + initialHeight + 'px;';
    iframe.srcdoc = html;
    root.appendChild(iframe);

    root.style.height = initialHeight + 'px';
    notify('ui/notifications/size-changed', { height: initialHeight });

    iframe.addEventListener('load', function() {
      try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        var measured = doc.documentElement.scrollHeight || doc.body.scrollHeight;
        if (measured > 0) {
          var h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, measured));
          iframe.style.height = h + 'px';
          root.style.height = h + 'px';
          notify('ui/notifications/size-changed', { height: h });
        }
      } catch(e) {}
    });

    window.addEventListener('message', function(event) {
      var msg = event.data;
      if (msg && msg.type === 'dolex-resize' && typeof msg.height === 'number') {
        var h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, msg.height));
        iframe.style.height = h + 'px';
        root.style.height = h + 'px';
        notify('ui/notifications/size-changed', { height: h });
      }
    });
  }

  function showStatus(type, message, detail) {
    var root = document.getElementById('root');
    var cls = type === 'error' ? ' error-text' : '';
    root.innerHTML =
      '<div class="status">' +
      (type === 'loading' ? '<div class="spinner"></div>' : '') +
      '<div class="status-text' + cls + '">' + esc(message) + '</div>' +
      (detail ? '<div class="status-detail">' + esc(detail) + '</div>' : '') +
      '</div>';
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  showStatus('loading', 'Connecting to host...');

  request('ui/initialize', {
    protocolVersion: '2026-01-26',
    appInfo: { name: 'Dolex', version: '0.1.0' },
    appCapabilities: {}
  }).then(function() {
    notify('ui/notifications/initialized', {});
    showStatus('loading', 'Ready — waiting for data...');
  }).catch(function(err) {
    showStatus('error', 'Failed to connect', String(err.message || err));
  });
})();
<\/script>
</body>
</html>`;

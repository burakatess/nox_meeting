import { app, session } from 'electron';

/**
 * Runtime Zero-Internet (spec §2, §7.4): Chromium'un kendiliğinden dış bağlantı kuran
 * özelliklerini kapatır. app 'ready' olmadan ÖNCE çağrılmalıdır.
 */
export function applyChromiumSwitches() {
  const sw = app.commandLine;
  sw.appendSwitch('disable-background-networking');
  sw.appendSwitch('disable-component-update');
  sw.appendSwitch('disable-domain-reliability');
  sw.appendSwitch('disable-breakpad');
  sw.appendSwitch('disable-sync');
  sw.appendSwitch('disable-default-apps');
  sw.appendSwitch('no-pings');
  sw.appendSwitch('no-default-browser-check');
  sw.appendSwitch('dns-prefetch-disable');
  sw.appendSwitch('disable-features', 'OptimizationHints,MediaRouter,Translate,NetworkPrediction');
}

/** Renderer'dan çıkan tüm istekler allow-list'e tabidir; API çağrıları main sürecinden yapılır. */
export function installEgressGuard() {
  const devOrigin = process.env.ELECTRON_RENDERER_URL ? new URL(process.env.ELECTRON_RENDERER_URL) : null;
  const local = new Set(['file:', 'data:', 'blob:', 'devtools:', 'chrome-extension:']);

  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    let allow = false;
    try {
      const u = new URL(details.url);
      allow = local.has(u.protocol) || (!!devOrigin && u.host === devOrigin.host && ['http:', 'ws:'].includes(u.protocol));
    } catch {
      allow = false;
    }
    if (!allow) console.warn(`[egress-guard] engellendi: ${details.url}`);
    cb({ cancel: !allow });
  });

  // Sertifika/medya/bildirim izinleri varsayılan olarak kapalı; toplantı modülü (M4) kontrollü açacak.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
          ],
        },
      });
    });
  }
}

export function lockDownWebContents() {
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (e, url) => {
      const dev = process.env.ELECTRON_RENDERER_URL;
      if (!(dev && url.startsWith(dev))) e.preventDefault();
    });
    contents.on('will-attach-webview', (e) => e.preventDefault());
  });
}

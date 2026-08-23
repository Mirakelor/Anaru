#!/usr/bin/env python3
"""Load the app's frontend in system WebKit, capture JS errors via injection."""
import gi, sys, time
gi.require_version('WebKit2', '4.1')
gi.require_version('Gtk', '3.0')
from gi.repository import WebKit2, GLib, Gtk

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'

INJECT = r"""
window.__errs = [];
window.onerror = (msg, src, line, col, err) => {
  window.__errs.push('err: ' + msg + ' @' + src + ':' + line + ':' + col + ' ' + (err && err.stack ? err.stack.split('\n').slice(0,4).join(' | ') : ''));
  return false;
};
const origError = console.error;
console.error = (...args) => { window.__errs.push('console.error: ' + args.join(' ').slice(0, 400)); origError.apply(console, args); };
const origLog = console.log;
console.log = (...args) => { window.__errs.push('log: ' + args.join(' ').slice(0, 300)); origLog.apply(console, args); };
document.title = 'READY';
"""

def on_load_changed(view, ev):
    if ev == WebKit2.LoadEvent.FINISHED:
        print('LOAD FINISHED', flush=True)

win = Gtk.Window()
win.set_default_size(480, 900)
view = WebKit2.WebView(web_context=WebKit2.WebContext.get_default())
view.connect('load-changed', on_load_changed)
win.add(view)
win.show_all()
view.load_uri(URL)

def inject():
    view.run_javascript(INJECT, None, lambda *a: print('injected', flush=True))
    return False

def poll():
    view.run_javascript('document.title + "||" + (window.__errs ? window.__errs.join("\\n") : "no-errs") + "||BODY:" + (document.body ? document.body.innerText.slice(0, 400).replace(/\\n/g, " / ") : "no-body")', None, on_result)
    return True

def on_result(view, res):
    try:
        js = view.run_javascript_finish(res)
        val = js.get_js_value().to_string()
        title, _, rest = val.partition('||')
        errs, _, body = rest.partition('||BODY:')
        if title != 'READY' and title:
            print('title:', title[:100], flush=True)
        if errs and errs != 'no-errs':
            print('ERRORS:\n' + errs, flush=True)
        print('BODY:', body[:300], flush=True)
    except Exception as e:
        print('poll err:', e, flush=True)

GLib.timeout_add(3000, inject)
GLib.timeout_add(1500, poll)
GLib.timeout_add(30000, lambda: (print('TIMEOUT'), sys.exit(1)))
GLib.MainLoop().run()

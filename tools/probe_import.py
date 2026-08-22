#!/usr/bin/env python3
"""Probe v2: same as v1 but with a realized GTK window (mirrors the app)."""
import gi, os, sys, time
from urllib.parse import quote
gi.require_version('WebKit2', '4.1')
gi.require_version('Gtk', '3.0')
from gi.repository import WebKit2, GLib, Gtk

MANIFEST = 'https://bb.sonder.eu.org/manifest.json'
BASE = 'https://bb.sonder.eu.org/'

JS = r"""
const log = (m) => { (window.__logs || (window.__logs = [])).push(String(m)); document.title = 'PROBE:' + window.__logs.join('|'); };
const heartbeat = setInterval(() => { const e = document.createElement('i'); e.remove(); }, 2000); // prove the loop is alive
const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const fetchText = async (url) => {
  const r = await timeout(fetch(url), 20000);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.text();
};
const probeDurationUrl = (url) => new Promise((resolve) => {
  const video = document.createElement('video');
  video.preload = 'metadata';
  let done = false;
  const timer = setTimeout(() => { if (!done) { done = true; log('  probe TIMEOUT'); resolve(0); } }, 8000);
  video.onloadedmetadata = () => { if (!done) { done = true; clearTimeout(timer); log('  probe ok duration=' + video.duration); resolve(Number.isFinite(video.duration) ? video.duration : 0); } };
  video.onerror = () => { if (!done) { done = true; clearTimeout(timer); log('  probe ERROR'); resolve(0); } };
  video.src = url;
});
(async () => {
  try {
    log('1.fetch manifest');
    const m = JSON.parse(await fetchText('__MANIFEST__'));
    log('  series: ' + m.series.map(s => s.title).join(', '));
    const ep = m.series[0].episodes[0];
    const subUrl = new URL(ep.subtitle, '__BASE__').toString();
    const vidUrl = new URL(ep.video, '__BASE__').toString();
    log('2.fetch subtitle');
    const sub = await fetchText(subUrl);
    log('  subtitle bytes: ' + sub.length);
    log('3.probe video');
    const dur = await probeDurationUrl(vidUrl);
    log('  duration: ' + dur);
    log('DONE');
  } catch (e) {
    log('FAIL: ' + e.message);
  }
})();
""".replace('__MANIFEST__', MANIFEST).replace('__BASE__', BASE)

def main():
    ctx = WebKit2.WebContext.get_default()
    win = Gtk.Window()
    win.set_default_size(400, 300)
    view = WebKit2.WebView(web_context=ctx)
    win.add(view)
    win.show_all()
    uri = 'data:text/html;charset=utf-8,' + quote('<script>' + JS + '</script>')
    view.load_uri(uri)
    deadline = [time.time() + 90]
    def poll():
        if time.time() > deadline[0]:
            print('PROBE TIMEOUT')
            sys.exit(1)
        title = view.get_title()
        if title and title.startswith('PROBE:'):
            print(title[6:].replace('|', '\n'))
            if title.endswith('DONE') or 'FAIL:' in title:
                sys.exit(0)
        return True
    GLib.timeout_add(400, poll)
    GLib.MainLoop().run()

if __name__ == '__main__':
    main()

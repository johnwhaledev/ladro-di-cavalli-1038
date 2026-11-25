#!/usr/bin/env python3
"""
impacchetta_mobile.py — il gioco in un file solo, da aprire sul telefono (14/10).

Aperto da file (file:// o dal file manager), il browser blocca le richieste
che il gioco fa per i suoi file: il manifest e gli atlanti, le stanze, le
musiche. Qui tutto finisce dentro una pagina sola: gli script uno dopo
l'altro, i file come data: in una tabella (`__VFS`), e uno spessore che gira
verso la tabella le richieste del gioco (fetch, img.src, new Audio). Il
carattere va dentro il CSS. Non serve un server: si apre la pagina con
Chrome, anche senza rete.

Uso:  python tools/impacchetta_mobile.py [cartella]   (default: out/mobile)
Scrive <cartella>/ladro1038.html.
"""
import base64
import json
import mimetypes
import os
import re
import sys

from percorsi import ROOT

TIPI = {'.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg',
        '.woff2': 'font/woff2'}

# lo spessore: le richieste del gioco verso la tabella dei file
SPESSORE = r"""(() => {
  const VFS = window.__VFS;
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const chiave = u => { let s = decodeURI(String(u)); if (s.startsWith(base)) s = s.slice(base.length);
    return s.replace(/^\.\//, '').split('?')[0]; };
  const dato = u => VFS[chiave(u)];
  const f0 = window.fetch.bind(window);
  window.fetch = (u, o) => { const d = dato(typeof u === 'string' ? u : u.url);
    return d ? f0(d) : f0(u, o); };
  for (const P of [HTMLImageElement.prototype, HTMLMediaElement.prototype]) {
    const pd = Object.getOwnPropertyDescriptor(P, 'src');
    Object.defineProperty(P, 'src', { ...pd, set(v) { pd.set.call(this, dato(v) || v); } });
  }
  const A0 = window.Audio;
  window.Audio = function (u) { const a = new A0(); if (u !== undefined) a.src = u; return a; };
  window.Audio.prototype = A0.prototype;
})();"""


def leggi(percorso):
    with open(percorso, encoding='utf-8') as f:
        return f.read()


def dato(percorso):
    est = os.path.splitext(percorso)[1].lower()
    tipo = TIPI.get(est) or mimetypes.guess_type(percorso)[0] or 'application/octet-stream'
    with open(percorso, 'rb') as f:
        return f'data:{tipo};base64,' + base64.b64encode(f.read()).decode('ascii')


def file_del_gioco():
    """assets/ (atlanti, manifest, audio) e src/stanze/: quello che il gioco chiede."""
    for radice in ('assets', os.path.join('src', 'stanze')):
        for cartella, _, nomi in os.walk(os.path.join(ROOT, radice)):
            for n in nomi:
                if os.path.splitext(n)[1].lower() in TIPI:
                    p = os.path.join(cartella, n)
                    yield os.path.relpath(p, ROOT).replace('\\', '/'), p


def main():
    uscita = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 'mobile')
    os.makedirs(uscita, exist_ok=True)
    html = leggi(os.path.join(ROOT, 'index.html'))

    # il carattere dentro il CSS
    html = re.sub(r'url\((fonts/[^)]+\.woff2)\)',
                  lambda m: f'url({dato(os.path.join(ROOT, m.group(1)))})', html)

    # gli script, nell'ordine di index.html
    lista = re.search(r'const SCRIPT = \[(.*?)\];', html, re.DOTALL).group(1)
    script = re.findall(r"'([^']+\.js)'", lista)
    pezzi = []
    for s in script:
        testo = leggi(os.path.join(ROOT, s))
        assert '</script' not in testo, s
        pezzi.append(f'<script>/* {s} */\n{testo}\n</script>')

    vfs = dict(sorted((k, dato(p)) for k, p in file_del_gioco()))
    testa = ('<script>window.__VFS = ' + json.dumps(vfs) + ';</script>\n'
             f'<script>{SPESSORE}</script>\n' + '\n'.join(pezzi) + '\n')

    # prima dello script della pagina (quello con SCRIPT), che non carica piu' niente
    i = html.index('const SCRIPT = [')
    i = html.rindex('<script>', 0, i)
    html = html[:i] + testa + html[i:]
    assert html.count('await caricaScript();') == 1
    html = html.replace('await caricaScript();',
                        "/* mobile: gli script sono gia' nella pagina */")

    dest = os.path.join(uscita, 'ladro1038.html')
    with open(dest, 'w', encoding='utf-8', newline='') as f:
        f.write(html)
    mb = os.path.getsize(dest) / 1e6
    print(f'{dest}: {len(script)} script, {len(vfs)} file dentro, {mb:.1f} MB')


if __name__ == '__main__':
    main()

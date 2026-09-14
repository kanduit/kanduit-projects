#!/usr/bin/env python3
"""
check_demo.py — rerunnable quality bar for a Kanduit portfolio demonstrator.

The skill's prose checklist is the intent. This script is the gate. It does
not research Amts or sources. It fails a demo that still looks like the
scaffold, and it fails a demo that dropped a Pflichtbaustein slot.

Usage (from repo root):
  python3 .claude/skills/build-demo/check_demo.py <slug>
  python3 .claude/skills/build-demo/check_demo.py <slug> --root /path/to/repo
  python3 .claude/skills/build-demo/check_demo.py <slug> --json

Exit 0 when there are no fail-level findings. Warnings print and still pass.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import subprocess
import sys
from collections import namedtuple

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
MAX_DATA_JS = 100_000
SCAN_NAMES = (
    "index.html",
    "app.js",
    "data.js",
    "styles.css",
    "serve.py",
    "README.md",
    "README.de.md",
    "CHANGELOG.md",
)
Finding = namedtuple("Finding", "check severity message")
Check = namedtuple("Check", "id title severity fn")


class Demo:
    def __init__(self, root, slug):
        self.root = os.path.abspath(root)
        self.slug = slug
        self.proj = os.path.join(self.root, "portfolio", slug)
        self._cache = {}

    def exists(self):
        return os.path.isdir(self.proj)

    def path(self, *parts):
        return os.path.join(self.proj, *parts)

    def read(self, rel, default=None):
        p = self.path(rel)
        if rel not in self._cache:
            if not os.path.isfile(p):
                self._cache[rel] = None
            else:
                with open(p, encoding="utf-8") as fh:
                    self._cache[rel] = fh.read()
        text = self._cache[rel]
        if text is None:
            return default
        return text

    def glob(self, sub, suffix):
        d = self.path(sub)
        if not os.path.isdir(d):
            return []
        out = []
        for name in sorted(os.listdir(d)):
            if name.endswith(suffix):
                out.append(os.path.join(d, name))
        return out


def _assign(tree, name):
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == name:
                    try:
                        return ast.literal_eval(node.value)
                    except (ValueError, TypeError):
                        return "__unliteral__"
    return None


def _metric_keys(js):
    m = re.search(r"const METRIC_INFO\s*=\s*\{", js)
    if not m:
        return []
    start = m.end() - 1
    depth = 0
    end = None
    for i, ch in enumerate(js[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end is None:
        return []
    body = js[start + 1:end]
    keys = []
    for km in re.finditer(r"(?://[^\n]*\n)|(?:/\*.*?\*/)|([A-Za-z_][\w]*)\s*:\s*\{",
                          body, re.S):
        if km.group(1):
            keys.append(km.group(1))
    return keys


def _src_note_keys(text):
    return re.findall(r'data-src="([^"]+)"', text)


def check_files(d):
    missing = [n for n in ("index.html", "app.js", "styles.css", "scripts/generate.py",
                            "scripts/publish.py") if not os.path.isfile(d.path(n))]
    if missing:
        return [f"fehlende Datei: {n}" for n in missing]
    return []


def check_todo(d):
    hits = []
    files = list(SCAN_NAMES)
    for py in d.glob("scripts", ".py"):
        files.append(os.path.relpath(py, d.proj))
    for rel in files:
        text = d.read(rel)
        if not text:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            stub = (
                re.search(r"\bTODO\b", line)
                or "{{" in line
                or re.search(r"\b(quelleKey|metricKey)\b", line)
            )
            if stub:
                hits.append(f"{rel}:{i}: {line.strip()[:120]}")
    return hits


def check_lang(d):
    html = d.read("index.html", "")
    if 'lang="de"' not in html:
        return ["index.html hat kein lang=\"de\""]
    return []


def check_footer(d):
    html = d.read("index.html", "")
    missing = []
    if "Kanduit UG" not in html:
        missing.append("Footer nennt Kanduit UG nicht")
    if "kein Produkt" not in html:
        missing.append("Footer enthält nicht „kein Produkt der …“")
    return missing


def check_leitzahl(d):
    html = d.read("index.html", "")
    js = d.read("app.js", "")
    out = []
    if not re.search(r'id="leitzahl"', html):
        out.append("Überblick hat kein #leitzahl")
    if "#leitzahl" not in js and "leitzahl" not in js:
        out.append("app.js füllt #leitzahl nicht")
    if re.search(r"\$\(['\"]#leitzahl['\"]\)[\s\S]{0,800}TODO", js):
        out.append("Leitzahl ist noch der Scaffold-TODO")
    return out


def _leitzahl_copy(js):
    chunks = []
    m = re.search(r"\bleitzahl\s*:\s*\{([^}]*)\}", js)
    if m:
        chunks.append(m.group(1))
    m = re.search(
        r"\$\(['\"]#leitzahl['\"]\)\.innerHTML\s*=\s*[`'\"]([\s\S]*?)[`'\"]",
        js)
    if m:
        chunks.append(m.group(1))
    return "\n".join(chunks)


def check_leitzahl_frist(d):
    js = d.read("app.js", "")
    copy = _leitzahl_copy(js)
    if not copy:
        return ["keine Leitzahl, daher keine Frist"]
    if not re.search(
            r"(Frist|fällig|Fälligkeit|sonst |verfällt|verfaellt|"
            r"mindestens)",
            copy):
        return ["Leitzahl-Text nennt keine Frist oder Konsequenz"]
    return []


def _info_keys(html, js):
    keys = set(re.findall(r'data-info="([^"]+)"', html + js))
    keys.update(re.findall(r"infoIcon\('([^']+)'\)", js))
    keys.update(re.findall(r'infoIcon\("([^"]+)"\)', js))
    keys.update(re.findall(r"""info:\s*['"]([^'"]+)""", js))
    keys = {k for k in keys if k not in ("metricKey",) and not k.startswith("$")}
    return keys


def check_metric_info(d):
    js = d.read("app.js", "")
    keys = _metric_keys(js)
    if not keys:
        return ["METRIC_INFO ist leer"]
    gap = re.compile(
        r"Datenlücke|Datenluecke|Untergrenze|nicht offen|fehlt|"
        r"schematisch|Annahme|Einschränkung", re.I)
    m = re.search(r"const METRIC_INFO\s*=\s*\{", js)
    body = js
    if m:
        start = m.end() - 1
        depth = 0
        for i, ch in enumerate(js[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    body = js[start:i + 1]
                    break
    if not gap.search(body):
        return ["METRIC_INFO nennt keine Datenlücke"]
    return []


def check_info_icons(d):
    html = d.read("index.html", "")
    js = d.read("app.js", "")
    used = _info_keys(html, js)
    if not used:
        return ["kein ⓘ (infoIcon / data-info)"]
    known = set(_metric_keys(js))
    missing = sorted(used - known)
    if missing:
        return [f"data-info ohne METRIC_INFO: {', '.join(missing)}"]
    return []


def check_src_notes(d):
    html = d.read("index.html", "")
    js = d.read("app.js", "")
    keys = _src_note_keys(html) + _src_note_keys(js)
    real = [k for k in keys if k not in ("quelleKey", "key")]
    if not real:
        return ["keine Quellenzeile (.src-note mit data-src) unter den Karten"]
    return []


def check_src_keys(d):
    html = d.read("index.html", "")
    js = d.read("app.js", "")
    gen = d.read("scripts/generate.py", "")
    keys = set(_src_note_keys(html) + _src_note_keys(js))
    keys.discard("quelleKey")
    keys.discard("key")
    if not keys:
        return []
    try:
        tree = ast.parse(gen)
    except SyntaxError as e:
        return [f"generate.py ist kein gültiges Python: {e}"]
    quellen = _assign(tree, "QUELLEN")
    if quellen in (None, "__unliteral__"):
        return ["QUELLEN in generate.py nicht als Literal lesbar"]
    missing = sorted(k for k in keys if k not in quellen)
    if missing:
        return [f"data-src ohne QUELLEN-Eintrag: {', '.join(missing)}"]
    return []


def check_view_daten(d):
    html = d.read("index.html", "")
    if 'id="view-daten"' not in html:
        return ["Ansicht Daten & Methode fehlt (view-daten)"]
    return []


def check_registerabgleich(d):
    blob = d.read("index.html", "") + d.read("app.js", "")
    if "Registerabgleich" not in blob and "registerabgleich" not in blob.lower():
        return ["keine Karte Registerabgleich"]
    if "TODO Registerabgleich" in blob:
        return ["Registerabgleich ist noch der Scaffold-TODO"]
    return []


def check_gegenprobe(d):
    blob = d.read("index.html", "") + d.read("app.js", "")
    if not re.search(r"Gegenprobe|backtest|Rückrechnung|rueckrechnung", blob, re.I):
        return ["keine Karte Gegenprobe / Rückrechnung"]
    if "TODO Gegenprobe" in blob:
        return ["Gegenprobe ist noch der Scaffold-TODO"]
    return []


def check_annahmen(d):
    gen = d.read("scripts/generate.py", "")
    js = d.read("app.js", "")
    try:
        tree = ast.parse(gen)
    except SyntaxError as e:
        return [f"generate.py ist kein gültiges Python: {e}"]
    ann = _assign(tree, "ANNAHMEN")
    if ann == "__unliteral__":
        return ["ANNAHMEN in generate.py nicht als Literal lesbar"]
    if not ann:
        if "annahmen-liste" not in (d.read("index.html", "") + js):
            return ["kein Annahmen-Register (ANNAHMEN leer und keine annahmen-liste)"]
        return []
    if "assumeMark(" not in js:
        return ["ANNAHMEN gesetzt, aber app.js ruft assumeMark nicht auf"]
    return []


def check_quellen(d):
    gen = d.read("scripts/generate.py", "")
    try:
        tree = ast.parse(gen)
    except SyntaxError as e:
        return [f"generate.py ist kein gültiges Python: {e}"]
    quellen = _assign(tree, "QUELLEN")
    if not quellen or quellen == "__unliteral__":
        return ["QUELLEN in generate.py ist leer"]
    bad = []
    for k, v in quellen.items():
        if not isinstance(v, dict) or "t" not in v or "u" not in v:
            bad.append(k)
            continue
        if not str(v["u"]).startswith("http"):
            bad.append(f"{k} ohne http-URL")
    if bad:
        return [f"QUELLEN unvollständig: {', '.join(bad)}"]
    return []


def check_generate_stub(d):
    gen = d.read("scripts/generate.py", "")
    if "TODO: Aggregation implementieren" in gen:
        return ["generate.py ist noch der Scaffold-Stub"]
    return []


def check_snapshots(d):
    files = [p for p in d.glob("data/sources", ".json")
             if os.path.getsize(p) > 2]
    if not files:
        return ["keine Snapshots in data/sources/*.json"]
    return []


def check_fetch(d):
    if not d.glob("scripts", ".py"):
        return ["kein scripts/*.py"]
    fetches = [p for p in d.glob("scripts", ".py")
               if os.path.basename(p).startswith("fetch_")]
    if not fetches:
        return ["kein scripts/fetch_<quelle>.py"]
    return []


def check_data_js_size(d):
    p = d.path("data.js")
    if not os.path.isfile(p):
        return ["data.js fehlt — generate.py ausführen"]
    n = os.path.getsize(p)
    if n > MAX_DATA_JS:
        return [f"data.js ist {n} Bytes (Grenze {MAX_DATA_JS})"]
    return []


def check_generate_twice(d):
    gen = d.path("scripts/generate.py")
    js = d.path("data.js")
    if not os.path.isfile(gen):
        return ["scripts/generate.py fehlt"]
    existed = os.path.isfile(js)
    backup = None
    if existed:
        with open(js, "rb") as fh:
            backup = fh.read()
    env = os.environ.copy()
    env["PYTHONHASHSEED"] = "0"
    runs = []
    try:
        for _ in range(2):
            proc = subprocess.run(
                [sys.executable, gen],
                cwd=d.proj,
                capture_output=True,
                text=True,
                env=env,
            )
            if proc.returncode != 0:
                err = (proc.stderr or proc.stdout or "").strip().splitlines()
                tail = err[-1] if err else f"exit {proc.returncode}"
                return [f"generate.py exit {proc.returncode}: {tail}"]
            if not os.path.isfile(js):
                return ["generate.py schrieb keine data.js"]
            with open(js, "rb") as fh:
                runs.append(hashlib.sha256(fh.read()).hexdigest())
        if runs[0] != runs[1]:
            return [f"generate.py ist nicht deterministisch ({runs[0][:12]} ≠ {runs[1][:12]})"]
        return []
    finally:
        if existed:
            with open(js, "wb") as fh:
                fh.write(backup)
        elif os.path.isfile(js):
            os.remove(js)


def check_publish(d):
    pub = d.path("scripts/publish.py")
    if not os.path.isfile(pub):
        return ["scripts/publish.py fehlt"]
    proc = subprocess.run(
        [sys.executable, pub, "--check"],
        cwd=d.proj,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        msg = (proc.stdout or proc.stderr or "").strip().splitlines()
        return [msg[0] if msg else "publish.py --check exit 1"]
    return []


def check_landing(d):
    idx = os.path.join(d.root, "docs", "index.html")
    if not os.path.isfile(idx):
        return ["docs/index.html fehlt"]
    with open(idx, encoding="utf-8") as fh:
        html = fh.read()
    needle = f'href="./{d.slug}/"'
    if needle not in html:
        return [f"Landing-Karte fehlt ({needle})"]
    return []


def check_readme_bullet(d):
    p = os.path.join(d.root, "README.md")
    if not os.path.isfile(p):
        return ["Root-README.md fehlt"]
    with open(p, encoding="utf-8") as fh:
        text = fh.read()
    if f"portfolio/{d.slug}" not in text:
        return [f"Root-README hat kein Bullet portfolio/{d.slug}"]
    return []


def _workflows(d):
    wdir = os.path.join(d.root, ".github", "workflows")
    if not os.path.isdir(wdir):
        return []
    hits = []
    for name in sorted(os.listdir(wdir)):
        if not name.endswith((".yml", ".yaml")):
            continue
        path = os.path.join(wdir, name)
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        if d.slug in text:
            hits.append((name, text))
    return hits


def check_workflow(d):
    hits = _workflows(d)
    if not hits:
        return [f"kein CI-Workflow erwähnt {d.slug}"]
    if not any("publish.py --check" in text for _n, text in hits):
        return ["CI ruft publish.py --check nicht auf"]
    return []


def check_workflow_bar(d):
    hits = _workflows(d)
    if hits and not any("check_demo.py" in text for _n, text in hits):
        return ["CI ruft check_demo.py nicht auf"]
    return []


def check_cards_have_notes(d):
    html = d.read("index.html", "")
    missing = []
    for i, part in enumerate(re.split(r'<div class="card(?=["\s>])', html)[1:], 1):
        if "annahmen-liste" in part:
            continue
        if "src-note" not in part:
            title = re.search(r'card-title">([^<]+)', part)
            missing.append(title.group(1).strip()[:40] if title else f"Karte {i}")
    if missing:
        return ["Karte ohne Quellenzeile: " + ", ".join(missing)]
    return []


CHECKS = [
    Check("files", "Pflicht-Dateien", "fail", check_files),
    Check("todo", "keine Scaffold-Reste", "fail", check_todo),
    Check("lang", "lang=de", "fail", check_lang),
    Check("footer", "Footer-Disclaimer", "fail", check_footer),
    Check("leitzahl", "Leitzahl-Slot", "fail", check_leitzahl),
    Check("leitzahl_frist", "Leitzahl mit Frist", "warn", check_leitzahl_frist),
    Check("metric_info", "METRIC_INFO", "fail", check_metric_info),
    Check("info_icons", "ⓘ an Kennzahlen", "fail", check_info_icons),
    Check("src_notes", "Quellenzeile unter Karten", "fail", check_src_notes),
    Check("src_keys", "data-src in QUELLEN", "fail", check_src_keys),
    Check("view_daten", "Daten & Methode", "fail", check_view_daten),
    Check("registerabgleich", "Registerabgleich", "fail", check_registerabgleich),
    Check("gegenprobe", "Gegenprobe", "fail", check_gegenprobe),
    Check("annahmen", "Annahmen-Register", "fail", check_annahmen),
    Check("quellen", "QUELLEN", "fail", check_quellen),
    Check("generate_stub", "generate.py implementiert", "fail", check_generate_stub),
    Check("snapshots", "Snapshots", "fail", check_snapshots),
    Check("fetch", "fetch-Skript", "fail", check_fetch),
    Check("data_js_size", "data.js < 100 KB", "fail", check_data_js_size),
    Check("generate_twice", "generate.py deterministisch", "fail", check_generate_twice),
    Check("publish", "docs/ in sync", "fail", check_publish),
    Check("landing", "Landing-Karte", "fail", check_landing),
    Check("readme_bullet", "Root-README-Bullet", "fail", check_readme_bullet),
    Check("workflow", "CI-Workflow", "fail", check_workflow),
    Check("workflow_bar", "CI ruft check_demo.py", "warn", check_workflow_bar),
    Check("cards_notes", "Karten ohne Quellenzeile", "fail", check_cards_have_notes),
]


def inspect(root, slug):
    d = Demo(root, slug)
    findings = []
    if not d.exists():
        findings.append(Finding("files", "fail", f"portfolio/{slug}/ existiert nicht"))
        return findings
    for chk in CHECKS:
        try:
            msgs = chk.fn(d) or []
        except Exception as e:
            msgs = [f"Check stürzte ab: {type(e).__name__}: {e}"]
        for msg in msgs:
            findings.append(Finding(chk.id, chk.severity, msg))
    return findings


def format_report(slug, findings):
    fails = [f for f in findings if f.severity == "fail"]
    warns = [f for f in findings if f.severity == "warn"]
    lines = [f"check_demo {slug}: {len(fails)} fail, {len(warns)} warn"]
    for f in findings:
        lines.append(f"  {f.severity.upper():4} {f.check}: {f.message}")
    if not findings:
        lines.append("  ok")
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--root", default=DEFAULT_ROOT)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--list", action="store_true", help="print check ids and exit")
    args = ap.parse_args(argv)
    if args.list:
        for chk in CHECKS:
            print(f"{chk.id}\t{chk.severity}\t{chk.title}")
        return 0
    if not args.slug:
        ap.error("slug required")
    if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", args.slug):
        sys.exit(f"check_demo: slug '{args.slug}' ist ungültig")
    findings = inspect(args.root, args.slug)
    if args.json:
        print(json.dumps(
            [{"check": f.check, "severity": f.severity, "message": f.message}
             for f in findings],
            ensure_ascii=False, indent=2))
    else:
        sys.stdout.write(format_report(args.slug, findings))
    return 1 if any(f.severity == "fail" for f in findings) else 0


if __name__ == "__main__":
    sys.exit(main())

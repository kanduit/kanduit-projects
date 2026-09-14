#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
CHECK = os.path.join(HERE, "check_demo.py")
SCAFFOLD = os.path.join(HERE, "scaffold.py")
PY = sys.executable


def run_check(root, slug):
    proc = subprocess.run(
        [PY, CHECK, slug, "--root", root, "--json"],
        capture_output=True,
        text=True,
    )
    findings = json.loads(proc.stdout) if proc.stdout.strip().startswith("[") else []
    return proc.returncode, findings


def fail_ids(findings):
    return {f["check"] for f in findings if f["severity"] == "fail"}


COMPLETE_GENERATE = r'''
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "sources")
QUELLEN = {
    "amt": {"t": "Open Data Beispiel", "u": "https://example.invalid/data.csv"},
}
ANNAHMEN = [
    {"k": "demo", "t": "Demo-Groesse",
     "d": "Demo-Annahme. Warum angenommen, wie gebildet, wodurch im Projekt zu ersetzen."},
]

def write_data_js(payload):
    out = os.path.join(ROOT, "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("window.KANDUIT_TEST = " +
                 json.dumps(payload, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":")) + ";\n")

def main():
    path = os.path.join(SRC, "sample.json")
    with open(path, encoding="utf-8") as fh:
        snap = json.load(fh)
    payload = {
        "meta": {"stand": snap["fetched"], "quellen": QUELLEN},
        "annahmen": ANNAHMEN,
        "n": snap["n"],
    }
    write_data_js(payload)

if __name__ == "__main__":
    main()
'''

COMPLETE_APP = r'''(function () {
"use strict";
const DATA = window.KANDUIT_TEST;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const METRIC_INFO = {
  leitzahl: { t: 'Leitzahl', d: 'Mindestens 3 Faelle bis 2027, sonst verfaellt die Frist. Datenluecke: Amtsregister fehlt.' },
  chart: { t: 'Bestand', d: 'Zaehlt Snapshots. Nur die offene Liste — Untergrenze.' },
};
function infoIcon(key) {
  return METRIC_INFO[key]
    ? ` <span class="info-i" data-info="${key}" tabindex="0" role="button">i</span>`
    : '';
}
function verdrahteQuellen() {
  $$('.src-note').forEach(n => {
    const s = DATA.meta.quellen[n.dataset.src];
    if (s) n.textContent = s.t;
  });
}
function assumeMark(key) { return ' ◈'; }
function renderOverview() {
  $('#leitzahl').innerHTML = `
    <div class="k">Leitzahl${infoIcon('leitzahl')}${assumeMark('demo')}</div>
    <div class="v">3</div>
    <div class="d"><b>Mindestens 3 Faelle bis 2027, sonst verfaellt Foerdergeld.</b></div>`;
}
function renderDaten() {
  $('#annahmen-liste').textContent = DATA.annahmen[0].d;
}
renderOverview();
renderDaten();
verdrahteQuellen();
})();
'''

COMPLETE_HTML = '''<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>Test-Monitor</title></head>
<body>
<main>
<section class="view active" id="view-overview">
  <div class="leitzahl" id="leitzahl"></div>
  <div class="card">
    <div class="card-title">Bestand</div>
    <p class="note src-note" data-src="amt"></p>
  </div>
</section>
<section class="view" id="view-daten">
  <div class="card">
    <div class="card-title">Registerabgleich</div>
    <p class="note src-note" data-src="amt"></p>
  </div>
  <div class="card">
    <div class="card-title">Gegenprobe an der Vergangenheit</div>
    <p class="note src-note" data-src="amt"></p>
  </div>
  <div id="annahmen-liste"></div>
</section>
</main>
<footer class="footer">
  <p>Demonstrator der Kanduit UG — kein Produkt der Stadt Test, Stand 01.01.2026.</p>
</footer>
<script src="data.js"></script>
<script src="app.js"></script>
</body>
</html>
'''

COMPLETE_PUBLISH = r'''
import filecmp, os, shutil, sys
DEPLOY_FILES = ["index.html", "app.js", "styles.css", "data.js"]
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(SRC))
DEST = os.path.join(REPO, "docs", os.path.basename(SRC))

def main():
    check_only = "--check" in sys.argv[1:]
    os.makedirs(DEST, exist_ok=True)
    changed = []
    for name in DEPLOY_FILES:
        src = os.path.join(SRC, name)
        dst = os.path.join(DEST, name)
        if not os.path.isfile(src):
            sys.exit("missing " + name)
        if not (os.path.isfile(dst) and filecmp.cmp(src, dst, shallow=False)):
            changed.append(name)
            if not check_only:
                shutil.copy2(src, dst)
    if check_only:
        if changed:
            print("OUT OF SYNC")
            sys.exit(1)
        print("in sync")
        return
    print("published")

if __name__ == "__main__":
    main()
'''

COMPLETE_WORKFLOW = """name: test-monitor check
on: [push]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: python3 portfolio/test-monitor/scripts/publish.py --check
      - run: python3 .claude/skills/build-demo/check_demo.py test-monitor
"""


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def build_complete(root, slug="test-monitor"):
    proj = os.path.join(root, "portfolio", slug)
    os.makedirs(os.path.join(proj, "data", "sources"), exist_ok=True)
    os.makedirs(os.path.join(proj, "scripts"), exist_ok=True)
    write(os.path.join(proj, "index.html"), COMPLETE_HTML)
    write(os.path.join(proj, "app.js"), COMPLETE_APP)
    write(os.path.join(proj, "styles.css"), "body{}\n")
    write(os.path.join(proj, "serve.py"), "PORT=8123\n")
    write(os.path.join(proj, "README.md"), "Test-Monitor\n")
    write(os.path.join(proj, "README.de.md"), "Test-Monitor\n")
    write(os.path.join(proj, "CHANGELOG.md"), "2026-01-01\n")
    write(os.path.join(proj, "scripts", "generate.py"), COMPLETE_GENERATE)
    write(os.path.join(proj, "scripts", "publish.py"), COMPLETE_PUBLISH)
    write(os.path.join(proj, "scripts", "fetch_amt.py"),
          "#!/usr/bin/env python3\n")
    write(os.path.join(proj, "data", "sources", "sample.json"),
          '{"fetched": "01.01.2026", "n": 3, "url": "https://example.invalid/data.csv"}\n')
    subprocess.check_call([PY, os.path.join(proj, "scripts", "generate.py")], cwd=proj)
    subprocess.check_call([PY, os.path.join(proj, "scripts", "publish.py")], cwd=proj)
    write(os.path.join(root, "docs", "index.html"),
          f'<article><a href="./{slug}/">Projekt oeffnen</a></article>\n')
    write(os.path.join(root, "README.md"),
          f"## Aktuelle Projekte\n- `portfolio/{slug}` -> statisch\n")
    write(os.path.join(root, ".github", "workflows", f"{slug}-publish-check.yml"),
          COMPLETE_WORKFLOW)
    return slug


class CheckDemoTests(unittest.TestCase):
    def test_list_prints_check_ids(self):
        proc = subprocess.run(
            [PY, CHECK, "--list"], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0)
        self.assertIn("leitzahl\tfail\t", proc.stdout)
        self.assertIn("generate_twice\tfail\t", proc.stdout)

    def test_fresh_scaffold_fails_unfinished_slots(self):
        tmp = tempfile.mkdtemp(prefix="check-demo-scaffold-")
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        os.makedirs(os.path.join(tmp, "portfolio"))
        os.makedirs(os.path.join(tmp, "docs"))
        os.makedirs(os.path.join(tmp, ".github", "workflows"))
        subprocess.check_call(
            [PY, SCAFFOLD, "kita-monitor-teststadt",
             "--title", "Kita-Monitor Teststadt",
             "--brand-sub", "Kita-Monitor",
             "--city", "Stadt Teststadt",
             "--tabs", "overview:Ueberblick",
             "--root", tmp,
             "--port", "8199"],
            cwd=tmp,
        )
        code, findings = run_check(tmp, "kita-monitor-teststadt")
        ids = fail_ids(findings)
        html_path = os.path.join(tmp, "portfolio", "kita-monitor-teststadt",
                                 "index.html")
        with open(html_path, encoding="utf-8") as fh:
            html = fh.read()
        self.assertIn('id="leitzahl"', html)
        self.assertNotEqual(code, 0)
        for needed in (
            "todo", "metric_info", "generate_stub",
            "snapshots", "quellen", "landing", "readme_bullet",
        ):
            self.assertIn(needed, ids, msg=findings)
        self.assertNotIn("leitzahl", ids, msg=findings)

    def test_complete_fixture_exits_zero(self):
        tmp = tempfile.mkdtemp(prefix="check-demo-ok-")
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        slug = build_complete(tmp)
        code, findings = run_check(tmp, slug)
        self.assertEqual(code, 0, msg=findings)
        self.assertEqual(fail_ids(findings), set())

    def test_bdh_exits_zero(self):
        slug = "anlagen-fristenmonitor-bdh"
        proj = os.path.join(REPO, "portfolio", slug)
        if not os.path.isdir(proj):
            self.skipTest("BDH demo not in this checkout")
        code, findings = run_check(REPO, slug)
        self.assertEqual(code, 0, msg=findings)


class ProbeSourcesTests(unittest.TestCase):
    def test_file_url_gets_a_landing_page(self):
        import probe_sources
        url = "https://thru.de/wp-content/uploads/2026/03/prtr_2024.zip"
        self.assertTrue(probe_sources.looks_like_file(url))
        self.assertEqual(
            probe_sources.landing_url(url),
            "https://thru.de/wp-content/uploads/2026/03/",
        )

    def test_html_url_is_not_treated_as_a_file(self):
        import probe_sources
        url = "https://www.lanuk.nrw.de/themen/industrieanlagen"
        self.assertFalse(probe_sources.looks_like_file(url))

    def test_listing_403_does_not_fail_the_named_file(self):
        import probe_sources
        calls = []

        def fake_fetch(url):
            calls.append(url)
            if url.endswith("/"):
                return {"ok": False, "status": 403, "url": url, "error": "Forbidden"}
            return {"ok": True, "status": 200, "url": url, "ctype": "application/zip",
                    "length": "", "modified": "", "bytes": 8}

        orig = probe_sources.fetch
        probe_sources.fetch = fake_fetch
        try:
            import io
            from contextlib import redirect_stdout
            with redirect_stdout(io.StringIO()):
                ok = probe_sources.probe([
                    ("prtr", "PRTR", "https://thru.de/files/prtr_2024.zip"),
                ])
        finally:
            probe_sources.fetch = orig
        self.assertTrue(ok)
        self.assertEqual(len(calls), 2)

    def test_quellen_from_generate_reads_the_literal(self):
        import probe_sources
        path = os.path.join(REPO, "portfolio", "anlagen-fristenmonitor-bdh",
                            "scripts", "generate.py")
        if not os.path.isfile(path):
            self.skipTest("BDH generate.py not in this checkout")
        rows = probe_sources.quellen_from_generate(path)
        keys = {k for k, _t, _u in rows}
        self.assertIn("prtr", keys)
        self.assertTrue(all(u.startswith("http") for _k, _t, u in rows))


if __name__ == "__main__":
    unittest.main()

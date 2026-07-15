#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scaffold.py — stamp out a new Kanduit demo project from the template.

Part of the /build-demo skill. Copies .claude/skills/build-demo/template/ to
portfolio/<slug>/ and .github/workflows/<slug>-publish-check.yml, substituting
{{PLACEHOLDER}} tokens. Writes NOTHING else — no git operations, no docs/ copy,
no landing-page edit (those are follow-up steps in SKILL.md).

Usage:
  python3 .claude/skills/build-demo/scaffold.py kita-monitor-essen \\
    --title "Kita-Monitor Essen" --brand-sub "Kita-Monitor" --city "Stadt Essen" \\
    --tabs "overview:Überblick,bedarf:Bedarfsplanung,benchmark:Benchmark NRW" \\
    [--data-key KITA] [--port 8125] [--desc "…"] [--root /path/to/repo]
"""
import argparse
import datetime
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "template")

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
TAB_ID_RE = re.compile(r"^[a-z][a-z0-9]*$")


def die(msg):
    sys.exit(f"scaffold: error: {msg}")


def parse_tabs(spec):
    tabs = []
    for part in spec.split(","):
        if ":" not in part:
            die(f"tab '{part}' must be id:Label")
        tid, label = part.split(":", 1)
        tid, label = tid.strip(), label.strip()
        if not TAB_ID_RE.match(tid):
            die(f"tab id '{tid}' must match {TAB_ID_RE.pattern}")
        if not label:
            die(f"tab '{tid}' has an empty label")
        tabs.append((tid, label))
    if not 1 <= len(tabs) <= 6:
        die("need 1–6 tabs")
    if len({t[0] for t in tabs}) != len(tabs):
        die("tab ids must be unique")
    return tabs


def free_port(root):
    """Lowest port >= 8123 not claimed by any existing portfolio/*/serve.py."""
    used = set()
    for path in sorted(os.listdir(os.path.join(root, "portfolio"))):
        serve = os.path.join(root, "portfolio", path, "serve.py")
        if os.path.isfile(serve):
            m = re.search(r"else (\d{4,5})", open(serve, encoding="utf-8").read())
            if m:
                used.add(int(m.group(1)))
    port = 8123
    while port in used:
        port += 1
    return port


def render_func(tid):
    return "render" + tid[0].upper() + tid[1:]


VIEW_SECTION = """  <!-- ===================== {LABEL_UPPER} ===================== -->
  <section class="view{active}" id="view-{tid}">
    <div class="wrap">
      <div class="view-head">
        <p class="eyebrow">TODO Eyebrow · Quelle/Kontext</p>
        <h2>{label}</h2>
        <p>TODO Einleitungssatz — was zeigt diese Ansicht, woraus, mit welcher Einschränkung.</p>
      </div>
      <!-- TODO Inhalt. Muster:
      <div class="grid g4" id="{tid}-kpis" style="margin-bottom:var(--sp-4)"></div>
      <div class="card">
        <div class="card-title">Charttitel <span class="info-i" data-info="metricKey" tabindex="0" role="button" aria-label="Erklärung: Charttitel">ⓘ</span></div>
        <div class="card-sub">unterzeile · einheit</div>
        <div id="chart-{tid}-1"></div>
        <p class="note src-note" data-src="quelleKey"></p>
      </div>
      -->
    </div>
  </section>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug")
    ap.add_argument("--title", required=True, help='z.B. "Kita-Monitor Essen"')
    ap.add_argument("--brand-sub", required=True, help='Topbar-Zusatz, z.B. "Kita-Monitor"')
    ap.add_argument("--city", required=True, help='Für den Footer-Disclaimer, z.B. "Stadt Essen"')
    ap.add_argument("--tabs", required=True, help='id:Label,id:Label,… (1–6, erste = aktiv)')
    ap.add_argument("--data-key", help="JS-Datenschlüssel window.KANDUIT_<KEY> (Default: erstes Slug-Wort, groß)")
    ap.add_argument("--port", type=int, help="serve.py-Port (Default: niedrigster freier ≥ 8123)")
    ap.add_argument("--desc", help="Meta-Description (Default aus Titel)")
    ap.add_argument("--root", default=os.path.abspath(os.path.join(HERE, "..", "..", "..")),
                    help="Repo-Root (Default: aus Skriptpfad abgeleitet)")
    a = ap.parse_args()

    if not SLUG_RE.match(a.slug):
        die(f"slug '{a.slug}' must match {SLUG_RE.pattern} (Umlaute transliterieren: ue/oe/ae/ss)")
    root = os.path.abspath(a.root)
    if not os.path.isdir(os.path.join(root, "portfolio")):
        die(f"{root} has no portfolio/ — not the repo root?")

    dest = os.path.join(root, "portfolio", a.slug)
    wf_dir = os.path.join(root, ".github", "workflows")
    wf = os.path.join(wf_dir, f"{a.slug}-publish-check.yml")
    for path in (dest, os.path.join(root, "docs", a.slug), wf):
        if os.path.exists(path):
            die(f"already exists: {path}")

    tabs = parse_tabs(a.tabs)
    today = datetime.date.today()
    subs = {
        "{{SLUG}}": a.slug,
        "{{TITLE}}": a.title,
        "{{BRAND_SUB}}": a.brand_sub,
        "{{CITY}}": a.city,
        "{{DATA_KEY}}": a.data_key or re.split(r"-", a.slug)[0].upper(),
        "{{PORT}}": str(a.port or free_port(root)),
        "{{DATE_ISO}}": today.isoformat(),
        "{{DATE_DE}}": today.strftime("%d.%m.%Y"),
        "{{META_DESCRIPTION}}": a.desc or f"Demonstrator: {a.title} — Kanduit UG, aus öffentlichen Daten.",
        "{{TAB_BUTTONS}}": "\n".join(
            f'    <button class="tab{" active" if i == 0 else ""}" data-view="{tid}">{label}</button>'
            for i, (tid, label) in enumerate(tabs)),
        "{{VIEW_SECTIONS}}": "\n".join(
            VIEW_SECTION.format(tid=tid, label=label, LABEL_UPPER=label.upper(),
                                active=" active" if i == 0 else "")
            for i, (tid, label) in enumerate(tabs)),
        "{{VIEWS_MAP}}": "{ " + ", ".join(f"{tid}: 'view-{tid}'" for tid, _ in tabs) + " }",
        "{{RENDER_STUBS}}": "\n".join(
            f"function {render_func(tid)}() {{\n  // TODO: Ansicht „{label}“\n}}\n"
            for tid, label in tabs),
        "{{RENDER_CALLS}}": "\n".join(f"{render_func(tid)}();" for tid, _ in tabs),
    }

    written = []
    for dirpath, _dirs, files in os.walk(TEMPLATE):
        rel = os.path.relpath(dirpath, TEMPLATE)
        for name in files:
            src = os.path.join(dirpath, name)
            if name == "workflow-publish-check.yml":
                out = wf
                os.makedirs(wf_dir, exist_ok=True)
            else:
                out = os.path.join(dest, rel, name) if rel != "." else os.path.join(dest, name)
                os.makedirs(os.path.dirname(out), exist_ok=True)
            text = open(src, encoding="utf-8").read()
            for token, value in subs.items():
                text = text.replace(token, value)
            with open(out, "w", encoding="utf-8") as fh:
                fh.write(text)
            shutil.copymode(src, out)
            written.append(out)

    sources_dir = os.path.join(dest, "data", "sources")
    os.makedirs(sources_dir, exist_ok=True)
    gitkeep = os.path.join(sources_dir, ".gitkeep")
    open(gitkeep, "w").close()
    written.append(gitkeep)

    # self-check: no unresolved {{TOKEN}} may remain (template literals use single braces)
    leftover = [p for p in written if "{{" in open(p, encoding="utf-8").read()]
    if leftover:
        die("unresolved {{tokens}} in: " + ", ".join(os.path.relpath(p, root) for p in leftover))

    print(f"scaffolded portfolio/{a.slug}/ ({len(written)} files):")
    for p in written:
        print("  " + os.path.relpath(p, root))
    print(f"""
next steps (details: .claude/skills/build-demo/SKILL.md):
  1. scripts/fetch_<quelle>.py schreiben und ausführen → data/sources/*.json
  2. scripts/generate.py implementieren und ausführen → data.js
  3. Views in app.js + METRIC_INFO/SRC_LABEL füllen, index.html-TODOs ersetzen
  4. python3 portfolio/{a.slug}/serve.py → alle Tabs prüfen (Desktop + 375px)
  5. python3 portfolio/{a.slug}/scripts/publish.py && … --check
  6. docs/index.html-Karte + README-Bullet ergänzen (Snippets: references/reference.md)
  7. READMEs/CHANGELOG-TODOs füllen, committen, PR öffnen (nicht mergen)""")


if __name__ == "__main__":
    main()

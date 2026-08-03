# -*- coding: utf-8 -*-
"""
publish.py — copy the deployable Ganztags-Platzmonitor Mönchengladbach files into the published
GitHub Pages folder (docs/).

Why this exists
---------------
The repo keeps a deliberate split:

  portfolio/ganztags-platzmonitor-moenchengladbach/   → source of truth (also holds the
                                              fetch/generate scripts and the raw
                                              data snapshots — NOT for the public)
  docs/ganztags-platzmonitor-moenchengladbach/        → what GitHub Pages actually serves
                                              (deploy-from-branch, /docs folder)

Editing the source alone does NOT change the live site — the deployable files
must be copied into docs/. This script does exactly that, deterministically, and
copies ONLY the four public files. CI (.github/workflows/
ganztags-platzmonitor-moenchengladbach-publish-check.yml) runs it and fails if the committed docs/ copy is out
of sync, so a forgotten publish can't be merged.

Usage
-----
  python3 scripts/publish.py           # sync docs/ from source
  python3 scripts/publish.py --check   # exit 1 if docs/ would change (used by CI)

Typical flow:  scripts/fetch_<quelle>.py  →  scripts/generate.py  →
               scripts/publish.py  →  commit  →  push
"""
import filecmp
import os
import shutil
import sys

# Files that make up the deployable static site. Anything not listed here
# (README*, serve.py, scripts/, data/) is intentionally NOT published.
DEPLOY_FILES = ["index.html", "app.js", "styles.css", "data.js"]

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)                                  # portfolio/ganztags-platzmonitor-moenchengladbach
REPO = os.path.dirname(os.path.dirname(SRC))                 # repo root
DEST = os.path.join(REPO, "docs", "ganztags-platzmonitor-moenchengladbach")


def main():
    check_only = "--check" in sys.argv[1:]
    os.makedirs(DEST, exist_ok=True)

    changed = []
    missing = []
    for name in DEPLOY_FILES:
        src = os.path.join(SRC, name)
        dst = os.path.join(DEST, name)
        if not os.path.isfile(src):
            missing.append(name)
            continue
        # shallow=False → compare contents, not just size/mtime
        if not (os.path.isfile(dst) and filecmp.cmp(src, dst, shallow=False)):
            changed.append(name)
            if not check_only:
                shutil.copy2(src, dst)

    if missing:
        sys.exit("error: missing source file(s): " + ", ".join(missing))

    if check_only:
        if changed:
            print("docs/ is OUT OF SYNC with source. Run: python3 scripts/publish.py")
            print("  stale file(s): " + ", ".join(changed))
            sys.exit(1)
        print("docs/ is in sync with source ✓")
        return

    if changed:
        print("published to docs/ganztags-platzmonitor-moenchengladbach/: " + ", ".join(changed))
    else:
        print("docs/ already up to date — nothing to copy")


if __name__ == "__main__":
    main()

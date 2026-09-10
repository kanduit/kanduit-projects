import filecmp
import os
import shutil
import sys

DEPLOY_FILES = ["index.html", "app.js", "styles.css", "data.js"]

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(SRC))
DEST = os.path.join(REPO, "docs", "anlagen-fristenmonitor-bdh")


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
        print("published to docs/anlagen-fristenmonitor-bdh/: " + ", ".join(changed))
    else:
        print("docs/ already up to date — nothing to copy")


if __name__ == "__main__":
    main()

"""Turn the wget mirror of enyeszpontok.hu into a clean static site.

Usage: python3 clean.py mirror docs
Copies `mirror` to `docs` and fixes it up for static hosting.
"""
import os
import re
import shutil
import sys

DOMAIN = "https://enyeszpontok.hu"
src, dst = sys.argv[1], sys.argv[2]

if os.path.exists(dst):
    shutil.rmtree(dst)
shutil.copytree(src, dst)

# 1. Files saved with query strings (style.css@ver=123.css, img.jpg@w=500):
#    give them their real names so the host serves the right content type.
QS = re.compile(r"@(?:ver|w)=[0-9]+(?:\.[0-9]+)*(?:\.css|\.js)?")
for root, _, files in os.walk(dst):
    for f in files:
        if "@" not in f:
            continue
        clean = QS.sub("", f)
        if clean == f:
            continue
        old, new = os.path.join(root, f), os.path.join(root, clean)
        if os.path.exists(new):
            os.remove(old)  # same file already saved without the query
        else:
            os.rename(old, new)

JUNK_LINKS = re.compile(
    r"""<link rel=["'](?:pingback|EditURI|shortlink|https://api\.w\.org/)["'][^>]*>\n?"""
    r"""|<link rel=["']alternate["'][^>]*(?:rss\+xml|oembed|application/json)[^>]*>\n?"""
)
IE_HTML5 = re.compile(r"<!--\[if lt IE 9\]>.*?<!\[endif\]-->\n?", re.S)
# WordPress emoji loader (fetches from the old server) and WP prefetch rules.
WP_SCRIPTS = re.compile(
    r'<script id="wp-emoji-settings"[^>]*>.*?</script>\n?'
    r'|<script type="module">\s*/\*! This file is auto-generated \*/.*?</script>\n?'
    r'|<script type="speculationrules">.*?</script>\n?',
    re.S,
)
HREF_INDEX = re.compile(r"""(href=["'])(?!https?:|//|mailto:)([^"'#?]*?)index\.html(?=[#"'])""")


def fix_href(m):
    path = m.group(2)
    return m.group(1) + (path if path else "./")


for root, _, files in os.walk(dst):
    for f in files:
        if not f.endswith((".html", ".css")):
            continue
        p = os.path.join(root, f)
        with open(p, encoding="utf-8", errors="surrogateescape") as fh:
            s = fh.read()
        s = QS.sub("", s)
        if f.endswith(".html"):
            s = JUNK_LINKS.sub("", s)
            s = IE_HTML5.sub("", s)
            s = WP_SCRIPTS.sub("", s)
            rel = os.path.relpath(root, dst)
            url = DOMAIN + "/" + ("" if rel == "." else rel + "/")
            s = re.sub(r'<link rel="canonical" href="[^"]*" />',
                       f'<link rel="canonical" href="{url}" />', s)
            s = HREF_INDEX.sub(fix_href, s)
        with open(p, "w", encoding="utf-8", errors="surrogateescape") as fh:
            fh.write(s)

# 2. Hosting extras for GitHub Pages: custom domain, skip Jekyll processing.
with open(os.path.join(dst, "CNAME"), "w") as fh:
    fh.write("enyeszpontok.hu")
open(os.path.join(dst, ".nojekyll"), "w").close()
print("done")

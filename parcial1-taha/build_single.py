#!/usr/bin/env python3
"""Build a single-file version of the study page.

Reads index.html, inlines css/style.css and every existing local
<link rel="stylesheet"> and <script src="..."> in document order, and writes
../IO-Parcial1-Taha.html (one self-contained file) by default.

No third-party dependencies (stdlib only). External stylesheets (e.g. the
Google Fonts <link>) are left untouched -- they are never inlined.

If any local CSS or JS file referenced from index.html is missing, the build
FAILS (exit code != 0) and prints:
    Falta el archivo local: <ruta>

Usage:
    python3 build_single.py
    python3 build_single.py --index /path/to/index.html --out /path/to/out.html
"""
import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_INDEX_HTML = os.path.join(HERE, 'index.html')
DEFAULT_OUTPUT_HTML = os.path.abspath(os.path.join(HERE, '..', 'IO-Parcial1-Taha.html'))

LINK_CSS_RE = re.compile(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>')
SCRIPT_SRC_RE = re.compile(r'<script\s+src="([^"]+)"\s*></script>')


def read_text(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def is_external(href):
    return href.startswith('http://') or href.startswith('https://') or href.startswith('//')


def build(index_path, output_path):
    if not os.path.isfile(index_path):
        print('ERROR: index.html not found at %s' % index_path, file=sys.stderr)
        sys.exit(1)

    base_dir = os.path.dirname(os.path.abspath(index_path))
    html = read_text(index_path)
    missing = []

    # Inline local <link rel="stylesheet" href="..."> tags. Keep external stylesheets
    # (Google Fonts and any other absolute https://, http:// or protocol-relative URL)
    # untouched -- they must never be inlined.
    def replace_css_link(match):
        href = match.group(1)
        if is_external(href):
            return match.group(0)
        css_path = os.path.join(base_dir, href)
        if not os.path.isfile(css_path):
            missing.append(href)
            return match.group(0)
        css_content = read_text(css_path)
        return '<style>\n' + css_content + '\n</style>'

    html = LINK_CSS_RE.sub(replace_css_link, html)

    # Inline local <script src="..."> tags in document order.
    def replace_script(match):
        src = match.group(1)
        if is_external(src):
            return match.group(0)
        js_path = os.path.join(base_dir, src)
        if not os.path.isfile(js_path):
            missing.append(src)
            return match.group(0)
        js_content = read_text(js_path)
        # Guard against an accidental "</script>" substring inside the source breaking the HTML.
        js_content = js_content.replace('</script>', '<\\/script>')
        return '<script>\n' + js_content + '\n</script>'

    html = SCRIPT_SRC_RE.sub(replace_script, html)

    if missing:
        for ref in missing:
            print('ERROR: Falta el archivo local: %s' % ref, file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print('Built: %s' % output_path)


def main():
    parser = argparse.ArgumentParser(description='Build the single-file study page.')
    parser.add_argument('--index', default=DEFAULT_INDEX_HTML, help='Path to the source index.html (default: %(default)s)')
    parser.add_argument('--out', default=DEFAULT_OUTPUT_HTML, help='Path to write the generated single-file HTML (default: %(default)s)')
    args = parser.parse_args()
    build(os.path.abspath(args.index), os.path.abspath(args.out))


if __name__ == '__main__':
    main()

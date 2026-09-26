#!/usr/bin/env python3
"""Build the homepage and every published Markdown note into a static _site/."""

from __future__ import annotations

import argparse
from datetime import date, datetime
from html import escape
from html.parser import HTMLParser
from itertools import groupby
import math
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import quote, unquote, urlsplit, urlunsplit

from jinja2 import Environment, FileSystemLoader, select_autoescape
import markdown
from markdown.extensions.toc import slugify_unicode
from pygments.formatters import HtmlFormatter
import yaml

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://invalidcodes.github.io"
MONTHS = ("", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
ASSET_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".pdf", ".mp4", ".webm"}
ARCHIVES = {
    "all": {
        "label": "Blog", "url": "/blog/", "first_line": "Ideas in", "second_line": "progress.",
        "description": "Notes on research, engineering, and the things I learn along the way.",
        "intro": "Things I learned, things I've built, a few thoughts along the way.",
        "reminder": ["Stay curious.", "Keep a record."],
    },
    "reading-notes": {
        "label": "Reading Notes", "url": "/blog/reading-notes/", "first_line": "Reading", "second_line": "notes.",
        "description": "A personal collection of reading notes, book reflections, and thoughts on film.",
        "intro": "Books, films, and lingering thoughts from my reading journey.",
        "reminder": ["Read slowly.", "Think freely."],
    },
}


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def plain_text(value):
    parser = PlainText()
    parser.feed(value)
    return " ".join(" ".join(parser.parts).split())


def parse_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    value = str(value).strip()
    try:
        return date.fromisoformat(value)
    except ValueError:
        pass
    for pattern in ("%b %d, %Y", "%B %d, %Y", "%Y/%m/%d", "%Y-%m"):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            pass
    raise ValueError(f"Invalid publication date {value!r}; use YYYY-MM-DD")


def fallback_date(path, root):
    """First addition in Git stays stable when a note is edited or redeployed."""
    result = subprocess.run(
        ["git", "log", "--follow", "--diff-filter=A", "--format=%aI", "--", str(path.relative_to(root))],
        cwd=root, text=True, capture_output=True, check=False,
    )
    dates = result.stdout.strip().splitlines()
    if dates:
        return date.fromisoformat(dates[-1][:10])
    return date.fromtimestamp(path.stat().st_mtime)


def excerpt(body):
    without_code = re.sub(r"(?ms)^(`{3,}|~{3,}).*?^\1[^\n]*$", "", body)
    for paragraph in re.split(r"\n\s*\n", without_code):
        paragraph = paragraph.strip()
        if not paragraph or re.match(r"^(#|!\[|<|https?://|[-*] |\d+\. |\|)", paragraph):
            continue
        text = plain_text(markdown.markdown(paragraph))
        if text:
            return text if len(text) <= 220 else text[:217].rstrip() + "…"
    return ""


def read_post(path, root=ROOT):
    source = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    metadata = {}
    if source.startswith("---\n"):
        match = re.match(r"\A---\n(.*?)\n---(?:\n|$)", source, re.S)
        if not match:
            raise ValueError(f"{path}: front matter has no closing ---")
        metadata = yaml.safe_load(match[1]) or {}
        if not isinstance(metadata, dict):
            raise ValueError(f"{path}: front matter must be a mapping")
        source = source[match.end():]
    if metadata.get("draft") is True:
        return None
    source = source.strip()
    if not source:
        return None

    title_heading = re.match(r"\A#\s+(.+?)[ \t]*#*\s*(?:\n|$)", source)
    title = str(metadata.get("title") or (title_heading[1] if title_heading else path.stem.replace("-", " ")))
    if title_heading:
        source = source[title_heading.end():].lstrip()

    heading_date = None
    heading = re.match(r"\A#{1,3}\s+([^\n]+)(?:\n|$)", source)
    if heading:
        try:
            heading_date = parse_date(heading[1])
            source = source[heading.end():].lstrip()
        except ValueError:
            pass
    filename_date = re.match(r"^(\d{4}-\d{2}-\d{2})(?:-|$)", path.stem)
    published = (parse_date(metadata["date"]) if metadata.get("date") else
                 heading_date or (parse_date(filename_date[1]) if filename_date else fallback_date(path, root)))
    month_only = bool(re.fullmatch(r"\d{4}-\d{2}", str(metadata.get("date", ""))))

    tags = metadata.get("tags") or ["Notes"]
    if isinstance(tags, str):
        tags = [tag.strip() for tag in tags.split(",") if tag.strip()]
    if not isinstance(tags, list):
        raise ValueError(f"{path}: tags must be a list or comma-separated text")
    tags = list(dict.fromkeys(str(tag) for tag in tags))

    # Turn standalone URLs into links while leaving fenced code untouched.
    lines, fence = [], None
    for line in source.splitlines():
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            if fence is None:
                fence = marker[1]
            elif marker[1][0] == fence[0] and len(marker[1]) >= len(fence):
                fence = None
        if fence is None and re.fullmatch(r"https?://[^\s<>]+", line.strip()):
            line = f"<{line.strip()}>"
        lines.append(line)
    renderer = markdown.Markdown(
        extensions=["extra", "codehilite", "toc", "sane_lists", "pymdownx.arithmatex"],
        extension_configs={
            "toc": {"toc_depth": "2-3", "slugify": slugify_unicode},
            "codehilite": {"guess_lang": False},
            "pymdownx.arithmatex": {"generic": True},
        },
    )
    rendered = renderer.convert("\n".join(lines))
    rendered = re.sub(r"(<table\b.*?</table>)", r'<div class="table-scroll">\1</div>', rendered, flags=re.S)
    text = plain_text(rendered)
    chinese_chars = len(re.findall(r"[\u3400-\u9fff]", text))
    words = len(re.findall(r"[A-Za-z0-9]+", text))
    relative_path = path.relative_to(root).with_suffix(".html")
    if relative_path in (Path("blog/index.html"), Path("blog/reading-notes/index.html")):
        raise ValueError(f"{path.name} is reserved for the archive; use a different article filename")
    collection = "reading-notes" if path.relative_to(root / "blog").parts[0] == "reading-notes" else "all"
    return {
        "title": title, "subtitle": str(metadata.get("subtitle", "")),
        "date": published.strftime("%Y-%m") if month_only else published.isoformat(), "year": published.year,
        "display_date": f"{MONTHS[published.month]} {published.year}" if month_only else f"{MONTHS[published.month]} {published.day}, {published.year}",
        "short_date": MONTHS[published.month].upper() if month_only else f"{MONTHS[published.month].upper()} {published.day:02d}",
        "collection": collection, "source_url": str(metadata.get("source_url", "")),
        "url": "/" + quote(relative_path.as_posix(), safe="/"), "output_path": relative_path,
        "source_path": path.relative_to(root),
        "description": str(metadata.get("description") or excerpt(source)),
        "tags": tags, "lang": str(metadata.get("lang", "zh-CN" if re.search(r"[\u3400-\u9fff]", source) else "en")),
        "reading_minutes": max(1, math.ceil(words / 220 + chinese_chars / 400)),
        "html": rendered, "toc": renderer.toc if renderer.toc_tokens else "",
        "has_math": 'class="arithmatex"' in rendered,
    }


def rewrite_markdown_links(post, posts, root):
    urls = {item["source_path"]: item["url"] for item in posts}

    def replace(match):
        href = match[1]
        parts = urlsplit(href)
        if parts.scheme or parts.netloc or not parts.path.lower().endswith(".md"):
            return match[0]
        source = (root / unquote(parts.path).lstrip("/") if parts.path.startswith("/") else
                  root / post["source_path"].parent / unquote(parts.path))
        try:
            source = source.resolve().relative_to(root.resolve())
        except ValueError:
            return match[0]
        if source not in urls:
            raise ValueError(f"{post['source_path']}: link points to an unpublished note: {href}")
        return 'href="' + urlunsplit(("", "", urls[source], parts.query, parts.fragment)) + '"'

    post["html"] = re.sub(r'href="([^"]+)"', replace, post["html"])


def build(root=ROOT):
    output = root / "_site"
    if output.exists():
        shutil.rmtree(output)
    output.mkdir()
    shutil.copytree(root / "assets", output / "assets")
    posts = []
    for path in sorted((root / "blog").rglob("*")):
        relative = path.relative_to(root / "blog")
        if not path.is_file() or path.is_symlink() or any(part.startswith(("_", ".")) for part in relative.parts):
            continue
        if path.suffix.lower() == ".md" and path.name.lower() != "readme.md":
            post = read_post(path, root)
            if post:
                posts.append(post)
        elif path.suffix.lower() in ASSET_EXTENSIONS:
            destination = output / "blog" / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, destination)
    posts.sort(key=lambda post: (post["date"], post["url"]), reverse=True)
    for post in posts:
        rewrite_markdown_links(post, posts, root)

    environment = Environment(loader=FileSystemLoader(root / "scripts/templates"), autoescape=select_autoescape())
    template = environment.get_template("blog.html")
    archive_posts = {"all": posts, "reading-notes": [post for post in posts if post["collection"] == "reading-notes"]}
    contexts = {}
    for key, archive in ARCHIVES.items():
        entries = archive_posts[key]
        context = {
            "site_url": SITE_URL, "posts": entries, "post": None, "archive": archive, "archive_key": key,
            "years": [(year, list(items)) for year, items in groupby(entries, key=lambda post: post["year"])],
            "tags": sorted({tag for post in entries for tag in post["tags"]}),
        }
        contexts[key] = context
        destination = output / archive["url"].strip("/") / "index.html"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(template.render(**context), encoding="utf-8")
    for post in posts:
        peers = archive_posts[post["collection"]]
        index = peers.index(post)
        destination = output / post["output_path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        page_context = {**contexts[post["collection"]], "post": post, "newer": peers[index - 1] if index else None,
                        "older": peers[index + 1] if index + 1 < len(peers) else None}
        destination.write_text(template.render(**page_context), encoding="utf-8")

    homepage = (root / "index.html").read_text(encoding="utf-8")
    previews = [f'<a class="home-blog-entry" href="{post["url"]}"><span>{post["display_date"]} · {post["reading_minutes"]} min read</span><strong>{escape(post["title"])} <span aria-hidden="true">↗</span></strong></a>' for post in posts[:3]]
    if previews:
        homepage = re.sub(r"(?s)(<!-- BLOG_PREVIEW_START -->).*?(<!-- BLOG_PREVIEW_END -->)",
                          lambda match: match[1] + "\n" + "\n".join(previews) + "\n" + match[2], homepage)
    (output / "index.html").write_text(homepage, encoding="utf-8")
    (output / "assets/css/blog-code.css").write_text(HtmlFormatter(style="friendly").get_style_defs(".prose .codehilite"), encoding="utf-8")
    (output / ".nojekyll").touch()
    if (root / "CNAME").is_file():
        shutil.copy2(root / "CNAME", output / "CNAME")
    print(f"Built {len(posts)} published note(s) into {output}")
    for post in posts:
        print(f"  {post['date']}  {post['url']}")
    return posts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    build()

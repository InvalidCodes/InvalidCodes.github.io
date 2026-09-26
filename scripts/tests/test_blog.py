"""Regression checks for the drop-in Markdown publishing contract."""
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_blog import ROOT, build, read_post


class BlogBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "blog").mkdir()

    def write(self, name, text):
        path = self.root / "blog" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def test_existing_heading_format(self):
        post = read_post(self.write("old.md", "# First steps\n\n## Sep 1, 2025\n\nhttps://example.org\n\nMy first note."), self.root)
        self.assertEqual(post["date"], "2025-09-01")
        self.assertEqual(post["title"], "First steps")
        self.assertEqual(post["description"], "My first note.")
        self.assertNotIn("<h1", post["html"])
        self.assertNotIn("Sep 1", post["html"])
        self.assertIn('href="https://example.org"', post["html"])

    def test_front_matter_precedence_and_chinese(self):
        post = read_post(self.write("2024-01-01-note.md", "---\ntitle: 研究笔记\ndate: 2026-09-26\ntags: [Robotics, 随笔]\n---\n# Old title\n\n## Sep 1, 2025\n\n正文。\n\n## 方法\n\n详细内容。"), self.root)
        self.assertEqual(post["title"], "研究笔记")
        self.assertEqual(post["date"], "2026-09-26")
        self.assertEqual(post["lang"], "zh-CN")
        self.assertEqual(post["tags"], ["Robotics", "随笔"])
        self.assertIn("方法", post["toc"])

    def test_drafts_empty_and_bad_dates(self):
        self.assertIsNone(read_post(self.write("draft.md", "---\ndraft: true\n---\n# Private draft"), self.root))
        self.assertIsNone(read_post(self.write("empty.md", ""), self.root))
        with self.assertRaises(ValueError):
            read_post(self.write("bad.md", "---\ndate: 2026-99-01\n---\n# A note"), self.root)
        with self.assertRaisesRegex(ValueError, "reserved"):
            read_post(self.write("index.md", "# A note"), self.root)

    def test_math_preserves_tex_and_ignores_code(self):
        post = read_post(self.write("math.md", r"""---
date: 2026-09-26
subtitle: An introduction
---
# A mathematical note

Inline \(C_L\) and $x^2$ stay mathematical.

\[
\underbrace{\|\hat C_L-C_L\|^2}_{\text{low-band error}}
\]

```text
\(this_is_code\)
```
"""), self.root)
        self.assertTrue(post["has_math"])
        self.assertEqual(post["subtitle"], "An introduction")
        self.assertEqual(post["html"].count('class="arithmatex"'), 3)
        self.assertIn(r'\hat C_L-C_L', post["html"])
        self.assertIn('this_is_code', post["html"])
        self.assertNotIn('<em>is</em>', post["html"])

    def test_month_precision_and_reading_notes_archive(self):
        shutil.copytree(ROOT / "scripts/templates", self.root / "scripts/templates")
        (self.root / "assets/css").mkdir(parents=True)
        (self.root / "index.html").write_text("<!-- BLOG_PREVIEW_START --><!-- BLOG_PREVIEW_END -->")
        self.write("ordinary.md", "---\ndate: 2025-01-01\n---\n# Ordinary post")
        self.write("reading-notes/book.md", "---\ndate: '2021-01'\nsource_url: https://example.org/original\n---\n# Book reflection\n\nA thought.")
        self.write("reading-notes/newer.md", "---\ndate: 2023-08-04\n---\n# Another book")
        with redirect_stdout(StringIO()):
            posts = build(self.root)
        book = next(post for post in posts if post["title"] == "Book reflection")
        self.assertEqual(book["date"], "2021-01")
        self.assertEqual(book["display_date"], "Jan 2021")
        self.assertEqual(book["short_date"], "JAN")
        output = self.root / "_site/blog"
        archive = (output / "reading-notes/index.html").read_text()
        self.assertIn("Book reflection", archive)
        self.assertIn("Another book", archive)
        self.assertNotIn("Ordinary post", archive)
        self.assertLess(archive.index("Another book"), archive.index("Book reflection"))
        main = (output / "index.html").read_text()
        self.assertIn("Ordinary post", main)
        self.assertIn("Book reflection", main)
        page = (output / "reading-notes/book.html").read_text()
        self.assertIn('datetime="2021-01"', page)
        self.assertNotIn('2021-01-01', page)
        self.assertIn("Another book", page)
        self.assertNotIn("Ordinary post", page)
        self.assertIn('href="https://example.org/original"', page)
        self.assertNotIn("Read the story", archive)
        self.assertNotIn("COLLECTED ALONG THE WAY", archive)
        self.assertNotIn("A small corner", archive)
        self.assertIn('<footer class="blog-footer"><p>Always learning, always becoming.</p><a href="#top" class="back-top">', archive)

    def test_build_order_links_assets_and_markdown(self):
        shutil.copytree(ROOT / "scripts/templates", self.root / "scripts/templates")
        (self.root / "assets/css").mkdir(parents=True)
        (self.root / "index.html").write_text("<!-- BLOG_PREVIEW_START -->old<!-- BLOG_PREVIEW_END -->")
        self.write("early.md", "# Early\n\n## Jan 1, 2024\n\nAn earlier entry.")
        self.write("folder/2026-01-01-later.md", "# Later <note>\n\nA new note.\n\n[Earlier](../early.md#section)\n\n![Image](figure.svg)\n\n## Method\n\n```python\nprint('hello')\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n")
        self.write("folder/figure.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>')
        self.write("_scratch.md", "# Scratch")
        self.write("draft.md", "---\ndraft: true\n---\n# Secret")
        self.write("README.md", "# Writing instructions")
        with redirect_stdout(StringIO()):
            posts = build(self.root)
        self.assertEqual([post["date"] for post in posts], ["2026-01-01", "2024-01-01"])
        output = self.root / "_site"
        page = (output / "blog/folder/2026-01-01-later.html").read_text()
        self.assertIn('href="/blog/early.html#section"', page)
        self.assertIn('src="figure.svg"', page)
        self.assertIn('class="table-scroll"', page)
        self.assertIn('class="codehilite"', page)
        self.assertIn("Later &lt;note&gt;", page)
        self.assertTrue((output / "blog/folder/figure.svg").is_file())
        self.assertFalse(list(output.rglob("*.md")))
        self.assertFalse((output / "blog/draft.html").exists())
        self.assertFalse((output / "blog/_scratch.html").exists())
        homepage = (output / "index.html").read_text()
        self.assertLess(homepage.index("Later"), homepage.index("Early"))
        self.assertIn("Older entry", page)
        self.assertNotIn("katex.min.js", page)


if __name__ == "__main__":
    unittest.main()

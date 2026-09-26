// Arithmatex protects TeX from Markdown and normalizes its delimiters.
// Both the renderer and fonts are served locally, only on articles with math.
document.querySelectorAll(".prose .arithmatex").forEach((element) => {
  const source = element.textContent.trim();
  if (!window.katex) return;
  window.katex.render(source.slice(2, -2), element, {
    displayMode: element.tagName === "DIV",
    throwOnError: false,
    trust: false,
    output: "htmlAndMathml",
  });
});

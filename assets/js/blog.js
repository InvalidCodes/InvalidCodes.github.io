const search = document.querySelector("#blog-search");

if (search) {
  const tools = document.querySelector(".archive-tools");
  const entries = [...document.querySelectorAll(".blog-entry")];
  const groups = [...document.querySelectorAll(".year-group")];
  const filters = [...document.querySelectorAll(".tag-filter")];
  const empty = document.querySelector(".no-results");
  const status = document.querySelector(".search-status");
  const requestedTag = new URLSearchParams(location.search).get("tag");
  let activeTag = filters.some((filter) => filter.dataset.tag === requestedTag) ? requestedTag : "";

  const update = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    entries.forEach((entry) => {
      const matches = (!activeTag || JSON.parse(entry.dataset.tags).includes(activeTag)) && entry.dataset.search.includes(query);
      entry.hidden = !matches;
      if (matches) count += 1;
    });
    groups.forEach((group) => {
      const visibleCount = group.querySelectorAll(".blog-entry:not([hidden])").length;
      group.hidden = visibleCount === 0;
      group.querySelector(".year-label > span").textContent = `${String(visibleCount).padStart(2, "0")} ${visibleCount === 1 ? "entry" : "entries"}`;
    });
    filters.forEach((filter) => {
      const selected = filter.dataset.tag === activeTag;
      filter.classList.toggle("active", selected);
      filter.setAttribute("aria-pressed", String(selected));
    });
    empty.hidden = count > 0;
    status.textContent = `${count} ${count === 1 ? "entry" : "entries"} found.`;
  };

  tools.hidden = false;
  search.addEventListener("input", update);
  filters.forEach((filter) => filter.addEventListener("click", () => {
    activeTag = filter.dataset.tag;
    update();
  }));
  document.querySelector("#clear-search").addEventListener("click", () => {
    activeTag = "";
    search.value = "";
    update();
    search.focus();
  });
  update();
}

document.querySelectorAll(".prose pre").forEach((block) => {
  if (!navigator.clipboard?.writeText) return;
  const wrapper = document.createElement("div");
  wrapper.className = "code-block";
  block.before(wrapper);
  wrapper.append(block);
  const button = document.createElement("button");
  button.className = "copy-code";
  button.type = "button";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy code to clipboard");
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(block.innerText);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select to copy";
    }
    window.setTimeout(() => { button.textContent = "Copy"; }, 1800);
  });
  wrapper.append(button);
});

// Highlight the table-of-contents entry for the section being read.
const tocLinks = [...document.querySelectorAll(".post-toc a[href^='#']")];

if (tocLinks.length) {
  const sections = [...new Set(tocLinks.map((link) => decodeURIComponent(link.hash.slice(1))))]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const sidebar = document.querySelector(".post-sidebar");
  let current = null;
  let pending = false;

  const activate = (id) => {
    if (id === current) return;
    current = id;
    tocLinks.forEach((link) => {
      link.classList.remove("active", "active-parent");
      link.removeAttribute("aria-current");
    });
    if (!id) return;
    tocLinks.filter((link) => decodeURIComponent(link.hash.slice(1)) === id).forEach((link) => {
      link.classList.add("active");
      link.setAttribute("aria-current", "location");
      // A subsection also marks the section that contains it.
      link.parentElement.parentElement.closest("li")?.querySelector(":scope > a")?.classList.add("active-parent");
    });
    const visible = sidebar && tocLinks.find((link) => link.classList.contains("active") && sidebar.contains(link));
    if (visible) {
      const top = visible.offsetTop - sidebar.offsetTop;
      if (top < sidebar.scrollTop + 40 || top > sidebar.scrollTop + sidebar.clientHeight - 60) {
        sidebar.scrollTo({ top: top - sidebar.clientHeight / 3, behavior: "smooth" });
      }
    }
  };

  const update = () => {
    pending = false;
    const line = Math.min(160, window.innerHeight * 0.3);
    let id = null;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) id = section.id;
      else break;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      const last = sections[sections.length - 1];
      if (last.getBoundingClientRect().top < window.innerHeight) id = last.id;
    }
    activate(id);
  };

  const schedule = () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(update);
    }
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
}

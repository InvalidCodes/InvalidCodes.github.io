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

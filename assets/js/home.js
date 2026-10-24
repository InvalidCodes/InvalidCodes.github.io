const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navAnchors = Array.from(document.querySelectorAll(".nav-links a"));
const sections = navAnchors
  .filter((link) => link.getAttribute("href").startsWith("#"))
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

menuToggle?.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

navAnchors.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

document.addEventListener("click", (event) => {
  if (!navLinks.classList.contains("open")) return;
  if (event.target.closest(".nav")) return;
  navLinks.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded", "false");
});

const setActiveLink = (id) => {
  navAnchors.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
  });
};

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible) {
      setActiveLink(visible.target.id);
    }
  },
  {
    rootMargin: "-22% 0px -62% 0px",
    threshold: [0.12, 0.3, 0.55],
  }
);

sections.forEach((section) => observer.observe(section));

const publicationList = document.querySelector("#publication-list");
const publicationFilters = document.querySelector(".publication-filters");

if (publicationList && publicationFilters) {
  // Preserve the original date order independently of subsequent DOM reordering.
  const byDate = Array.from(publicationList.children);
  const selected = byDate
    .filter((paper) => paper.hasAttribute("data-selected-rank"))
    .sort((a, b) => Number(a.dataset.selectedRank) - Number(b.dataset.selectedRank));
  const buttons = Array.from(publicationFilters.querySelectorAll("button"));

  const setPublicationView = (view) => {
    const isSelected = view === "selected";
    byDate.forEach((paper) => {
      paper.hidden = isSelected && !paper.hasAttribute("data-selected-rank");
    });
    (isSelected ? selected : byDate).forEach((paper) => publicationList.append(paper));
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.publicationView === view));
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => setPublicationView(button.dataset.publicationView));
  });
  setPublicationView("selected");
  publicationFilters.hidden = false;
}

const newsList = document.querySelector(".news-list");
const newsToggle = document.querySelector(".news-toggle");
const NEWS_VISIBLE = 4;
// Extra height that lets the next item peek out under the fade, hinting there is more.
const NEWS_PEEK = 18;

if (newsList) {
  // Show the latest four items; older ones are reachable by scrolling or "Show all".
  let isExpanded = false;

  const updateFade = () => {
    const hasMore = newsList.scrollTop + newsList.clientHeight < newsList.scrollHeight - 2;
    newsList.classList.toggle("has-more", newsList.classList.contains("is-scrollable") && hasMore);
  };

  const fitNews = () => {
    const items = newsList.children;
    const hasOverflow = items.length > NEWS_VISIBLE;
    const isScrollable = hasOverflow && !isExpanded;
    newsList.classList.toggle("is-scrollable", isScrollable);
    if (isScrollable) {
      const last = items[NEWS_VISIBLE - 1];
      newsList.style.maxHeight = `${last.offsetTop + last.offsetHeight + NEWS_PEEK}px`;
      newsList.tabIndex = 0;
    } else {
      newsList.style.removeProperty("max-height");
      newsList.removeAttribute("tabindex");
    }
    if (newsToggle) {
      newsToggle.hidden = !hasOverflow;
      newsToggle.textContent = isExpanded ? "Show less ↑" : `Show all ${items.length} ↓`;
      newsToggle.setAttribute("aria-expanded", String(isExpanded));
    }
    updateFade();
  };

  newsToggle?.addEventListener("click", () => {
    isExpanded = !isExpanded;
    newsList.scrollTop = 0;
    fitNews();
  });

  fitNews();
  newsList.addEventListener("scroll", updateFade, { passive: true });
  window.addEventListener("resize", fitNews);
  document.fonts?.ready.then(fitNews);
}

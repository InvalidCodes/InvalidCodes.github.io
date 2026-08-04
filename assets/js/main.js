const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navAnchors = Array.from(document.querySelectorAll(".nav-links a"));
const sections = navAnchors
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

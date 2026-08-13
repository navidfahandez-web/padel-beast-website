// Shared chrome (nav/footer) mounted on every page via #nav-mount / #footer-mount.

const WHATSAPP_LINK = "https://wa.link/j1alk4";
const INSTAGRAM_LINK = "https://instagram.com/thepadelbeast";
const PHONE_DISPLAY = "+971 50 945 3562";
const PHONE_LINK = "tel:+971509453562";
const EMAIL = "thepadelbeast@gmail.com";

const LOGO_HTML = `
<span class="relative inline-flex items-center justify-center w-11 h-11 bg-ink rounded-xl -rotate-3 shadow-card shrink-0">
  <span class="-rotate-1 text-center leading-[0.62] font-heading text-paper" style="font-size:0.62rem; letter-spacing:0.02em;">
    <span class="block">PADEL</span>
    <span class="block text-red">BEAST</span>
  </span>
</span>`;

const NAV_LINKS = [
  ["index.html", "Home"],
  ["about.html", "About"],
  ["services.html", "Services"],
  ["academies.html", "Academies"],
  ["team.html", "Team"],
  ["partners.html", "For Clubs"],
  ["contact.html", "Contact"],
];

function navLinkHTML(mobile) {
  const current = (document.body.dataset.page || "").toLowerCase();
  return NAV_LINKS.map(([href, label]) => {
    const isActive = href.replace(".html", "") === current;
    if (mobile) {
      return `<a href="${href}" class="block py-2 font-semibold ${isActive ? "text-red" : "text-ink"}">${label}</a>`;
    }
    return `<a href="${href}" class="hover:text-red transition-colors ${isActive ? "text-red" : "text-ink-soft"}">${label}</a>`;
  }).join("");
}

const NAV_HTML = `
<header class="sticky top-0 z-40 bg-paper/95 backdrop-blur border-b border-border">
  <div class="max-w-7xl mx-auto px-5 md:px-8 h-20 flex items-center justify-between gap-4">
    <a href="index.html" class="flex items-center gap-3 shrink-0">
      ${LOGO_HTML}
      <span class="hidden sm:block font-heading text-ink text-lg leading-none">PADEL<span class="text-red">BEAST</span></span>
    </a>
    <nav class="hidden lg:flex items-center gap-7 text-sm font-semibold">
      ${navLinkHTML(false)}
    </nav>
    <div class="hidden lg:flex items-center gap-3">
      <a href="${WHATSAPP_LINK}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">${icon("whatsapp")}<span>WhatsApp Us</span></a>
    </div>
    <button id="mobileMenuBtn" class="lg:hidden p-2 -mr-2 text-ink" aria-label="Open menu" aria-expanded="false">
      ${icon("menu", "text-2xl")}
    </button>
  </div>
  <div id="mobileMenu" class="lg:hidden hidden border-t border-border bg-paper px-5 py-4 space-y-1">
    ${navLinkHTML(true)}
    <a href="${WHATSAPP_LINK}" target="_blank" rel="noopener" class="btn btn-primary w-full mt-3">${icon("whatsapp")}<span>WhatsApp Us</span></a>
  </div>
</header>`;

const FOOTER_HTML = `
<footer class="bg-ink text-paper mt-24">
  <div class="max-w-7xl mx-auto px-5 md:px-8 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
    <div class="col-span-2">
      <a href="index.html" class="flex items-center gap-3 mb-4">
        ${LOGO_HTML}
        <span class="font-heading text-paper text-lg leading-none">PADEL<span class="text-red">BEAST</span></span>
      </a>
      <p class="text-sm text-white/60 max-w-xs mb-1">Building communities. Growing clubs. Elevating padel.</p>
      <p class="text-xs text-white/40 max-w-xs">A community-first padel operator based in Abu Dhabi, UAE.</p>
    </div>
    <div>
      <div class="font-semibold text-sm mb-3 text-white/90">Explore</div>
      <ul class="space-y-2 text-sm text-white/60">
        <li><a href="about.html" class="hover:text-white transition-colors">About us</a></li>
        <li><a href="services.html" class="hover:text-white transition-colors">Services</a></li>
        <li><a href="academies.html" class="hover:text-white transition-colors">Academies</a></li>
        <li><a href="team.html" class="hover:text-white transition-colors">Coaches</a></li>
        <li><a href="partners.html" class="hover:text-white transition-colors">For clubs</a></li>
      </ul>
    </div>
    <div>
      <div class="font-semibold text-sm mb-3 text-white/90">Our venues</div>
      <ul class="space-y-2 text-sm text-white/60">
        <li>The Padel Project<br /><span class="text-white/40">Musaffah, Abu Dhabi</span></li>
        <li class="pt-1">UAEJJ Fitness<br /><span class="text-white/40">MBZ &amp; Al Falah</span></li>
      </ul>
    </div>
    <div>
      <div class="font-semibold text-sm mb-3 text-white/90">Get in touch</div>
      <ul class="space-y-2.5 text-sm text-white/60">
        <li><a href="${WHATSAPP_LINK}" target="_blank" rel="noopener" class="flex items-center gap-2 hover:text-white transition-colors">${icon("whatsapp")}<span>WhatsApp</span></a></li>
        <li><a href="${PHONE_LINK}" class="flex items-center gap-2 hover:text-white transition-colors">${icon("phone")}<span>${PHONE_DISPLAY}</span></a></li>
        <li><a href="mailto:${EMAIL}" class="flex items-center gap-2 hover:text-white transition-colors">${icon("mail")}<span>${EMAIL}</span></a></li>
        <li><a href="${INSTAGRAM_LINK}" target="_blank" rel="noopener" class="flex items-center gap-2 hover:text-white transition-colors">${icon("instagram")}<span>@thepadelbeast</span></a></li>
      </ul>
    </div>
  </div>
  <div class="border-t border-white/10">
    <div class="max-w-7xl mx-auto px-5 md:px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-white/40">
      <span>&copy; 2026 Padel Beast. All rights reserved.</span>
      <span>Abu Dhabi, United Arab Emirates</span>
    </div>
  </div>
</footer>`;

function mountChrome() {
  const navMount = document.getElementById("nav-mount");
  const footerMount = document.getElementById("footer-mount");
  if (navMount) navMount.innerHTML = NAV_HTML;
  if (footerMount) footerMount.innerHTML = FOOTER_HTML;

  const btn = document.getElementById("mobileMenuBtn");
  const menu = document.getElementById("mobileMenu");
  if (btn && menu) {
    btn.addEventListener("click", () => {
      const isOpen = !menu.classList.contains("hidden");
      menu.classList.toggle("hidden");
      btn.setAttribute("aria-expanded", String(!isOpen));
      btn.innerHTML = icon(isOpen ? "menu" : "x", "text-2xl");
    });
  }
}

// Hydrates static <span class="icon" data-icon="name"></span> placeholders used
// directly in page HTML (outside of JS-built template strings like NAV_HTML above).
function hydrateIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = ICONS[el.dataset.icon] || "";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  mountChrome();
  hydrateIcons();
});

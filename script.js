
(() => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('proposal-theme');
  if (savedTheme) root.dataset.theme = savedTheme;

  themeToggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('proposal-theme', next);
  });

  document.getElementById('printButton').addEventListener('click', () => window.print());

  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  const menuButton = document.getElementById('menuButton');
  const closeButton = document.getElementById('menuClose');
  const closeMenu = () => {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
  };
  const openMenu = () => {
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.body.classList.add('menu-open');
    menuButton.setAttribute('aria-expanded', 'true');
  };
  menuButton.addEventListener('click', openMenu);
  closeButton.addEventListener('click', closeMenu);
  backdrop.addEventListener('click', closeMenu);
  sidebar.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    if (window.innerWidth <= 860) closeMenu();
  }));

  const progressBar = document.getElementById('progressBar');
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);

  const tocItems = [...document.querySelectorAll('.toc-list > li')];
  const sectionMap = new Map(tocItems.map(li => {
    const href = li.querySelector('.toc-main-link').getAttribute('href');
    return [href.slice(1), li];
  }));
  const sections = [...document.querySelectorAll('.document-section')];
  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (!visible.length) return;
    tocItems.forEach(li => li.classList.remove('active'));
    const active = sectionMap.get(visible[0].target.id);
    if (active) {
      active.classList.add('active');
      active.scrollIntoView({ block: 'nearest' });
    }
  }, { rootMargin: '-18% 0px -72% 0px', threshold: 0 });
  sections.forEach(section => observer.observe(section));

  const search = document.getElementById('tocSearch');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLocaleLowerCase('fa');
    tocItems.forEach(li => {
      li.classList.toggle('is-hidden', q && !li.textContent.toLocaleLowerCase('fa').includes(q));
    });
  });
})();

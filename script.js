(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const root = document.documentElement;
  const body = document.body;
  const storage = {
    get(key, fallback = null) {
      try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
    }
  };

  const toPersianDigits = value => String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[digit]);
  const normalizePersian = value => value
    .toLocaleLowerCase('fa')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  /* ---------- Theme ---------- */
  const themeToggle = $('#themeToggle');
  const storedTheme = storage.get('ialr-theme');
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = storedTheme || (systemDark ? 'dark' : 'light');

  themeToggle?.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = nextTheme;
    storage.set('ialr-theme', nextTheme);
    showToast(nextTheme === 'dark' ? 'حالت تاریک فعال شد' : 'حالت روشن فعال شد');
  });

  $('#printButton')?.addEventListener('click', () => window.print());

  /* ---------- Sidebar ---------- */
  const sidebar = $('#sidebar');
  const backdrop = $('#backdrop');
  const menuButton = $('#menuButton');
  const menuClose = $('#menuClose');

  const openMenu = () => {
    sidebar?.classList.add('is-open');
    backdrop?.classList.add('is-open');
    body.classList.add('menu-open');
    menuButton?.setAttribute('aria-expanded', 'true');
  };

  const closeMenu = () => {
    sidebar?.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
    body.classList.remove('menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  };

  menuButton?.addEventListener('click', openMenu);
  menuClose?.addEventListener('click', closeMenu);
  backdrop?.addEventListener('click', closeMenu);
  $('#heroTocButton')?.addEventListener('click', () => {
    if (window.innerWidth <= 860) openMenu();
    else {
      $('#tocSearch')?.focus();
      sidebar?.animate?.([
        { backgroundColor: 'var(--surface)' },
        { backgroundColor: 'var(--primary-soft)' },
        { backgroundColor: 'var(--surface)' }
      ], { duration: 650, easing: 'ease-out' });
    }
  });
  $$('#sidebar a').forEach(link => link.addEventListener('click', () => {
    if (window.innerWidth <= 860) closeMenu();
  }));

  /* ---------- Reading settings ---------- */
  const readingPanel = $('#readingPanel');
  const readingSettingsButton = $('#readingSettingsButton');
  const fontScaleValue = $('#fontScaleValue');
  const focusModeToggle = $('#focusModeToggle');
  let fontScale = Number(storage.get('ialr-font-scale', '1'));
  let lineHeight = Number(storage.get('ialr-line-height', '2.15'));
  let focusMode = storage.get('ialr-focus-mode', 'false') === 'true';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const updateReadingSettings = () => {
    fontScale = clamp(Number(fontScale.toFixed(2)), .88, 1.24);
    lineHeight = clamp(Number(lineHeight.toFixed(2)), 1.75, 2.55);
    root.style.setProperty('--reader-scale', fontScale);
    root.style.setProperty('--reader-line-height', lineHeight);
    if (fontScaleValue) fontScaleValue.textContent = `${toPersianDigits(Math.round(fontScale * 100))}٪`;
    $$('[data-line-height]').forEach(button => {
      button.classList.toggle('is-selected', Number(button.dataset.lineHeight) === lineHeight);
    });
    body.classList.toggle('focus-mode', focusMode);
    if (focusModeToggle) focusModeToggle.checked = focusMode;
    storage.set('ialr-font-scale', String(fontScale));
    storage.set('ialr-line-height', String(lineHeight));
    storage.set('ialr-focus-mode', String(focusMode));
    refreshSectionPositions();
  };

  const openReadingPanel = () => {
    if (!readingPanel) return;
    readingPanel.hidden = false;
    readingSettingsButton?.setAttribute('aria-expanded', 'true');
  };
  const closeReadingPanel = () => {
    if (!readingPanel) return;
    readingPanel.hidden = true;
    readingSettingsButton?.setAttribute('aria-expanded', 'false');
  };
  readingSettingsButton?.addEventListener('click', event => {
    event.stopPropagation();
    readingPanel?.hidden ? openReadingPanel() : closeReadingPanel();
  });
  $('#readingPanelClose')?.addEventListener('click', closeReadingPanel);
  readingPanel?.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', closeReadingPanel);

  $('#fontIncrease')?.addEventListener('click', () => {
    fontScale += .06;
    updateReadingSettings();
  });
  $('#fontDecrease')?.addEventListener('click', () => {
    fontScale -= .06;
    updateReadingSettings();
  });
  $$('[data-line-height]').forEach(button => button.addEventListener('click', () => {
    lineHeight = Number(button.dataset.lineHeight);
    updateReadingSettings();
  }));
  focusModeToggle?.addEventListener('change', () => {
    focusMode = focusModeToggle.checked;
    updateReadingSettings();
    closeMenu();
    showToast(focusMode ? 'حالت تمرکز فعال شد' : 'حالت تمرکز غیرفعال شد');
  });
  $('#resetReadingSettings')?.addEventListener('click', () => {
    fontScale = 1;
    lineHeight = 2.15;
    focusMode = false;
    updateReadingSettings();
    showToast('تنظیمات مطالعه بازنشانی شد');
  });
  requestAnimationFrame(updateReadingSettings);

  /* ---------- Document model ---------- */
  const sections = $$('.document-section');
  const tocItems = $$('.toc-list > li');
  const tocMainLinks = $$('.toc-main-link');
  const tocSubLinks = $$('.toc-sublist a');
  const currentChapter = $('#currentChapter');
  const dockSectionNumber = $('#dockSectionNumber');
  const dockSectionTitle = $('#dockSectionTitle');
  const prevSectionButton = $('#prevSectionButton');
  const nextSectionButton = $('#nextSectionButton');
  const readingDock = $('#readingDock');
  const backToTop = $('#backToTop');
  const progressBar = $('#progressBar');
  let sectionPositions = [];
  let subsectionPositions = [];
  let activeSectionIndex = -1;
  let ticking = false;

  const sectionTitle = section => $('h2', section)?.childNodes?.[0]?.textContent?.trim() || $('h2', section)?.textContent.trim() || '';

  function refreshSectionPositions() {
    sectionPositions = sections.map(section => ({
      element: section,
      top: section.getBoundingClientRect().top + window.scrollY,
      title: sectionTitle(section),
      id: section.id
    }));
    subsectionPositions = $$('.subsection-title').map(heading => ({
      element: heading,
      top: heading.getBoundingClientRect().top + window.scrollY,
      id: heading.id
    }));
  }

  const findActiveIndex = (positions, offset) => {
    let index = -1;
    for (let i = 0; i < positions.length; i += 1) {
      if (positions[i].top <= offset) index = i;
      else break;
    }
    return index;
  };

  const updateSectionUI = index => {
    if (index === activeSectionIndex) return;
    activeSectionIndex = index;

    sections.forEach((section, sectionIndex) => section.classList.toggle('is-current', sectionIndex === index));
    tocItems.forEach(item => item.classList.remove('active'));

    if (index < 0) {
      if (currentChapter) currentChapter.textContent = 'معرفی طرح';
      if (dockSectionNumber) dockSectionNumber.textContent = 'معرفی';
      if (dockSectionTitle) dockSectionTitle.textContent = 'مشخصات اولیه طرح';
      if (prevSectionButton) prevSectionButton.disabled = true;
      if (nextSectionButton) nextSectionButton.disabled = sections.length === 0;
      return;
    }

    const section = sections[index];
    const title = sectionTitle(section);
    const number = section.dataset.section || index + 1;
    const tocItem = tocItems.find(item => item.querySelector('.toc-main-link')?.getAttribute('href') === `#${section.id}`);
    tocItem?.classList.add('active');
    if (tocItem && !isElementMostlyVisible(tocItem, $('#sidebar .toc-nav'))) {
      tocItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    if (currentChapter) currentChapter.textContent = title;
    if (dockSectionNumber) dockSectionNumber.textContent = `فصل ${toPersianDigits(number)}`;
    if (dockSectionTitle) dockSectionTitle.textContent = title;
    if (prevSectionButton) prevSectionButton.disabled = index <= 0;
    if (nextSectionButton) nextSectionButton.disabled = index >= sections.length - 1;
  };

  const isElementMostlyVisible = (element, container) => {
    if (!element || !container) return true;
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return elementRect.top >= containerRect.top + 12 && elementRect.bottom <= containerRect.bottom - 12;
  };

  const updateOnScroll = () => {
    ticking = false;
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0;
    if (progressBar) progressBar.style.width = `${clamp(progress, 0, 100)}%`;

    const readingOffset = scrollY + (window.innerHeight * .24) + 85;
    const index = findActiveIndex(sectionPositions, readingOffset);
    updateSectionUI(index);

    tocSubLinks.forEach(link => link.classList.remove('active'));
    const subsectionIndex = findActiveIndex(subsectionPositions, readingOffset);
    if (subsectionIndex >= 0) {
      const activeSubsection = subsectionPositions[subsectionIndex];
      const parentSection = activeSubsection.element.closest('.document-section');
      if (parentSection === sections[index]) {
        $(`.toc-sublist a[href="#${activeSubsection.id}"]`)?.classList.add('active');
      }
    }

    const firstSectionTop = sectionPositions[0]?.top || Infinity;
    const footerTop = $('.site-footer')?.getBoundingClientRect().top + scrollY || Infinity;
    const showDock = scrollY > firstSectionTop - window.innerHeight * .4 && scrollY < footerTop - window.innerHeight * .65;
    readingDock?.classList.toggle('is-visible', showDock);
    backToTop?.classList.toggle('is-visible', scrollY > 700);
  };

  const requestScrollUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateOnScroll);
  };

  prevSectionButton?.addEventListener('click', () => {
    const target = sections[Math.max(0, activeSectionIndex - 1)];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  nextSectionButton?.addEventListener('click', () => {
    const nextIndex = activeSectionIndex < 0 ? 0 : Math.min(sections.length - 1, activeSectionIndex + 1);
    sections[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', () => {
    refreshSectionPositions();
    requestScrollUpdate();
    if (window.innerWidth > 860) closeMenu();
  });
  window.addEventListener('load', () => {
    refreshSectionPositions();
    requestScrollUpdate();
  });
  document.fonts?.ready?.then(() => {
    refreshSectionPositions();
    requestScrollUpdate();
  });
  refreshSectionPositions();
  updateOnScroll();

  /* ---------- TOC filter ---------- */
  const tocSearch = $('#tocSearch');
  tocSearch?.addEventListener('input', () => {
    const query = normalizePersian(tocSearch.value);
    tocItems.forEach(item => {
      const matches = !query || normalizePersian(item.textContent).includes(query);
      item.classList.toggle('is-hidden', !matches);
      if (query && matches) item.classList.add('active');
      else if (item !== tocItems[activeSectionIndex]) item.classList.remove('active');
    });
  });
  tocSearch?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      tocSearch.value = '';
      tocSearch.dispatchEvent(new Event('input'));
      tocSearch.blur();
    }
  });

  /* ---------- Search modal ---------- */
  const searchOverlay = $('#searchOverlay');
  const documentSearch = $('#documentSearch');
  const searchResults = $('#searchResults');
  const searchHint = $('#searchHint');
  let selectedSearchIndex = 0;
  let currentSearchResults = [];

  const searchIndex = [];
  sections.forEach(section => {
    const mainHeading = $('h2', section);
    const mainTitle = sectionTitle(section);
    const bodyText = $('.section-body', section)?.textContent.replace(/\s+/g, ' ').trim() || '';
    searchIndex.push({
      id: section.id,
      number: section.dataset.section || '',
      title: mainTitle,
      context: bodyText,
      normalized: normalizePersian(`${mainTitle} ${bodyText}`),
      kind: 'section'
    });
    $$('.subsection-title', section).forEach(subheading => {
      const clone = subheading.cloneNode(true);
      $('.anchor', clone)?.remove();
      const title = clone.textContent.replace(/\s+/g, ' ').trim();
      let context = '';
      let node = subheading.nextElementSibling;
      while (node && !node.matches('h3, h2')) {
        context += ` ${node.textContent}`;
        if (context.length > 650) break;
        node = node.nextElementSibling;
      }
      searchIndex.push({
        id: subheading.id,
        number: subheading.querySelector('span')?.textContent || section.dataset.section || '',
        title,
        context: context.replace(/\s+/g, ' ').trim(),
        normalized: normalizePersian(`${title} ${context}`),
        kind: 'subsection',
        parent: mainTitle
      });
    });
  });

  const openSearch = () => {
    if (!searchOverlay) return;
    closeReadingPanel();
    searchOverlay.hidden = false;
    body.style.overflow = 'hidden';
    selectedSearchIndex = 0;
    renderSearchResults(documentSearch?.value || '');
    requestAnimationFrame(() => documentSearch?.focus());
  };
  const closeSearch = () => {
    if (!searchOverlay || searchOverlay.hidden) return;
    searchOverlay.hidden = true;
    body.style.overflow = '';
  };

  const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlight = (value, query) => {
    if (!query) return escapeHTML(value);
    const safe = escapeHTML(value);
    try {
      return safe.replace(new RegExp(`(${escapeRegExp(escapeHTML(query))})`, 'ig'), '<mark>$1</mark>');
    } catch { return safe; }
  };
  const escapeHTML = value => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const getSnippet = (text, rawQuery) => {
    const compact = text.replace(/\s+/g, ' ').trim();
    if (!rawQuery) return compact.slice(0, 145) + (compact.length > 145 ? '…' : '');
    const normalizedText = normalizePersian(compact);
    const normalizedQuery = normalizePersian(rawQuery);
    const position = normalizedText.indexOf(normalizedQuery);
    const start = Math.max(0, position > -1 ? position - 55 : 0);
    const snippet = compact.slice(start, start + 185);
    return `${start > 0 ? '…' : ''}${snippet}${start + 185 < compact.length ? '…' : ''}`;
  };

  function renderSearchResults(rawQuery) {
    if (!searchResults || !searchHint) return;
    const normalizedQuery = normalizePersian(rawQuery);
    if (!normalizedQuery) {
      currentSearchResults = searchIndex.filter(item => item.kind === 'section').slice(0, 8);
      searchHint.innerHTML = '<span>فصل‌های اصلی سند</span><kbd>↑ ↓ انتخاب · Enter مشاهده</kbd>';
    } else {
      currentSearchResults = searchIndex
        .map(item => {
          const titleIndex = normalizePersian(item.title).indexOf(normalizedQuery);
          const bodyIndex = item.normalized.indexOf(normalizedQuery);
          let score = 0;
          if (titleIndex === 0) score += 100;
          else if (titleIndex > -1) score += 70;
          if (bodyIndex > -1) score += 25;
          if (item.kind === 'section') score += 4;
          return { ...item, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
      searchHint.innerHTML = `<span>${toPersianDigits(currentSearchResults.length)} نتیجه برای «${escapeHTML(rawQuery)}»</span><kbd>↑ ↓ انتخاب · Enter مشاهده</kbd>`;
    }

    selectedSearchIndex = clamp(selectedSearchIndex, 0, Math.max(0, currentSearchResults.length - 1));
    if (!currentSearchResults.length) {
      searchResults.innerHTML = '<div class="search-empty"><strong>نتیجه‌ای پیدا نشد</strong><span>عبارت کوتاه‌تر یا واژه‌ای مرتبط را امتحان کنید.</span></div>';
      return;
    }

    searchResults.innerHTML = currentSearchResults.map((item, index) => `
      <button class="search-result${index === selectedSearchIndex ? ' is-active' : ''}" type="button" role="option" aria-selected="${index === selectedSearchIndex}" data-target="${escapeHTML(item.id)}">
        <span class="search-result__number">${escapeHTML(String(item.number).padStart(2, '0'))}</span>
        <span>
          <strong>${highlight(item.title, rawQuery)}</strong>
          <small>${highlight(getSnippet(item.context || item.parent || '', rawQuery), rawQuery)}</small>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    `).join('');

    $$('.search-result', searchResults).forEach((button, index) => {
      button.addEventListener('mouseenter', () => {
        selectedSearchIndex = index;
        updateSearchSelection();
      });
      button.addEventListener('click', () => goToSearchResult(index));
    });
  }

  const updateSearchSelection = () => {
    $$('.search-result', searchResults).forEach((button, index) => {
      button.classList.toggle('is-active', index === selectedSearchIndex);
      button.setAttribute('aria-selected', String(index === selectedSearchIndex));
    });
    $$('.search-result', searchResults)[selectedSearchIndex]?.scrollIntoView({ block: 'nearest' });
  };

  const goToSearchResult = index => {
    const result = currentSearchResults[index];
    if (!result) return;
    closeSearch();
    const target = document.getElementById(result.id);
    if (!target) return;
    history.pushState(null, '', `#${result.id}`);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.animate?.([
      { boxShadow: '0 0 0 0 var(--primary-glow)' },
      { boxShadow: '0 0 0 8px var(--primary-glow)' },
      { boxShadow: '0 0 0 0 var(--primary-glow)' }
    ], { duration: 950, easing: 'ease-out' });
  };

  $('#docSearchButton')?.addEventListener('click', openSearch);
  $('#searchClose')?.addEventListener('click', closeSearch);
  searchOverlay?.addEventListener('click', event => {
    if (event.target === searchOverlay) closeSearch();
  });
  documentSearch?.addEventListener('input', () => {
    selectedSearchIndex = 0;
    renderSearchResults(documentSearch.value);
  });
  documentSearch?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedSearchIndex = Math.min(currentSearchResults.length - 1, selectedSearchIndex + 1);
      updateSearchSelection();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedSearchIndex = Math.max(0, selectedSearchIndex - 1);
      updateSearchSelection();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      goToSearchResult(selectedSearchIndex);
    } else if (event.key === 'Escape') closeSearch();
  });

  document.addEventListener('keydown', event => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === '/' && !isTyping && searchOverlay?.hidden) {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === 'Escape') {
      closeSearch();
      closeReadingPanel();
      closeMenu();
    }
  });

  /* ---------- Anchor links ---------- */
  $$('.anchor').forEach(anchor => {
    anchor.title = 'کپی پیوند مستقیم';
    anchor.addEventListener('click', async event => {
      event.preventDefault();
      const href = anchor.getAttribute('href');
      if (!href) return;
      history.pushState(null, '', href);
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const absoluteURL = `${window.location.origin}${window.location.pathname}${href}`;
      try {
        await navigator.clipboard.writeText(absoluteURL);
        showToast('پیوند مستقیم این بخش کپی شد');
      } catch {
        showToast('پیوند این بخش در نوار آدرس قرار گرفت');
      }
    });
  });

  /* ---------- Reading time ---------- */
  const wordCount = $('.document-content')?.textContent.trim().split(/\s+/).filter(Boolean).length || 0;
  const readingMinutes = Math.max(1, Math.round(wordCount / 180));
  if ($('#readingTime')) $('#readingTime').textContent = toPersianDigits(readingMinutes);

  /* ---------- Toast ---------- */
  let toastTimer;
  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2300);
  }
})();

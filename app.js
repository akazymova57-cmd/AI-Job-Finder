const CACHE_KEY = "aijf_multi_source_cache_v2";
const CACHE_TTL = 6 * 60 * 60 * 1000;
const TRACKER_KEY = "aijf_saved_jobs_v1";

const state = {
  jobs: [],
  query: "",
  resumeText: "",
  resumeSkills: [],
  sourceStatus: "",
  loading: false,
  savedJobs: readSavedJobs(),
  currentPage: 1,
  pageSize: 10,
  quickCategory: "",
  quickSource: "",
  quickView: "all"
};

const $ = (id) => document.getElementById(id);
let currentLanguage = localStorage.getItem("aijf_language") === "en" ? "en" : "ru";

function applyLanguage() {
  const dictionary = (window.APP_TRANSLATIONS && window.APP_TRANSLATIONS[currentLanguage]) || {};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (["SCRIPT", "STYLE", "TEXTAREA"].includes(node.parentElement?.tagName)) continue;
    let translated = node.nodeValue;
    Object.entries(dictionary)
      .sort((a, b) => b[0].length - a[0].length)
      .forEach(([source, target]) => {
        if (source && translated.includes(source)) translated = translated.split(source).join(target);
      });
    node.nodeValue = translated;
  }

  document.querySelectorAll("[placeholder], [aria-label], [title]").forEach((element) => {
    ["placeholder", "aria-label", "title"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value && dictionary[value]) element.setAttribute(attribute, dictionary[value]);
    });
  });

  document.documentElement.lang = currentLanguage;
  const toggle = $("language-toggle");
  if (toggle) toggle.textContent = currentLanguage === "ru" ? "RU / EN" : "EN / RU";
}

$("language-toggle")?.addEventListener("click", () => {
  currentLanguage = currentLanguage === "ru" ? "en" : "ru";
  localStorage.setItem("aijf_language", currentLanguage);
  location.reload();
});

const SKILL_CATALOG = [
  { id: "customer-support", label: "Customer support", terms: ["customer support", "customer service", "technical support", "support agent", "поддержка клиентов", "служба поддержки", "работа с клиентами"] },
  { id: "data-entry", label: "Data entry", terms: ["data entry", "ввод данных"] },
  { id: "virtual-assistant", label: "Virtual assistance", terms: ["virtual assistant", "executive assistant", "administrative assistant", "personal assistant", "виртуальный ассистент", "личный ассистент"] },
  { id: "research", label: "Research", terms: ["market research", "legal research", "research", "исследование", "исследовательская работа"] },
  { id: "writing", label: "Writing / copywriting", terms: ["content writing", "copywriting", "technical writing", "writing", "написание текстов", "копирайтинг"] },
  { id: "translation", label: "Translation", terms: ["translation", "translator", "переводчик", "перевод"] },
  { id: "social-media", label: "Social media", terms: ["social media", "community management", "smm", "социальные сети"] },
  { id: "sales", label: "Sales / lead generation", terms: ["lead generation", "business development", "sales", "продажи", "лидогенерация"] },
  { id: "crm", label: "CRM", terms: ["crm", "hubspot", "salesforce", "amocrm"] },
  { id: "spreadsheets", label: "Excel / Google Sheets", terms: ["google sheets", "spreadsheets", "excel", "электронные таблицы"] },
  { id: "project-management", label: "Project management", terms: ["project management", "project coordination", "jira", "asana", "trello", "управление проектами"] },
  { id: "ai-tools", label: "AI tools / prompting", terms: ["prompt engineering", "generative ai", "chatgpt", "ai tools", "нейросети", "промпт-инжиниринг"] },
  { id: "analytics", label: "Data analysis", terms: ["data analysis", "data analytics", "аналитика данных", "анализ данных"] },
  { id: "sql", label: "SQL", terms: ["sql"] },
  { id: "python", label: "Python", terms: ["python"] },
  { id: "javascript", label: "JavaScript / TypeScript", terms: ["javascript", "typescript"] },
  { id: "web-basics", label: "HTML / CSS", terms: ["html", "css"] },
  { id: "design", label: "Figma / Canva", terms: ["figma", "canva", "photoshop"] },
  { id: "recruitment", label: "Recruitment", terms: ["recruitment", "talent acquisition", "candidate sourcing", "рекрутинг", "подбор персонала"] },
  { id: "international-relations", label: "International relations", terms: ["international relations", "foreign policy", "international affairs", "международные отношения", "внешняя политика"] },
  { id: "legal", label: "Legal / compliance", terms: ["compliance", "contract review", "legal analysis", "юридический анализ", "правовой анализ", "юридическая работа"] },
  { id: "english", label: "English", terms: ["english", "английский"] },
  { id: "russian", label: "Russian", terms: ["russian", "русский язык"] }
];

const entryPattern = /junior|entry[\s-]?level|no experience|without experience|graduate|trainee|intern(?:ship)?|associate|assistant|coordinator|customer support|support agent|data annotat|virtual assistant|без опыта|начальн\w*\s+уровн|стаж[её]р|помощник/i;
const internPattern = /intern(?:ship)?|trainee|стаж[её]ровк|стаж[её]р/i;
const seniorPattern = /senior|lead|principal|staff engineer|head of|director|высококвалифицированн|руководител[ья]/i;

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return cleanText(value).toLocaleLowerCase();
}

function containsTerm(text, term) {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;

  if (/[а-яё]/i.test(normalizedTerm)) {
    return text.includes(normalizedTerm);
  }

  const escaped = normalizedTerm
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp("(^|[^a-z0-9])" + escaped + "(?=$|[^a-z0-9])", "i").test(text);
}

function extractSkills(value) {
  const text = normalizeText(value);
  return SKILL_CATALOG.filter((skill) => skill.terms.some((term) => containsTerm(text, term)));
}

function updateResumeProfile() {
  state.currentPage = 1;
  state.resumeText = $("resume-text").value;
  state.resumeSkills = extractSkills(state.resumeText);

  const summary = $("resume-summary");
  summary.replaceChildren();

  const description = document.createElement("div");
  if (!state.resumeText.trim()) {
    description.textContent = "Резюме не добавлено. Без него вакансии сортируются по ключевому запросу, а оценка навыков не рассчитывается.";
    summary.append(description);
    state.sourceStatus = "";
    render();
    return;
  }

  if (!state.resumeSkills.length) {
    description.textContent = "Текст резюме загружен, но словарь пока не распознал навыки. Укажи конкретные инструменты и компетенции на русском или английском.";
    summary.append(description);
  } else {
    description.textContent = "Распознано навыков: " + state.resumeSkills.length + ". Оценка будет учитывать только навыки из этого словаря:";
    summary.append(description);

    const list = document.createElement("div");
    list.className = "skill-list";
    state.resumeSkills.forEach((skill) => {
      const chip = document.createElement("span");
      chip.className = "skill-chip";
      chip.textContent = skill.label;
      list.append(chip);
    });
    summary.append(list);
  }

  state.sourceStatus = "";
  render();
}

function readAnyCache() {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (value && Array.isArray(value.jobs) && Number.isFinite(value.savedAt)) return value;
  } catch (_) {}
  return null;
}

function readFreshCache() {
  const value = readAnyCache();
  if (value && Date.now() - value.savedAt < CACHE_TTL) return value;
  return null;
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "время неизвестно" : date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadJobs(force) {
  if (state.loading) return;
  const cached = readAnyCache();
  if (!force && cached && Date.now() - cached.savedAt < CACHE_TTL) {
    state.jobs = cached.jobs;
    state.sourceStatus = "Кэш списка от " + formatTime(cached.savedAt) + ".";
    render();
    return;
  }
  if (!state.jobs.length && cached) state.jobs = cached.jobs;
  state.loading = true;
  $("refresh").disabled = true;
  $("status").textContent = "Загружаем общий список вакансий…";
  try {
    const response = await fetch("./data/jobs.json", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status + " при загрузке снимка вакансий");
    const snapshot = await response.json();
    if (!snapshot || !Array.isArray(snapshot.jobs)) throw new Error("Файл вакансий имеет неверный формат");
    state.jobs = snapshot.jobs.filter(job => isRecentJob(job) && passesSafetyChecks(job));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), jobs: state.jobs })); } catch (_) {}
    const statuses = Array.isArray(snapshot.sourceStatuses) ? snapshot.sourceStatuses : [];
    const details = statuses.map(source => source.label + ": " + (source.status === "success" ? source.accepted + " вакансий" : "ошибка обновления"));
    state.sourceStatus = "Снимок от " + formatTime(snapshot.updatedAt) + ". " + details.join(" · ");
    if (statuses.some(source => source.status !== "success")) state.sourceStatus += " Часть источников использует ранее сохранённые данные.";
  } catch (error) {
    state.sourceStatus = state.jobs.length
      ? "Не удалось обновить общий список (" + error.message + "). Показан последний сохранённый список."
      : "Не удалось загрузить вакансии (" + error.message + "). Попробуй позже.";
  } finally {
    state.loading = false;
    $("refresh").disabled = false;
    render();
  }
}

function locationMatches(job, filter) {
  if (filter === "any") return true;

  const value = String(job.candidate_required_location || "").toLowerCase();
  if (filter === "worldwide") return /worldwide|anywhere|global|everywhere|🌍/.test(value);
  if (filter === "europe") return /europe|emea|european|uk|united kingdom|germany|france|spain|poland|netherlands|european union/i.test(value);
  if (filter === "americas") return /americ|united states|usa|canada|latin/i.test(value);
  if (filter === "asia") return /asia|india|singapore|japan|china|philippines|indonesia/i.test(value);
  return true;
}

function getJobText(job) {
  return normalizeText([
    job.title,
    job.company_name,
    job.description,
    ...(Array.isArray(job.tags) ? job.tags : [])
  ].join(" "));
}

function getJobCategoryText(job) {
  // Use role metadata, title and tags only; descriptions often contain
  // unrelated boilerplate that makes category filters too broad.
  return normalizeText([
    job.title,
    job.category,
    job.job_category,
    ...(Array.isArray(job.tags) ? job.tags : [])
  ].join(" "));
}

function categoryMatches(job, category) {
  const text = getJobCategoryText(job);
  const patterns = {
    it: /software developer|software engineer|web developer|frontend|front-end|backend|back-end|full[- ]stack|programmer|devops|data analyst|quality assurance|\bqa\b|sql developer|python developer|javascript|разработчик|программист|тестировщик|аналитик данных/i,
    design: /design|designer|figma|ux\b|ui\b|graphic|visual|дизайн|дизайнер/i,
    marketing: /marketing|seo|sem\b|growth|social media|smm|performance|маркетинг|продвижен/i,
    support: /customer support|customer service|customer care|client support|support engineer|technical support|support specialist|support agent|help ?desk|service desk|customer success|поддержк|служба поддержки|специалист поддержки|инженер поддержки/i,
    writing: /copywriter|copywriting|content writer|technical writer|editor|writing|копирайт|редактор|автор текст/i,
    admin: /administrative|administrator|virtual assistant|operations|coordinator|data entry|office manager|администратор|ассистент|ввод данных/i
  };
  if (category === "it" && patterns.support.test(text)) return false;
  return Boolean(patterns[category] && patterns[category].test(text));
}

function getResumeMatch(job) {
  if (!state.resumeSkills.length) return null;

  const jobSkills = extractSkills(getJobText(job));
  if (!jobSkills.length) {
    return { score: null, matched: [], missing: [], total: 0 };
  }

  const candidateIds = new Set(state.resumeSkills.map((skill) => skill.id));
  const matched = jobSkills.filter((skill) => candidateIds.has(skill.id));
  const missing = jobSkills.filter((skill) => !candidateIds.has(skill.id));

  return {
    score: Math.round((matched.length / jobSkills.length) * 100),
    matched: matched.map((skill) => skill.label),
    missing: missing.map((skill) => skill.label),
    total: jobSkills.length
  };
}

function queryRelevance(job, query) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 0;

  const title = normalizeText(job.title);
  const tags = normalizeText((job.tags || []).join(" "));
  const description = normalizeText(job.description);

  return words.reduce((score, word) => {
    if (title.includes(word)) return score + 5;
    if (tags.includes(word)) return score + 3;
    if (description.includes(word)) return score + 1;
    return score;
  }, 0);
}

function jobDate(job) {
  const value = Date.parse(job.publication_date || job.created_at || "");
  return Number.isFinite(value) ? value : 0;
}

function safeJobUrl(value, sourceId) {
  try {
    const url = new URL(value);
    const candidates = sourceId ? (APP_CONFIG.sources[sourceId] ? [APP_CONFIG.sources[sourceId]] : []) : Object.values(APP_CONFIG.sources);
    const hostAllowed = candidates.some(source => source.allowedHosts.some(host => url.hostname === host || url.hostname.endsWith("." + host)));
    return url.protocol === "https:" && hostAllowed ? url.href : "";
  } catch (_) {
    return "";
  }
}

function isRecentJob(job) {
  const publishedAt = jobDate(job);
  const age = Date.now() - publishedAt;
  return publishedAt > 0 && age >= 0 && age <= APP_CONFIG.maxJobAgeDays * 24 * 60 * 60 * 1000;
}

function passesSafetyChecks(job) {
  if (!job || !String(job.company_name || "").trim() || !safeJobUrl(job.url, job.source_id)) return false;
  const text = cleanText([job.title, job.description, job.salary].join(" "));
  return !APP_CONFIG.fraudPatterns.some((pattern) => pattern.test(text));
}

function renderPagination(totalItems, totalPages, startIndex, endIndex) {
  const navs = [$("pagination-top"), $("pagination")].filter(Boolean);
  navs.forEach((nav) => {
    nav.replaceChildren();
    nav.hidden = totalPages <= 1;
    if (totalPages <= 1) return;

  const addButton = (label, page, options = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-button" + (options.active ? " is-active" : "");
    button.textContent = label;
    button.dataset.page = String(page);
    button.disabled = Boolean(options.disabled);
    if (options.active) button.setAttribute("aria-current", "page");
    button.setAttribute("aria-label", options.ariaLabel || ("Страница " + page));
    nav.append(button);
  };

  addButton(currentLanguage === "ru" ? "← Назад" : "← Previous", state.currentPage - 1, {
    disabled: state.currentPage === 1,
    ariaLabel: currentLanguage === "ru" ? "Предыдущая страница" : "Previous page"
  });

  const first = Math.max(1, state.currentPage - 2);
  const last = Math.min(totalPages, state.currentPage + 2);
  if (first > 1) {
    addButton("1", 1, { active: state.currentPage === 1 });
    if (first > 2) {
      const dots = document.createElement("span");
      dots.className = "page-ellipsis";
      dots.textContent = "…";
      nav.append(dots);
    }
  }
  for (let page = first; page <= last; page += 1) {
    addButton(String(page), page, { active: page === state.currentPage });
  }
  if (last < totalPages) {
    if (last < totalPages - 1) {
      const dots = document.createElement("span");
      dots.className = "page-ellipsis";
      dots.textContent = "…";
      nav.append(dots);
    }
    addButton(String(totalPages), totalPages, { active: state.currentPage === totalPages });
  }

  addButton(currentLanguage === "ru" ? "Далее →" : "Next →", state.currentPage + 1, {
    disabled: state.currentPage === totalPages,
    ariaLabel: currentLanguage === "ru" ? "Следующая страница" : "Next page"
  });
  });
}

function render() {
  const query = state.query.trim();
  const location = $("location").value;
  const level = $("level").value;
  const type = $("type").value;
  const salaryOnly = $("salary-only").checked;

  const filtered = state.jobs.filter((job) => {
    if (!isRecentJob(job) || !passesSafetyChecks(job)) return false;
    const text = getJobText(job);
    if (query && !normalizeText(query).split(/\s+/).filter(Boolean).every((word) => text.includes(word))) return false;
    if (!locationMatches(job, location)) return false;
    if (level === "entry" && !entryPattern.test(text)) return false;
    if (level === "intern" && !internPattern.test(text)) return false;
    if (level === "experienced" && !seniorPattern.test(text)) return false;
    if (type !== "all" && job.job_type !== type) return false;
    if (salaryOnly && !job.salary) return false;
    if (state.quickCategory && !categoryMatches(job, state.quickCategory)) return false;
    if (state.quickSource && job.source_id !== state.quickSource) return false;
    if (state.quickView === "favorites" && !state.savedJobs.some((saved) => saved.url === safeJobUrl(job.url, job.source_id))) return false;
    if (state.quickView === "today") {
      const published = jobDate(job);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      if (published < startOfToday) return false;
    }
    return true;
  });

  const sortMode = $("sort").value;
  filtered.sort((a, b) => {
    if (sortMode === "newest") return jobDate(b) - jobDate(a);
    if (sortMode === "salary") {
      const salaryDifference = Number(Boolean(b.salary)) - Number(Boolean(a.salary));
      if (salaryDifference) return salaryDifference;
      return jobDate(b) - jobDate(a);
    }

    if (state.resumeSkills.length) {
      const aScore = getResumeMatch(a);
      const bScore = getResumeMatch(b);
      const aValue = aScore && aScore.score !== null ? aScore.score : -1;
      const bValue = bScore && bScore.score !== null ? bScore.score : -1;
      if (bValue !== aValue) return bValue - aValue;
    }

    const relevanceDifference = queryRelevance(b, query) - queryRelevance(a, query);
    return relevanceDifference || jobDate(b) - jobDate(a);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, filtered.length);
  const pageJobs = filtered.slice(startIndex, endIndex);

  const container = $("jobs");
  container.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = state.jobs.length
      ? "По этим фильтрам вакансий не найдено. Измени запрос или параметры."
      : "Пока нет загруженных вакансий. Попробуй обновить список позже.";
    container.append(empty);
  } else {
    pageJobs.forEach((job) => {
      const card = document.createElement("article");
      card.className = "job-card";

      const top = document.createElement("div");
      top.className = "job-top";
      const info = document.createElement("div");

      const company = document.createElement("div");
      company.className = "company";
      company.textContent = job.company_name || "Компания не указана";

      const title = document.createElement("h3");
      title.textContent = job.title || "Вакансия без названия";

      const meta = document.createElement("div");
      meta.className = "meta";
      const metaParts = [
        job.candidate_required_location || "Remote",
        job.salary || "",
        job.job_type ? String(job.job_type).replace(/_/g, " ") : "",
        jobDate(job) ? new Date(jobDate(job)).toLocaleDateString("ru-RU") : "",
        job.source_name || ""
      ].filter(Boolean);
      meta.textContent = metaParts.join(" · ");

      info.append(company, title, meta);
      top.append(info);
      card.append(top);

      const badges = document.createElement("div");
      badges.className = "badges";

      const isEntry = entryPattern.test(getJobText(job));
      const levelBadge = document.createElement("span");
      levelBadge.className = "badge " + (isEntry ? "entry" : "warning");
      levelBadge.textContent = isEntry ? "Есть признаки начального уровня" : "Уровень не подтверждён";
      badges.append(levelBadge);

      (Array.isArray(job.tags) ? job.tags : []).slice(0, 3).forEach((tag) => {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = tag;
        badges.append(badge);
      });

      if (job.salary) {
        const salaryBadge = document.createElement("span");
        salaryBadge.className = "badge";
        salaryBadge.textContent = "Зарплата указана";
        badges.append(salaryBadge);
      }
      card.append(badges);

      const translationButton = document.createElement("button");
      translationButton.type = "button";
      translationButton.className = "translate-button";
      translationButton.textContent = currentLanguage === "ru" ? "Перевести на русский" : "Translate to Russian";
      const translationOutput = document.createElement("div");
      translationOutput.className = "translation-output";
      translationButton.addEventListener("click", async () => {
        translationButton.disabled = true;
        translationButton.textContent = currentLanguage === "ru" ? "Переводим…" : "Translating…";
        try {
          const sourceText = cleanText(job.description || "");
          if (!sourceText) throw new Error("Описание вакансии отсутствует");
          const response = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(sourceText.slice(0, 4500)) + "&langpair=en|ru");
          if (!response.ok) throw new Error("Сервис перевода временно недоступен");
          const result = await response.json();
          const translated = result && result.responseData && result.responseData.translatedText;
          if (!translated) throw new Error("Перевод не получен");
          translationOutput.textContent = translated;
          translationOutput.hidden = false;
          translationButton.textContent = "Скрыть перевод";
        } catch (error) {
          translationOutput.textContent = "Не удалось перевести: " + error.message;
          translationOutput.hidden = false;
          translationButton.textContent = "Повторить перевод";
        } finally {
          translationButton.disabled = false;
        }
      });
      card.append(translationButton, translationOutput);

      if (state.resumeSkills.length) {
        const match = getResumeMatch(job);
        const matchDetails = document.createElement("div");
        matchDetails.className = "match-details";

        if (!match || match.score === null) {
          matchDetails.textContent = "Совпадение навыков не рассчитано: в описании вакансии не распознаны навыки из текущего словаря.";
        } else {
          const matchLabel = document.createElement("div");
          matchLabel.className = "match";
          matchLabel.textContent = "Совпадение распознанных навыков: " + match.score + "% (" + match.matched.length + " из " + match.total + ")";

          const matchedLine = document.createElement("div");
          matchedLine.className = "match-details";
          const matchedStrong = document.createElement("strong");
          matchedStrong.textContent = "Совпало: ";
          matchedLine.append(matchedStrong, document.createTextNode(match.matched.length ? match.matched.join(", ") : "пока нет"));

          const missingLine = document.createElement("div");
          missingLine.className = "match-details";
          const missingStrong = document.createElement("strong");
          missingStrong.textContent = "Не найдено в резюме: ";
          missingLine.append(missingStrong, document.createTextNode(match.missing.length ? match.missing.join(", ") : "все распознанные навыки вакансии есть в резюме"));

          matchDetails.append(matchLabel, matchedLine, missingLine);
        }
        card.append(matchDetails);
      } else {
        const hint = document.createElement("div");
        hint.className = "match-details";
        hint.textContent = "Добавь резюме, чтобы увидеть совпадение навыков.";
        card.append(hint);
      }

      const bottom = document.createElement("div");
      bottom.className = "card-bottom";

      const relevance = document.createElement("span");
      relevance.className = "match";
      relevance.textContent = state.resumeSkills.length
        ? "Оценка по словарю навыков"
        : (query ? "Релевантность ключевому запросу" : "Новая вакансия");

      const link = document.createElement("a");
      link.className = "apply";
      link.textContent = "Открыть на " + (job.source_name || "источнике") + " ↗";
      link.href = safeJobUrl(job.url, job.source_id);
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const favorite = document.createElement("button");
      favorite.type = "button";
      favorite.className = "favorite-button";
      favorite.dataset.favoriteUrl = safeJobUrl(job.url, job.source_id);
      const isSaved = state.savedJobs.some((item) => item.url === favorite.dataset.favoriteUrl);
      favorite.textContent = isSaved ? "★ В избранном" : "☆ В избранное";
      favorite.classList.toggle("is-saved", isSaved);

      const report = document.createElement("a");
      report.className = "report-link";
      report.textContent = "Пожаловаться";
      report.href = "https://github.com/akazymova57-cmd/AI-Job-Finder/issues/new?title=" + encodeURIComponent("Жалоба на вакансию: " + (job.title || "Без названия")) + "&body=" + encodeURIComponent("Ссылка: " + safeJobUrl(job.url, job.source_id) + "\nКомпания: " + (job.company_name || "не указана") + "\nОпишите проблему:");
      report.target = "_blank";
      report.rel = "noopener noreferrer";
      bottom.append(relevance, link, favorite, report);
      card.append(bottom);
      container.append(card);
    });
  }

  const sourceCounts = filtered.reduce((counts, job) => {
    const source = job.source_name || "Источник не указан";
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  const sourceSummary = Object.entries(sourceCounts).map(([source, count]) => source + ": " + count).join(" · ");
  const countText = filtered.length
    ? "Показано вакансий: " + (startIndex + 1) + "–" + endIndex + " из " + filtered.length + " (всего в базе " + state.jobs.length + ")." + (sourceSummary ? " По источникам: " + sourceSummary + "." : "")
    : "Показано вакансий: 0 из " + state.jobs.length + ".";
  renderPagination(filtered.length, totalPages, startIndex, endIndex);
  $("status").textContent = (state.sourceStatus ? state.sourceStatus + " " : "") + countText;

  container.querySelectorAll("[data-favorite-url]").forEach((button) => {
    const saved = state.savedJobs.some((item) => item.url === button.dataset.favoriteUrl);
    button.textContent = saved ? "★ В избранном" : "☆ В избранное";
    button.classList.toggle("is-saved", saved);
  });
  renderTracker();
  applyLanguage();
}


const APPLICATION_STATUSES = [
  ["saved", "В избранном"],
  ["planned", "Планирую откликнуться"],
  ["applied", "Отклик отправлен"],
  ["interview", "Собеседование"],
  ["rejected", "Отказ"],
  ["accepted", "Получено предложение"]
];

function readSavedJobs() {
  try {
    const value = JSON.parse(localStorage.getItem(TRACKER_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.url === "string") : [];
  } catch (_) { return []; }
}

function persistSavedJobs() {
  try {
    localStorage.setItem(TRACKER_KEY, JSON.stringify(state.savedJobs));
    return true;
  } catch (_) {
    state.sourceStatus = "Не удалось сохранить избранное. Проверь настройки хранения браузера.";
    return false;
  }
}

function renderTracker() {
  const list = $("tracker-list");
  const count = $("tracker-count");
  if (!list || !count) return;
  count.textContent = state.savedJobs.length + " вакансий";
  list.replaceChildren();
  if (!state.savedJobs.length) {
    const empty = document.createElement("p");
    empty.className = "tracker-empty";
    empty.textContent = "Сохраняй вакансии кнопкой «В избранное», чтобы вести список откликов.";
    list.append(empty);
    return;
  }
  state.savedJobs.forEach((job) => {
    const item = document.createElement("article");
    item.className = "tracker-item";
    const info = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = job.title || "Вакансия без названия";
    const company = document.createElement("p");
    company.textContent = job.company || "Компания не указана";
    info.append(title, company);
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Статус отклика: " + title.textContent);
    APPLICATION_STATUSES.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    select.value = job.status || "saved";
    select.addEventListener("change", () => {
      job.status = select.value;
      persistSavedJobs();
    });
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    const link = document.createElement("a");
    link.href = safeJobUrl(job.url, job.source_id);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Первоисточник ↗";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "favorite-button";
    remove.textContent = "Убрать";
    remove.addEventListener("click", () => {
      state.savedJobs = state.savedJobs.filter((saved) => saved.url !== job.url);
      persistSavedJobs();
      render();
    });
    actions.append(link, remove);
    item.append(info, select, actions);
    list.append(item);
  });
}


function setSidebarActive(element) {
  document.querySelectorAll("#sidebar-nav .sidebar-link").forEach((link) => {
    const active = link === element;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
  $("sidebar-open")?.setAttribute("aria-expanded", "false");
}

$("sidebar-open")?.addEventListener("click", () => {
  document.body.classList.add("sidebar-open");
  $("sidebar-open").setAttribute("aria-expanded", "true");
});
$("sidebar-close")?.addEventListener("click", closeSidebar);
$("sidebar-backdrop")?.addEventListener("click", closeSidebar);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSidebar();
});

$("sidebar-nav")?.addEventListener("click", (event) => {
  const item = event.target.closest(".sidebar-link");
  if (!item) return;
  if (item.dataset.view === "about") {
    setSidebarActive(item);
    closeSidebar();
    return;
  }

  state.currentPage = 1;
  state.quickCategory = item.dataset.category || "";
  state.quickSource = item.dataset.source || "";
  state.quickView = item.dataset.view || (item.dataset.category || item.dataset.source || item.dataset.employment ? "filtered" : "all");

  if (item.dataset.view === "all") {
    $("query").value = "";
    state.query = "";
    $("location").value = "any";
    $("level").value = "all";
    $("type").value = "all";
    $("sort").value = "match";
    $("salary-only").checked = false;
    state.quickCategory = "";
    state.quickSource = "";
  } else if (item.dataset.view === "today") {
    $("sort").value = "newest";
    $("query").value = "";
    state.query = "";
    state.quickCategory = "";
    state.quickSource = "";
  } else if (item.dataset.view === "favorites") {
    $("query").value = "";
    state.query = "";
    $("location").value = "any";
    $("level").value = "all";
    $("type").value = "all";
    $("salary-only").checked = false;
    state.quickCategory = "";
    state.quickSource = "";
  } else if (item.dataset.employment) {
    $("type").value = item.dataset.employment;
    state.quickCategory = "";
    state.quickSource = "";
  } else if (item.dataset.category) {
    // A sidebar category is a standalone shortcut: remove stale search and
    // form filters so they cannot silently hide matching vacancies.
    $("query").value = "";
    state.query = "";
    $("location").value = "any";
    $("level").value = "all";
    $("type").value = "all";
    $("salary-only").checked = false;
    $("sort").value = "newest";
    state.quickSource = "";
  } else if (item.dataset.source) {
    $("type").value = "all";
    state.quickCategory = "";
  }

  setSidebarActive(item);
  closeSidebar();
  render();
  $("results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

[$("pagination-top"), $("pagination")].filter(Boolean).forEach((nav) => nav.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;
  const nextPage = Number(button.dataset.page);
  if (!Number.isInteger(nextPage) || nextPage < 1) return;
  state.currentPage = nextPage;
  render();
  $("jobs").scrollIntoView({ behavior: "smooth", block: "start" });
}));

$("jobs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-url]");
  if (!button) return;
  const url = button.dataset.favoriteUrl;
  const existing = state.savedJobs.find((job) => job.url === url);
  if (existing) {
    state.savedJobs = state.savedJobs.filter((job) => job.url !== url);
  } else {
    const source = state.jobs.find((job) => safeJobUrl(job.url) === url);
    if (source) state.savedJobs.push({
      url,
      title: source.title || "Вакансия без названия",
      company: source.company_name || "Компания не указана",
      status: "saved",
      source_id: source.source_id,
      source_name: source.source_name
    });
  }
  persistSavedJobs();
  render();
});

$("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.currentPage = 1;
  state.query = $("query").value;
  render();
});

["location", "level", "type", "sort", "salary-only"].forEach((id) => {
  $(id).addEventListener("change", () => {
    state.currentPage = 1;
    render();
  });
});

$("refresh").addEventListener("click", () => {
  state.currentPage = 1;
  loadJobs(true);
});

$("resume-text").addEventListener("input", () => {
  $("resume-file-name").textContent = "";
  $("resume-file").value = "";
  updateResumeProfile();
});

$("resume-file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const extension = file.name.split(".").pop().toLowerCase();
  if (!["txt", "md"].includes(extension)) {
    state.sourceStatus = "Поддерживаются только файлы TXT и MD.";
    $("resume-file").value = "";
    $("status").textContent = state.sourceStatus;
    return;
  }

  if (file.size > 1024 * 1024) {
    state.sourceStatus = "Файл слишком большой. Максимальный размер — 1 МБ.";
    $("resume-file").value = "";
    $("status").textContent = state.sourceStatus;
    return;
  }

  try {
    const text = await file.text();
    $("resume-text").value = text;
    $("resume-file-name").textContent = file.name;
    updateResumeProfile();
  } catch (_) {
    state.sourceStatus = "Не удалось прочитать файл. Попробуй сохранить резюме как TXT или MD.";
    $("status").textContent = state.sourceStatus;
  }
});

$("clear-resume").addEventListener("click", () => {
  $("resume-text").value = "";
  $("resume-file").value = "";
  $("resume-file-name").textContent = "";
  updateResumeProfile();
});

loadJobs(false);
const API_URL = "https://remotive.com/api/remote-jobs";
const CACHE_KEY = "aijf_remotive_cache_v1";
const REQUESTS_KEY = "aijf_remotive_requests_v1";
const CACHE_TTL = 6 * 60 * 60 * 1000;
const REQUEST_WINDOW = 24 * 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 4;
const TRACKER_KEY = "aijf_saved_jobs_v1";

const state = {
  jobs: [],
  query: "",
  resumeText: "",
  resumeSkills: [],
  sourceStatus: "",
  loading: false,
  savedJobs: readSavedJobs()
};

const $ = (id) => document.getElementById(id);

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

function readRequestTimes() {
  try {
    const value = JSON.parse(localStorage.getItem(REQUESTS_KEY));
    if (!Array.isArray(value)) return [];
    return value.filter((time) => Number.isFinite(time) && Date.now() - time < REQUEST_WINDOW);
  } catch (_) {
    return [];
  }
}

function recordApiRequest() {
  const times = readRequestTimes();
  times.push(Date.now());
  try {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(times));
  } catch (_) {}
  return times;
}

function nextRequestTime(times) {
  if (times.length < MAX_REQUESTS_PER_WINDOW) return null;
  return Math.min.apply(null, times) + REQUEST_WINDOW;
}

function formatTime(value) {
  return new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadJobs(force) {
  if (state.loading) return;

  const freshCache = readFreshCache();
  const anyCache = readAnyCache();

  if (!force && freshCache) {
    state.jobs = freshCache.jobs;
    state.sourceStatus = "Показан кэш Remotive от " + formatTime(freshCache.savedAt) + "; новый запрос не выполнялся.";
    render();
    return;
  }

  if (!state.jobs.length && anyCache) state.jobs = anyCache.jobs;

  const requestTimes = readRequestTimes();
  if (requestTimes.length >= MAX_REQUESTS_PER_WINDOW) {
    const availableAt = nextRequestTime(requestTimes);
    state.sourceStatus = "Лимит Remotive: не более четырёх запросов за 24 часа с этого браузера. Следующее обновление возможно после " + formatTime(availableAt) + ".";
    render();
    return;
  }

  state.loading = true;
  $("refresh").disabled = true;
  $("status").textContent = "Загружаем вакансии из Remotive…";
  recordApiRequest();

  try {
    const response = await fetch(API_URL + "?limit=100", {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    if (!data || !Array.isArray(data.jobs)) throw new Error("API вернул неожиданный формат данных");

    state.jobs = data.jobs.filter((job) => isRecentJob(job) && passesSafetyChecks(job));
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), jobs: state.jobs }));
    } catch (_) {}

    state.sourceStatus = "Источник: Remotive. Последнее получение: " + formatTime(Date.now()) + ". Локальный лимит — четыре запроса за 24 часа.";
  } catch (error) {
    if (state.jobs.length) {
      state.sourceStatus = "Не удалось обновить Remotive (" + error.message + "). Показан последний сохранённый список.";
    } else {
      state.sourceStatus = "Не удалось загрузить вакансии (" + error.message + "). Проверь подключение и попробуй позже.";
    }
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

function safeJobUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "https://remotive.com/";
  } catch (_) {
    return "https://remotive.com/";
  }
}

function render() {
  const query = state.query.trim();
  const location = $("location").value;
  const level = $("level").value;
  const type = $("type").value;
  const salaryOnly = $("salary-only").checked;

  const filtered = state.jobs.filter((job) => {\n    if (!isRecentJob(job) || !passesSafetyChecks(job)) return false;
    const text = getJobText(job);
    if (query && !normalizeText(query).split(/\s+/).filter(Boolean).every((word) => text.includes(word))) return false;
    if (!locationMatches(job, location)) return false;
    if (level === "entry" && !entryPattern.test(text)) return false;
    if (level === "intern" && !internPattern.test(text)) return false;
    if (level === "experienced" && !seniorPattern.test(text)) return false;
    if (type !== "all" && job.job_type !== type) return false;
    if (salaryOnly && !job.salary) return false;
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
    filtered.forEach((job) => {
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
        jobDate(job) ? new Date(jobDate(job)).toLocaleDateString("ru-RU") : ""
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
      link.textContent = "Открыть первоисточник ↗";
      link.href = safeJobUrl(job.url);
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const favorite = document.createElement("button");
      favorite.type = "button";
      favorite.className = "favorite-button";
      favorite.dataset.favoriteUrl = safeJobUrl(job.url);
      const isSaved = state.savedJobs.some((item) => item.url === favorite.dataset.favoriteUrl);
      favorite.textContent = isSaved ? "★ В избранном" : "☆ В избранное";
      favorite.classList.toggle("is-saved", isSaved);

      const report = document.createElement("a");
      report.className = "report-link";
      report.textContent = "Пожаловаться";
      report.href = "https://github.com/akazymova57-cmd/AI-Job-Finder/issues/new?title=" + encodeURIComponent("Жалоба на вакансию: " + (job.title || "Без названия")) + "&body=" + encodeURIComponent("Ссылка: " + safeJobUrl(job.url) + "\\nКомпания: " + (job.company_name || "не указана") + "\\nОпишите проблему:");
      report.target = "_blank";
      report.rel = "noopener noreferrer";
      bottom.append(relevance, link, favorite, report);
      card.append(bottom);
      container.append(card);
    });
  }

  const countText = "Показано вакансий: " + filtered.length + " из " + state.jobs.length + ".";

  container.querySelectorAll("[data-favorite-url]").forEach((button) => {
    const saved = state.savedJobs.some((item) => item.url === button.dataset.favoriteUrl);
    button.textContent = saved ? "★ В избранном" : "☆ В избранное";
    button.classList.toggle("is-saved", saved);
  });
  renderTracker();
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
    link.href = safeJobUrl(job.url);
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
      status: "saved"
    });
  }
  persistSavedJobs();
  render();
});

$("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = $("query").value;
  render();
});

["location", "level", "type", "sort", "salary-only"].forEach((id) => {
  $(id).addEventListener("change", render);
});

$("refresh").addEventListener("click", () => loadJobs(true));

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
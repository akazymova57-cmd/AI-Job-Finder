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
  quickView: "all",
  difficultyFilter: "all"
};

const $ = (id) => document.getElementById(id);

let currentJobsLayout = "grid";
try {
  currentJobsLayout = localStorage.getItem("aijf_jobs_layout") === "list" ? "list" : "grid";
} catch (_) {}

function setJobsLayout(layout) {
  currentJobsLayout = layout === "list" ? "list" : "grid";
  const jobs = $("jobs");
  if (jobs) {
    jobs.classList.toggle("is-list-view", currentJobsLayout === "list");
    jobs.dataset.layout = currentJobsLayout;
  }
  document.querySelectorAll(".view-button").forEach((button) => {
    const active = button.dataset.layout === currentJobsLayout;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  try { localStorage.setItem("aijf_jobs_layout", currentJobsLayout); } catch (_) {}
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(".view-button");
  if (!button) return;
  event.preventDefault();
  setJobsLayout(button.dataset.layout);
});
try {
  const savedPageSize = Number(localStorage.getItem("aijf_page_size"));
  if ([10, 20, 50].includes(savedPageSize)) state.pageSize = savedPageSize;
} catch (_) {}

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

function hasMandatoryExperienceRequirement(job) {
  const title = normalizeText(job.title || "");
  // Seniority is inferred from the role title only, never from incidental
  // mentions of "lead" or "director" elsewhere in the description.
  if (/\b(?:senior|lead|principal|staff|head of|director)\b|руководител/i.test(title)) return true;

  const description = [job.description, ...(Array.isArray(job.tags) ? job.tags : [])]
    .map((value) => String(value || "").replace(/<[^>]*>/g, " "))
    .join("\n");
  const sections = description.split(/[.!?;\n]+/).map(cleanText).filter(Boolean);
  const yearsPattern = /(?:at least|minimum(?: of)?|more than|over)\s*\d+\s*(?:years?|yrs?)|\b\d+\s*\+\s*(?:years?|yrs?)|\b\d+\s*(?:-|–|to)\s*\d+\s*(?:years?|yrs?)\b|\b\d+\s*(?:years?|yrs?)\s+(?:of )?experience|опыт\s+от\s+\d+\s+лет|не менее\s+\d+\s+лет/i;
  const optionalPattern = /preferred|preferably|nice to have|desired|желательно|желателен|будет плюсом/i;
  const noExperiencePattern = /no (?:prior )?experience(?: is)? (?:required|needed)|no prior experience|without (?:prior )?experience|experience (?:is )?not required|без опыта|опыт не требуется/i;
  const mandatoryPattern = /(?:must have|required|requirement is|обязателен|обязательно|требуется)\s+(?:at least\s+)?(?:prior\s+)?experience|experience\s+(?:is\s+)?(?:required|mandatory)|опыт работы\s+(?:обязателен|обязательно)|требуется опыт работы/i;

  return sections.some((section) => {
    // "No experience required" contains the words "experience required";
    // explicitly handle the negation before testing mandatory wording.
    if (noExperiencePattern.test(section)) return false;
    const yearMatches = [...section.matchAll(new RegExp(yearsPattern.source, "gi"))];
    if (yearMatches.length) {
      return yearMatches.some((match) => {
        const start = Math.max(0, match.index - 70);
        const end = Math.min(section.length, match.index + match[0].length + 70);
        return !optionalPattern.test(section.slice(start, end));
      });
    }
    return mandatoryPattern.test(section) && !optionalPattern.test(section);
  });
}

function getExperienceSortRank(job) {
  const title = normalizeText(job.title || "");
  const mandatory = hasMandatoryExperienceRequirement(job);
  if (!mandatory && (entryPattern.test(title) || isEntryLevelJob(job))) return 0;
  if (mandatory) return 2;
  return 1;
}

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
    .replace(/\s+/g, "\s+");
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

  const value = String(job.candidate_required_location || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .trim();

  if (filter === "worldwide") {
    // Worldwide means unrestricted eligibility, not a list of selected countries.
    // Normalize harmless formatting, then require the entire location field to
    // express global eligibility. Any appended country/region restriction fails.
    if (!value || /eligibility not specified|not specified|unspecified|unknown|remote only/i.test(value)) return false;

    const scope = value
      .replace(/[()[\]{}]/g, " ")
      .replace(/[|,:;/]+/g, " ")
      .replace(/[-–—]+/g, " ")
      .replace(/\bremote(?:\s+work)?\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    return /^(?:🌍\s*)?(?:worldwide|anywhere(?: in the world)?|work from anywhere(?: in the world)?|global(?:ly)?|everywhere|all countries|any country|no (?:geo(?:graphic)?|location) restrictions)(?:\s+(?:remote|only|eligible|available|location|based|work|from|the|world))*[.!]?$/i.test(scope);
  }
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
    it: /software developer|software engineer|web developer|frontend|front-end|backend|back-end|full[- ]stack|programmer|engineer|engineering|devops|data analyst|quality assurance|\bqa\b|sql developer|python developer|javascript|разработчик|программист|инженер|тестировщик|аналитик данных/i,
    design: /design|designer|figma|ux\b|ui\b|graphic|visual|дизайн|дизайнер/i,
    marketing: /marketing|seo|sem\b|growth|social media|smm|performance|маркетинг|продвижен/i,
    support: /customer support|customer service|customer care|client support|support engineer|technical support|support specialist|support agent|help ?desk|service desk|customer success|поддержк|служба поддержки|специалист поддержки|инженер поддержки/i,
    writing: /copywriter|copywriting|content writer|technical writer|editor|writing|копирайт|редактор|автор текст/i,
    admin: /administrative|administrator|virtual assistant|operations|coordinator|data entry|office manager|администратор|ассистент|ввод данных/i
  };
  if (category === "it" && patterns.support.test(text)) return false;
  return Boolean(patterns[category] && patterns[category].test(text));
}


function isEntryLevelJob(job) {
  const title = normalizeText(job.title || "");
  const description = normalizeText(job.description || "");
  if (/\b(junior|entry.level|intern|trainee|graduate)\b|стаж[её]р|младш/i.test(title)) return true;
  return /no experience (?:required|needed)|no prior experience|without experience|entry.level|0\s*[-–]\s*1 years?|training (?:will be )?provided|без опыта|опыт не требуется/i.test(description);
}

function getJobDifficulty(job) {
  const text = getJobText(job);
  const title = normalizeText(job.title || "");
  const seniorTitle = /\b(senior|lead|principal|staff|architect|director|head of)\b|руководител|архитектор/i.test(title);
  const yearsMatch = text.match(/\b(5|6|7|8|9|10)\s*\+?\s*(?:years?|yrs?)\b|(?:5|6|7|8|9|10)\s*\+?\s*(?:лет|года)/i);
  const complexSignals = /advanced|expert|deep knowledge|hands-on experience|multiple programming languages|machine learning|машинное обучение|глубокие знания/i.test(text);
  const skillCount = extractSkills(text).length;
  let points = 0;
  if (seniorTitle || yearsMatch) points += 2;
  if (complexSignals) points += 1;
  if (skillCount >= 8) points += 2;
  else if (skillCount >= 4) points += 1;
  if (/bachelor|master|phd|degree required|certification required|высшее образование обязательно/i.test(text)) points += 1;
  if (isEntryLevelJob(job) && !seniorTitle) points -= 2;
  const level = points <= 0 ? "easy" : points <= 2 ? "medium" : "hard";
  return { level, label: level === "easy" ? "Лёгкая" : level === "medium" ? "Средняя" : "Высокая", bars: level === "easy" ? 2 : level === "medium" ? 3 : 5 };
}

function getEnglishRequirement(job) {
  const text = cleanText(job.description || "");
  const explicit = text.match(/(?:english|английск\w*)[^.\n]{0,45}\b(A1|A2|B1|B2|C1|C2)\b|\b(A1|A2|B1|B2|C1|C2)\b[^.\n]{0,35}(?:english|английск\w*)/i);
  if (explicit) return (explicit[1] || explicit[2]).toUpperCase();
  if (/native[- ]level english|fluent in english|английский свободно|свободное владение английским/i.test(text)) return "C1+";
  if (/conversational english|intermediate english|английский разговорный|английский средний/i.test(text)) return "B1–B2";
  if (/basic english|английский базовый|начальный английский/i.test(text)) return "A1–A2";
  return "Не указан";
}

function hasExplicitEnglishRequirement(job) {
  const sentences = getJobText(job).split(/[.!?\n]+/);
  const mandatory = /required|mandatory|must have|must be|need(?:ed)? to|fluent in|proficient in|excellent command|strong command|native speaker|обязател|требуется|необходимо|свободно владеть|уверенное владение/i;
  const optional = /preferred|preferably|nice to have|a plus|bonus|желательно|будет плюсом/i;
  return sentences.some((sentence) =>
    /english|английск/i.test(sentence) && mandatory.test(sentence) && !optional.test(sentence)
  );
}

function hasExplicitNoDegreeRequirement(job) {
  const text = getJobText(job);
  return /no degree required|degree (?:is )?not required|degree optional|without a degree|university degree not required|college degree not required|equivalent experience (?:is )?accepted|degree or equivalent experience|диплом не требуется|без высшего образования|высшее образование не обязательно|образование не требуется/i.test(text);
}

function getExperienceRequirement(job) {
  const text = getJobText(job);
  if (/no experience|without experience|entry.level|без опыта|опыт не требуется/i.test(text)) return "Без опыта";
  const years = text.match(/(?:at least |minimum |минимум )?(\d+)\s*\+?\s*(?:years?|yrs?|лет|года|год)/i);
  if (years) return Number(years[1]) + "+ лет";
  if (/\b(senior|lead|principal|staff|head of|director)\b|руководител/i.test(normalizeText(job.title || ""))) return "Senior / Lead";
  if (isEntryLevelJob(job)) return "Начальный";
  return "Не указан";
}

function getFreshnessLabel(job) {
  const published = jobDate(job);
  if (!published) return "Дата не указана";
  const days = Math.max(0, Math.floor((Date.now() - published) / 86400000));
  if (days === 0) return "Сегодня";
  if (days === 1) return "Вчера";
  return days + " дн. назад";
}

function createInsight(label, value, className) {
  const item = document.createElement("div");
  item.className = "insight-item" + (className ? " " + className : "");
  const caption = document.createElement("span");
  caption.className = "insight-label";
  caption.textContent = label;
  const content = document.createElement("strong");
  content.className = "insight-value";
  content.textContent = value;
  item.append(caption, content);
  return item;
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

function renderActiveFilters() {
  const container = $("active-filters");
  if (!container) return;
  container.replaceChildren();

  const active = [];
  const add = (key, label) => active.push({ key, label });
  if (state.query.trim()) add("query", "Поиск: " + state.query.trim());
  if ($("location").value !== "worldwide") add("location", $("location").selectedOptions[0]?.textContent || "География");
  if ($("level").value !== "all") add("level", $("level").selectedOptions[0]?.textContent || "Уровень");
  if ($("type").value !== "all") add("type", $("type").selectedOptions[0]?.textContent || "Занятость");
  if ($("no-experience-only").checked) add("no-experience-only", "Без обязательного опыта");
  if ($("salary-only").checked) add("salary-only", "С зарплатой");
  if ($("no-english-required-only").checked) add("no-english-required-only", "Без обязательного английского");
  if ($("no-degree-required-only").checked) add("no-degree-required-only", "Без обязательного диплома");
  if (state.difficultyFilter !== "all") {
    const labels = { easy: "Лёгкая сложность", medium: "Средняя сложность", hard: "Высокая сложность" };
    add("difficulty", labels[state.difficultyFilter] || "Сложность");
  }
  if (state.quickCategory) {
    const labels = { support: "Поддержка", admin: "Администрирование", marketing: "Маркетинг", writing: "Тексты", it: "IT" };
    add("category", labels[state.quickCategory] || "Категория");
  }
  if (state.quickSource) {
    const labels = { jobicy: "Jobicy", himalayas: "Himalayas", weworkremotely: "We Work Remotely", remoteok: "Remote OK" };
    add("source", labels[state.quickSource] || "Источник");
  }
  if (state.quickView === "today") add("today", "Новые сегодня");
  if (state.quickView === "favorites") add("favorites", "Избранное");

  if (!active.length) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const label = document.createElement("span");
  label.className = "active-filters-label";
  label.textContent = currentLanguage === "ru" ? "АКТИВНЫЕ ФИЛЬТРЫ" : "ACTIVE FILTERS";
  container.append(label);

  active.forEach(({ key, label: value }) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "active-filter-chip";
    chip.dataset.removeFilter = key;
    chip.setAttribute("aria-label", (currentLanguage === "ru" ? "Убрать фильтр: " : "Remove filter: ") + value);
    chip.innerHTML = "<span></span><span aria-hidden=\"true\">×</span>";
    chip.firstElementChild.textContent = value;
    container.append(chip);
  });

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "active-filters-clear";
  clear.dataset.removeFilter = "all";
  clear.textContent = currentLanguage === "ru" ? "Сбросить всё" : "Clear all";
  container.append(clear);
}

document.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-remove-filter]");
  if (!chip) return;
  const key = chip.dataset.removeFilter;
  if (key === "all") {
    resetSearchFilters();
  } else if (key === "query") {
    $("query").value = "";
    state.query = "";
  } else if (["location", "level", "type"].includes(key)) {
    const defaults = { location: "worldwide", level: "all", type: "all" };
    $(key).value = defaults[key];
  } else if (["salary-only", "no-experience-only", "no-english-required-only", "no-degree-required-only"].includes(key)) {
    $(key).checked = false;
  } else if (key === "difficulty") {
    state.difficultyFilter = "all";
    document.querySelectorAll("[data-difficulty-filter]").forEach((button) => {
      const active = button.dataset.difficultyFilter === "all";
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  } else if (key === "category") {
    state.quickCategory = "";
    state.quickView = state.quickSource ? "filtered" : "all";
  } else if (key === "source") {
    state.quickSource = "";
    state.quickView = state.quickCategory ? "filtered" : "all";
  } else if (key === "today" || key === "favorites") {
    state.quickView = "all";
  }
  state.currentPage = 1;
  if (key !== "all") {
    const activeNav = document.querySelector("#sidebar-nav .sidebar-link.is-active");
    if (activeNav && ((key === "category" && activeNav.dataset.category) || (key === "source" && activeNav.dataset.source) || (["today", "favorites"].includes(key) && activeNav.dataset.view === key))) {
      activeNav.classList.remove("is-active");
      activeNav.removeAttribute("aria-current");
    }
  } else {
    document.querySelectorAll("#sidebar-nav .sidebar-link").forEach((item) => {
      const active = item.dataset.view === "all";
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }
  render();
});

function render() {
  const pageSizeSelect = $("page-size");
  if (pageSizeSelect && pageSizeSelect.value !== String(state.pageSize)) pageSizeSelect.value = String(state.pageSize);
  const query = state.query.trim();
  const location = $("location").value;
  const level = $("level").value;
  const type = $("type").value;
  const salaryOnly = $("salary-only").checked;
  const noExperienceOnly = $("no-experience-only").checked;
  const noEnglishRequiredOnly = $("no-english-required-only").checked;
  const noDegreeRequiredOnly = $("no-degree-required-only").checked;

  const filtered = state.jobs.filter((job) => {
    if (!isRecentJob(job) || !passesSafetyChecks(job)) return false;
    const text = getJobText(job);
    if (state.difficultyFilter !== "all" && getJobDifficulty(job).level !== state.difficultyFilter) return false;
    if (query && !normalizeText(query).split(/\s+/).filter(Boolean).every((word) => text.includes(word))) return false;
    if (!locationMatches(job, location)) return false;
    if (level === "entry" && !entryPattern.test(text)) return false;
    if (level === "intern" && !internPattern.test(text)) return false;
    if (level === "experienced" && !seniorPattern.test(text)) return false;
    if (noExperienceOnly && hasMandatoryExperienceRequirement(job)) return false;
    if (noEnglishRequiredOnly && hasExplicitEnglishRequirement(job)) return false;
    if (noDegreeRequiredOnly && !hasExplicitNoDegreeRequirement(job)) return false;
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

    // Put entry-level/no-experience roles first, unspecified requirements next,
    // and jobs with mandatory experience last.
    if (sortMode === "no-experience") {
      const difference = getExperienceSortRank(a) - getExperienceSortRank(b);
      if (difference) return difference;
    }
    if (sortMode === "entry") {
      const difference = Number(isEntryLevelJob(b)) - Number(isEntryLevelJob(a));
      if (difference) return difference;
    }
    if (sortMode === "intern") {
      const difference = Number(internPattern.test(getJobText(b))) - Number(internPattern.test(getJobText(a)));
      if (difference) return difference;
    }
    if (sortMode === "easy") {
      const rank = { easy: 0, medium: 1, hard: 2 };
      const difference = rank[getJobDifficulty(a).level] - rank[getJobDifficulty(b).level];
      if (difference) return difference;
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
      const globalEligibility = locationMatches(job, "worldwide");
      const geoBadge = document.createElement("span");
      geoBadge.className = "badge " + (globalEligibility ? "entry" : "warning");
      geoBadge.textContent = globalEligibility ? "🌍 Worldwide" : (job.candidate_required_location ? "Ограничения: " + job.candidate_required_location : "География не указана");
      badges.append(geoBadge);
      const isEntry = isEntryLevelJob(job);
      const levelBadge = document.createElement("span");
      levelBadge.className = "badge " + (isEntry ? "entry" : "warning");
      levelBadge.textContent = isEntry ? "Начальный уровень" : (/\b(senior|lead|principal|staff|head of|director)\b|руководител/i.test(normalizeText(job.title || "")) ? "Senior / Lead" : "Опыт не подтверждён");
      badges.append(levelBadge);
      (Array.isArray(job.tags) ? job.tags : []).slice(0, 2).forEach((tag) => {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = tag;
        badges.append(badge);
      });
      card.append(badges);

      const details = document.createElement("details");
      details.className = "job-details";
      const detailsSummary = document.createElement("summary");
      detailsSummary.textContent = currentLanguage === "ru" ? "Подробности и оценка" : "Details and assessment";
      details.append(detailsSummary);

      const difficulty = getJobDifficulty(job);
      const insights = document.createElement("div");
      insights.className = "job-insights";
      const difficultyItem = createInsight("Сложность · оценка", difficulty.label, "difficulty-" + difficulty.level);
      const difficultyTrack = document.createElement("div");
      difficultyTrack.className = "difficulty-track " + difficulty.level;
      for (let index = 0; index < 5; index += 1) {
        const segment = document.createElement("span");
        if (index < difficulty.bars) segment.classList.add("filled");
        difficultyTrack.append(segment);
      }
      difficultyItem.append(difficultyTrack);
      insights.append(difficultyItem);
      insights.append(createInsight("Английский · требование", getEnglishRequirement(job)));
      insights.append(createInsight("Опыт · требование", getExperienceRequirement(job)));
      insights.append(createInsight("Опубликована", getFreshnessLabel(job)));
      details.append(insights);

      if (job.salary) {
        const salaryBox = document.createElement("div");
        salaryBox.className = "salary-highlight";
        const salaryValue = document.createElement("strong");
        salaryValue.textContent = job.salary;
        const salaryLabel = document.createElement("span");
        salaryLabel.textContent = "Зарплата из объявления";
        salaryBox.append(salaryValue, salaryLabel);
        details.append(salaryBox);
      }

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
      details.append(translationButton, translationOutput);

      if (state.resumeSkills.length) {
        const match = getResumeMatch(job);
        const matchDetails = document.createElement("div");
        matchDetails.className = "match-details";
        if (!match || match.score === null) {
          matchDetails.textContent = "Совпадение навыков не рассчитано: в описании вакансии не распознаны навыки из текущего словаря.";
        } else {
          const row = document.createElement("div");
          row.className = "match-score-row";
          const matchLabel = document.createElement("span");
          matchLabel.className = "match";
          matchLabel.textContent = "Совпадение навыков · " + match.score + "%";
          const matchCount = document.createElement("span");
          matchCount.textContent = match.matched.length + " из " + match.total;
          row.append(matchLabel, matchCount);
          const track = document.createElement("div");
          track.className = "match-track";
          const fill = document.createElement("span");
          fill.className = "filled";
          fill.style.flex = String(Math.max(1, match.score)) + " 1 0";
          const remainder = document.createElement("span");
          remainder.style.flex = String(Math.max(1, 100 - match.score)) + " 1 0";
          track.append(fill, remainder);
          const matchedLine = document.createElement("div");
          matchedLine.className = "match-details";
          matchedLine.textContent = "Совпало: " + (match.matched.length ? match.matched.join(", ") : "пока нет");
          const missingLine = document.createElement("div");
          missingLine.className = "match-details";
          missingLine.textContent = "Не найдено: " + (match.missing.length ? match.missing.join(", ") : "все распознанные навыки найдены");
          matchDetails.append(row, track, matchedLine, missingLine);
        }
        details.append(matchDetails);
      } else {
        const hint = document.createElement("div");
        hint.className = "match-details";
        hint.textContent = "Добавь резюме, чтобы увидеть совпадение навыков.";
        details.append(hint);
      }

      card.append(details);

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
  renderActiveFilters();
  renderPagination(filtered.length, totalPages, startIndex, endIndex);
  $("status").textContent = (state.sourceStatus ? state.sourceStatus + " " : "") + countText;

  container.querySelectorAll("[data-favorite-url]").forEach((button) => {
    const saved = state.savedJobs.some((item) => item.url === button.dataset.favoriteUrl);
    button.textContent = saved ? "★ В избранном" : "☆ В избранное";
    button.classList.toggle("is-saved", saved);
  });
  renderTracker();
  setJobsLayout(currentJobsLayout);
  applyLanguage();
}


let trackerFilter = "all";

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
  const stats = $("tracker-stats");
  const filters = $("tracker-filters");
  if (!list || !count) return;

  const total = state.savedJobs.length;
  const countByStatus = (status) => state.savedJobs.filter((job) => (job.status || "saved") === status).length;
  const stages = [["saved", "В избранном"], ["planned", "В планах"], ["applied", "Отклики"], ["interview", "Интервью"], ["accepted", "Офферы"]];
  count.textContent = total + " " + (total === 1 ? "вакансия" : "вакансий");

  if (stats) {
    stats.replaceChildren();
    stages.forEach(([status, label]) => {
      const tile = document.createElement("div");
      tile.className = "tracker-stat tracker-stat-" + status;
      const value = document.createElement("strong");
      value.textContent = String(countByStatus(status));
      const caption = document.createElement("span");
      caption.textContent = label;
      tile.append(value, caption);
      stats.append(tile);
    });
    const progress = document.createElement("div");
    progress.className = "tracker-progress";
    progress.setAttribute("role", "img");
    const progressed = ["applied", "interview", "accepted"].reduce((sum, status) => sum + countByStatus(status), 0);
    progress.setAttribute("aria-label", progressed + " откликов продвинулись по этапам из " + total + " сохранённых вакансий");
    const fill = document.createElement("span");
    fill.style.width = (total ? Math.round(progressed / total * 100) : 0) + "%";
    progress.append(fill);
    stats.append(progress);
  }
  filters?.querySelectorAll("[data-tracker-filter]").forEach((button) => {
    const active = button.dataset.trackerFilter === trackerFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  list.replaceChildren();
  const visibleJobs = trackerFilter === "all" ? state.savedJobs : state.savedJobs.filter((job) => (job.status || "saved") === trackerFilter);
  if (!total) {
    const empty = document.createElement("div");
    empty.className = "tracker-empty tracker-empty-state";
    const icon = document.createElement("span");
    icon.className = "tracker-empty-icon";
    icon.textContent = "✳";
    const title = document.createElement("strong");
    title.textContent = "Твой карьерный трекер начинается здесь";
    const message = document.createElement("p");
    message.textContent = "Сохраняй интересные вакансии — здесь появится личная доска поиска и откликов.";
    empty.append(icon, title, message);
    list.append(empty);
    return;
  }
  if (!visibleJobs.length) {
    const empty = document.createElement("p");
    empty.className = "tracker-empty";
    empty.textContent = "На этом этапе пока нет вакансий. Измени статус одной из сохранённых вакансий.";
    list.append(empty);
    return;
  }

  visibleJobs.forEach((job) => {
    const item = document.createElement("article");
    item.className = "tracker-item";
    const info = document.createElement("div");
    info.className = "tracker-item-info";
    const title = document.createElement("h3");
    title.textContent = job.title || "Вакансия без названия";
    const company = document.createElement("p");
    company.textContent = [job.company || "Компания не указана", job.source_name || ""].filter(Boolean).join(" · ");
    info.append(title, company);

    const statusWrap = document.createElement("label");
    statusWrap.className = "tracker-status-wrap";
    const statusLabel = document.createElement("span");
    statusLabel.textContent = "ЭТАП";
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
      job.updatedAt = new Date().toISOString();
      persistSavedJobs();
      renderTracker();
    });
    statusWrap.append(statusLabel, select);

    const actions = document.createElement("div");
    actions.className = "tracker-item-actions";
    const link = document.createElement("a");
    link.href = safeJobUrl(job.url, job.source_id);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Открыть ↗";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "favorite-button";
    remove.textContent = "Убрать";
    remove.setAttribute("aria-label", "Убрать из избранного: " + title.textContent);
    remove.addEventListener("click", () => {
      state.savedJobs = state.savedJobs.filter((saved) => saved.url !== job.url);
      persistSavedJobs();
      render();
    });
    actions.append(link, remove);
    item.append(info, statusWrap, actions);
    list.append(item);
  });
}


$("tracker-filters")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tracker-filter]");
  if (!button) return;
  trackerFilter = button.dataset.trackerFilter || "all";
  renderTracker();
});

function setSidebarActive(element) {
  document.querySelectorAll("#sidebar-nav .sidebar-link").forEach((link) => {
    const active = link === element;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

const sidebarToggle = $("sidebar-open");
const sidebar = document.querySelector(".filter-sidebar");

function openSidebar() {
  if (!sidebar || !sidebarToggle) return;
  document.body.classList.add("sidebar-open");
  sidebarToggle.setAttribute("aria-expanded", "true");
  sidebar.querySelector("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])")?.focus();
}

function closeSidebar({ restoreFocus = true } = {}) {
  const wasOpen = document.body.classList.contains("sidebar-open");
  document.body.classList.remove("sidebar-open");
  sidebarToggle?.setAttribute("aria-expanded", "false");
  if (restoreFocus && wasOpen) sidebarToggle?.focus();
}

sidebarToggle?.addEventListener("click", openSidebar);
$("sidebar-close")?.addEventListener("click", closeSidebar);
$("sidebar-backdrop")?.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (event) => {
  if (!document.body.classList.contains("sidebar-open")) return;
  if (event.key === "Escape") {
    closeSidebar();
    return;
  }
  if (event.key !== "Tab" || !sidebar) return;

  const focusable = [...sidebar.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) {
    event.preventDefault();
    sidebarToggle?.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 1024) closeSidebar({ restoreFocus: false });
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
    $("location").value = "worldwide";
    $("level").value = "all";
    $("type").value = "all";
    $("sort").value = "match";
    $("salary-only").checked = false;
    $("no-experience-only").checked = false;
    $("no-english-required-only").checked = false;
    $("no-degree-required-only").checked = false;
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
    $("no-experience-only").checked = false;
    $("no-english-required-only").checked = false;
    $("no-degree-required-only").checked = false;
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
      savedAt: new Date().toISOString(),
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

document.querySelector(".hero-queries")?.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-hero-query]");
  if (!chip) return;
  $("query").value = chip.dataset.heroQuery || "";
  $("search-form").requestSubmit();
  $("results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("page-size")?.addEventListener("change", () => {
  const nextSize = Number($("page-size").value);
  if (![10, 20, 50].includes(nextSize)) return;
  state.pageSize = nextSize;
  state.currentPage = 1;
  try { localStorage.setItem("aijf_page_size", String(nextSize)); } catch (_) {}
  render();
});

["location", "level", "type", "sort", "salary-only", "no-experience-only", "no-english-required-only", "no-degree-required-only"].forEach((id) => {
  $(id).addEventListener("change", () => {
    state.currentPage = 1;
    render();
  });
});

document.querySelectorAll("[data-difficulty-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.difficultyFilter = button.dataset.difficultyFilter || "all";
    state.currentPage = 1;
    document.querySelectorAll("[data-difficulty-filter]").forEach((option) => {
      const active = option === button;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-pressed", String(active));
    });
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


/* Lightweight command center and results layout controls */
const commandDialog = $("command-dialog");
const commandSearch = $("command-search");
const commandItems = [...document.querySelectorAll(".command-item")];

function openCommandCenter() {
  if (!commandDialog || commandDialog.open) return;
  commandDialog.showModal();
  commandSearch.value = "";
  commandItems.forEach((item) => { item.hidden = false; });
  requestAnimationFrame(() => commandSearch.focus());
}

function closeCommandCenter() {
  if (commandDialog?.open) commandDialog.close();
  $("command-open")?.focus();
}

$("command-open")?.addEventListener("click", openCommandCenter);
$("command-close")?.addEventListener("click", closeCommandCenter);
commandDialog?.addEventListener("click", (event) => {
  if (event.target === commandDialog) closeCommandCenter();
});

commandSearch?.addEventListener("input", () => {
  const query = normalizeText(commandSearch.value);
  commandItems.forEach((item) => {
    item.hidden = query && !normalizeText(item.textContent).includes(query);
  });
});

commandDialog?.addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  const visibleItems = commandItems.filter((item) => !item.hidden);
  if (!visibleItems.length) return;
  event.preventDefault();
  const currentIndex = visibleItems.indexOf(document.activeElement);
  const direction = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = currentIndex < 0
    ? (direction > 0 ? 0 : visibleItems.length - 1)
    : (currentIndex + direction + visibleItems.length) % visibleItems.length;
  visibleItems[nextIndex].focus();
});

function resetSearchFilters() {
  $("query").value = "";
  state.query = "";
  $("location").value = "worldwide";
  $("level").value = "all";
  $("type").value = "all";
  $("sort").value = "match";
  ["salary-only", "no-experience-only", "no-english-required-only", "no-degree-required-only"].forEach((id) => { $(id).checked = false; });
  state.quickCategory = "";
  state.quickSource = "";
  state.quickView = "all";
  state.difficultyFilter = "all";
  document.querySelectorAll("[data-difficulty-filter]").forEach((button) => {
    const active = button.dataset.difficultyFilter === "all";
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  state.currentPage = 1;
  document.querySelectorAll("#sidebar-nav .sidebar-link").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === "all");
    if (item.dataset.view === "all") item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
}

function runCommand(command) {
  if (command === "entry") {
    resetSearchFilters();
    $("level").value = "entry";
    $("no-experience-only").checked = true;
  } else if (command === "worldwide") {
    resetSearchFilters();
  } else if (command === "salary") {
    resetSearchFilters();
    $("salary-only").checked = true;
  } else if (command === "today") {
    resetSearchFilters();
    state.quickView = "today";
    $("sort").value = "newest";
  } else if (command === "favorites") {
    resetSearchFilters();
    state.quickView = "favorites";
    $("location").value = "any";
    setSidebarActive(document.querySelector('#sidebar-nav [data-view="favorites"]'));
  } else if (command === "reset") {
    resetSearchFilters();
  } else if (command === "search") {
    closeCommandCenter();
    $("query").focus();
    $("query").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  render();
  closeCommandCenter();
  $("results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

commandItems.forEach((item) => item.addEventListener("click", () => runCommand(item.dataset.command)));

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (commandDialog?.open) closeCommandCenter();
    else openCommandCenter();
  }
  if (event.key === "/" && !commandDialog?.open && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    openCommandCenter();
  }
});

setJobsLayout(currentJobsLayout);

loadJobs(false);
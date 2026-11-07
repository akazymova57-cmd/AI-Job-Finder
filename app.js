const API_URL = "https://remotive.com/api/remote-jobs";
const CACHE_KEY = "aijf_remotive_cache_v1";
const CACHE_TTL = 6 * 60 * 60 * 1000;
const state = { jobs: [], query: "" };
const $ = (id) => document.getElementById(id);

function readCache() {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (value && Date.now() - value.savedAt < CACHE_TTL && Array.isArray(value.jobs)) return value.jobs;
  } catch (_) {}
  return null;
}
function saveCache(jobs) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), jobs })); } catch (_) {}
}
async function loadJobs(force = false) {
  const status = $("status");
  status.textContent = "Загружаем свежие вакансии…";
  if (!force) {
    const cached = readCache();
    if (cached) { state.jobs = cached; render(); status.textContent = "Показаны сохранённые данные. Автообновление не чаще одного раза в 6 часов."; return; }
  }
  try {
    const response = await fetch(API_URL + "?limit=100", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data.jobs)) throw new Error("Неожиданный формат ответа API");
    state.jobs = data.jobs;
    saveCache(state.jobs);
    render();
    status.textContent = "Найдено в источнике: " + state.jobs.length + ". Последняя загрузка: " + new Date().toLocaleString("ru-RU") + ".";
  } catch (error) {
    status.textContent = "Не удалось загрузить вакансии. Проверь подключение и попробуй ещё раз. (" + error.message + ")";
    $("jobs").innerHTML = '<div class="empty">Источник временно недоступен. Попробуй обновить страницу позже.</div>';
  }
}
const entryPattern = /junior|entry.level|entry level|no experience|without experience|graduate|trainee|intern|internship|associate|assistant|coordinator|customer support|support agent|data annotat|virtual assistant/i;
const internPattern = /intern|internship|trainee/i;
function locationMatches(job, filter) {
  if (filter === "any") return true;
  const value = (job.candidate_required_location || "").toLowerCase();
  if (filter === "worldwide") return /worldwide|anywhere|global|everywhere| 🌍/.test(value);
  if (filter === "europe") return /europe|emea|european|uk|united kingdom|germany|france|spain|poland|netherlands/i.test(value);
  if (filter === "americas") return /americ|united states|usa|canada|latin/i.test(value);
  if (filter === "asia") return /asia|india|singapore|japan|china|philippines|indonesia/i.test(value);
  return true;
}
function scoreJob(job, query) {
  let score = 0;
  const title = (job.title || "").toLowerCase();
  const description = (job.description || "").replace(/<[^>]*>/g, " ").toLowerCase();
  const tags = (job.tags || []).join(" ").toLowerCase();
  const text = title + " " + tags + " " + description;
  if (entryPattern.test(title)) score += 3;
  if (internPattern.test(title)) score += 2;
  if (/worldwide|anywhere|global/i.test(job.candidate_required_location || "")) score += 2;
  if (job.salary) score += 1;
  if (query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    for (const word of words) {
      if (title.includes(word)) score += 4;
      else if (tags.includes(word)) score += 3;
      else if (description.includes(word)) score += 1;
    }
  }
  return score;
}
function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function render() {
  const query = state.query.trim().toLowerCase();
  const location = $("location").value;
  const level = $("level").value;
  const type = $("type").value;
  const filtered = state.jobs.filter(job => {
    const text = [job.title, job.company_name, job.description, ...(job.tags || [])].join(" ").toLowerCase();
    if (query && !query.split(/\s+/).every(word => text.includes(word))) return false;
    if (!locationMatches(job, location)) return false;
    if (level === "entry" && !entryPattern.test([job.title, job.description, ...(job.tags || [])].join(" "))) return false;
    if (level === "intern" && !internPattern.test([job.title, job.description].join(" "))) return false;
    if (type !== "all" && job.job_type !== type) return false;
    return true;
  }).sort((a,b) => scoreJob(b, query) - scoreJob(a, query));
  $("status").textContent = "Показано вакансий: " + filtered.length + " из " + state.jobs.length + ".";
  const container = $("jobs");
  container.replaceChildren();
  if (!filtered.length) {
    container.innerHTML = '<div class="empty">По этим фильтрам вакансий не найдено. Измени запрос или географию.</div>';
    return;
  }
  for (const job of filtered) {
    const isEntry = entryPattern.test([job.title, job.description, ...(job.tags || [])].join(" "));
    const card = document.createElement("article");
    card.className = "job-card";
    const top = document.createElement("div"); top.className = "job-top";
    const info = document.createElement("div");
    const company = document.createElement("div"); company.className = "company"; company.textContent = job.company_name || "Компания не указана";
    const title = document.createElement("h3"); title.textContent = job.title || "Вакансия без названия";
    const meta = document.createElement("div"); meta.className = "meta";
    meta.textContent = [job.candidate_required_location || "Remote", job.salary || "", job.job_type ? job.job_type.replace("_", " ") : ""].filter(Boolean).join(" · ");
    info.append(company, title, meta); top.append(info); card.append(top);
    const badges = document.createElement("div"); badges.className = "badges";
    const levelBadge = document.createElement("span"); levelBadge.className = "badge " + (isEntry ? "entry" : "warning"); levelBadge.textContent = isEntry ? "Возможно, начальный уровень" : "Уровень не подтверждён";
    badges.append(levelBadge);
    (job.tags || []).slice(0,2).forEach(tag => { const b = document.createElement("span"); b.className = "badge"; b.textContent = tag; badges.append(b); });
    card.append(badges);
    const bottom = document.createElement("div"); bottom.className = "card-bottom";
    const match = document.createElement("span"); match.className = "match"; match.textContent = "Релевантность: " + Math.min(99, 55 + scoreJob(job, query) * 4) + "%";
    const link = document.createElement("a"); link.className = "apply"; link.textContent = "Открыть вакансию ↗"; link.href = job.url || "https://remotive.com/"; link.target = "_blank"; link.rel = "noopener noreferrer";
    bottom.append(match, link); card.append(bottom); container.append(card);
  }
}
$("search-form").addEventListener("submit", event => { event.preventDefault(); state.query = $("query").value; render(); });
["location","level","type"].forEach(id => $(id).addEventListener("change", render));
$("refresh").addEventListener("click", () => loadJobs(true));
loadJobs();
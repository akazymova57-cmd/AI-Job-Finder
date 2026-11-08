const APP_CONFIG = {
  maxJobAgeDays: 30,
  sources: {
    remotive: { enabled: false, label: "Remotive", apiUrl: "https://remotive.com/api/remote-jobs", allowedHosts: ["remotive.com", "www.remotive.com"], note: "Disabled pending written permission for public job-board aggregation." },
    weworkremotely: { enabled: true, label: "We Work Remotely", apiUrl: "https://weworkremotely.com/remote-jobs.rss", allowedHosts: ["weworkremotely.com", "www.weworkremotely.com"] },
    himalayas: { enabled: true, label: "Himalayas", apiUrl: "https://himalayas.app/jobs/api?limit=20", allowedHosts: ["himalayas.app", "www.himalayas.app"] },
    remoteok: { enabled: true, label: "Remote OK", apiUrl: "https://remoteok.com/api", allowedHosts: ["remoteok.com", "www.remoteok.com"] },
    jobicy: { enabled: true, label: "Jobicy", apiUrl: "https://jobicy.com/api/jobs", allowedHosts: ["jobicy.com", "www.jobicy.com"] }
  },
  fraudPatterns: [
    /pay(?:ment)?\s+(?:a\s+)?(?:fee|for\s+training|to\s+apply)/i,
    /upfront\s+(?:fee|payment|deposit)/i,
    /заплатите\s+за\s+(?:трудоустройство|обучение|доступ)/i,
    /оплат\w*\s+(?:трудоустройств|обучени|доступ)/i,
    /send\s+(?:your\s+)?(?:passport|credit\s+card|bank\s+card)/i,
    /пришлите\s+(?:скан\s+)?паспорт|данные\s+(?:банковской\s+)?карт/i,
    /telegram\s+only|whatsapp\s+only|только\s+(?:в\s+)?(?:телеграм|telegram|whatsapp)/i
  ]
};
if (typeof window !== "undefined") window.APP_CONFIG = APP_CONFIG;
if (typeof module !== "undefined" && module.exports) module.exports = APP_CONFIG;

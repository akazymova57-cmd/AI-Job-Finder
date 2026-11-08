const APP_CONFIG = {
  maxJobAgeDays: 30,
  sources: {
    remotive: {
      enabled: true,
      label: "Remotive",
      apiUrl: "https://remotive.com/api/remote-jobs",
      allowedHosts: ["remotive.com", "www.remotive.com"]
    }
  },
  fraudPatterns: [
    /pay(?:ment)?\\s+(?:a\\s+)?(?:fee|for\\s+training|to\\s+apply)/i,
    /upfront\\s+(?:fee|payment|deposit)/i,
    /заплатите\\s+за\\s+(?:трудоустройство|обучение|доступ)/i,
    /оплат\\w*\\s+(?:трудоустройств|обучени|доступ)/i,
    /send\\s+(?:your\\s+)?(?:passport|credit\\s+card|bank\\s+card)/i,
    /пришлите\\s+(?:скан\\s+)?паспорт|данные\\s+(?:банковской\\s+)?карт/i,
    /telegram\\s+only|whatsapp\\s+only|только\\s+(?:в\\s+)?(?:телеграм|telegram|whatsapp)/i
  ]
};

if (typeof window !== "undefined") window.APP_CONFIG = APP_CONFIG;
if (typeof module !== "undefined" && module.exports) module.exports = APP_CONFIG;

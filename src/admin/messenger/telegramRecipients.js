export function normaliseTelegramBotUsername(value) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean}`;
}

export function normaliseTelegramChatId(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

export function normaliseTelegramUsername(value) {
  const clean = String(value || "").trim().replace(/\s+/g, "");
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean}`;
}

export function telegramUsernameKey(value) {
  return normaliseTelegramUsername(value).toLowerCase();
}

export function buildTelegramRecipientDraft(institute = "", seed = {}) {
  const cleanInstitute = String(institute || "").trim();
  return {
    id: String(seed?.id || `telegram_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    institute: cleanInstitute,
    destinationType: ["channel", "group", "private"].includes(seed?.destinationType)
      ? seed.destinationType
      : "private",
    chatId: normaliseTelegramChatId(seed?.chatId),
    username: normaliseTelegramUsername(seed?.username),
    label: String(seed?.label || (cleanInstitute ? `${cleanInstitute} reports` : "")).trim(),
    enabled: seed?.enabled !== false,
    notes: String(seed?.notes || "").trim(),
  };
}

export function normaliseTelegramRecipientsForUi(list = []) {
  return (list || []).map(item => ({
    id: String(item?.id || buildTelegramRecipientDraft(item?.institute).id),
    institute: String(item?.institute || "").trim(),
    destinationType: ["channel", "group", "private"].includes(item?.destinationType)
      ? item.destinationType
      : "private",
    chatId: normaliseTelegramChatId(item?.chatId),
    username: normaliseTelegramUsername(item?.username),
    label: String(item?.label || "").trim(),
    enabled: item?.enabled !== false,
    notes: String(item?.notes || "").trim(),
  }));
}

export function normaliseTelegramFullReportRecipientsForUi(list = []) {
  return (list || []).map(item => ({
    id: String(item?.id || buildTelegramRecipientDraft("").id),
    destinationType: ["channel", "group", "private"].includes(item?.destinationType)
      ? item.destinationType
      : "private",
    chatId: normaliseTelegramChatId(item?.chatId),
    username: normaliseTelegramUsername(item?.username),
    label: String(item?.label || "").trim(),
    enabled: item?.enabled !== false,
    notes: String(item?.notes || "").trim(),
  }));
}

export function buildTelegramRecipientTouchSummary(item = {}) {
  return {
    institute: String(item?.institute || "").trim(),
    label: String(item?.label || "").trim(),
    username: normaliseTelegramUsername(item?.username),
    chatId: normaliseTelegramChatId(item?.chatId),
    notes: String(item?.notes || "").trim(),
  };
}

export function recipientHasAnyTelegramData(item = {}) {
  const summary = buildTelegramRecipientTouchSummary(item);
  return !!(summary.institute || summary.label || summary.username || summary.chatId || summary.notes);
}

export function mergeTelegramFullReportRecipientsForUi(...lists) {
  const merged = [];
  const seen = new Set();
  lists.flat().forEach(item => {
    const summary = buildTelegramRecipientTouchSummary(item);
    if (!recipientHasAnyTelegramData(summary)) return;
    const key = summary.chatId
      ? `chat:${summary.chatId}`
      : summary.username
        ? `user:${telegramUsernameKey(summary.username)}`
        : `id:${String(item?.id || "").trim()}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      id: String(item?.id || buildTelegramRecipientDraft("").id),
      destinationType: ["channel", "group", "private"].includes(item?.destinationType)
        ? item.destinationType
        : "private",
      chatId: summary.chatId,
      username: summary.username,
      label: summary.label,
      enabled: item?.enabled !== false,
      notes: summary.notes,
    });
  });
  return merged;
}

export function partitionTelegramRecipientsForUi(config = null) {
  const routeRecipients = [];
  const legacyFullReportRecipients = [];
  normaliseTelegramRecipientsForUi(config?.recipients || []).forEach(item => {
    if (String(item?.institute || "").trim()) {
      routeRecipients.push(item);
    } else if (recipientHasAnyTelegramData(item)) {
      legacyFullReportRecipients.push(item);
    }
  });
  return {
    recipients: routeRecipients,
    fullReportRecipients: mergeTelegramFullReportRecipientsForUi(
      normaliseTelegramFullReportRecipientsForUi(config?.fullReportRecipients || []),
      legacyFullReportRecipients,
    ),
  };
}

export function getTelegramRecipientDisplayName(item = {}) {
  const username = normaliseTelegramUsername(item?.username);
  if (username) return username;
  const label = String(item?.label || "").trim();
  if (label) return label;
  const chatId = normaliseTelegramChatId(item?.chatId);
  return chatId ? `Chat ${chatId}` : "Telegram user";
}

export function buildTelegramDashboardDraft(config = null) {
  const partitioned = partitionTelegramRecipientsForUi(config);
  return {
    enabled: config?.enabled !== false,
    botUsername: normaliseTelegramBotUsername(config?.botUsername || "@ledgrapp_bot"),
    scheduledEnabled: config?.delivery?.scheduledEnabled !== false,
    onDemandEnabled: config?.delivery?.onDemandEnabled !== false,
    recipients: partitioned.recipients,
    fullReportRecipients: partitioned.fullReportRecipients,
  };
}

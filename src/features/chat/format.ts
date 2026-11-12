function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** "14:05" */
export function formatMessageTime(iso: string, language: string) {
  return new Date(iso).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
}

/** Hoje: "14:05". Outros dias: "03/11". */
export function formatConversationTime(iso: string, language: string, now = new Date()) {
  const date = new Date(iso);
  return isSameDay(date, now)
    ? formatMessageTime(iso, language)
    : date.toLocaleDateString(language, { day: '2-digit', month: '2-digit' });
}

/** Badge de não lidas: o servidor conta no máximo 100. */
export function formatUnread(count: number) {
  return count > 99 ? '99+' : String(count);
}

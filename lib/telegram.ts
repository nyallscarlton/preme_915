// Telegram alerting removed 2026-05-28 — all notification paths now use Slack.
// Exports retained as no-ops to avoid import errors in callers during cleanup.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyNewLead(_lead: any): Promise<void> {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyQualifiedLead(_lead: any): Promise<void> {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyHandoff(_lead: any): Promise<void> {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyTask(_task: any): Promise<void> {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifySequenceSummary(_stats: any): Promise<void> {}
export async function sendTelegram(_text: string): Promise<void> {}

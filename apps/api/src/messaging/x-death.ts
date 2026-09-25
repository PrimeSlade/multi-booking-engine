import type { Message } from 'amqplib';

/** Returns prior rejections of this message from the specified queue. */
export function getFailureCount(message: Message, queue: string): number {
  const deaths: unknown = message.properties?.headers?.['x-death'];

  if (!Array.isArray(deaths)) return 0;

  for (const death of deaths) {
    if (typeof death !== 'object' || death === null) continue;

    const entry = death as Record<string, unknown>;
    if (entry.queue !== queue || entry.reason !== 'rejected') continue;

    if (
      typeof entry.count === 'number' &&
      Number.isSafeInteger(entry.count) &&
      entry.count >= 0
    ) {
      return entry.count;
    }
  }

  return 0;
}

import type { Message } from 'amqplib';
import { getFailureCount } from './x-death';

describe('getFailureCount', () => {
  const queue = 'booking.step.itinerary.notify';
  const messageWithHeaders = (headers?: Record<string, unknown>) =>
    ({ properties: { headers } }) as Message;

  it('returns zero when x-death is absent or is not an array', () => {
    expect(getFailureCount({} as Message, queue)).toBe(0);
    expect(getFailureCount(messageWithHeaders(), queue)).toBe(0);
    expect(
      getFailureCount(messageWithHeaders({ 'x-death': null }), queue),
    ).toBe(0);
    expect(
      getFailureCount(messageWithHeaders({ 'x-death': { count: 2 } }), queue),
    ).toBe(0);
  });

  it('reads the rejection count for the specified queue', () => {
    const message = messageWithHeaders({
      'x-death': [{ queue, reason: 'rejected', count: 3 }],
    });

    expect(getFailureCount(message, queue)).toBe(3);
  });

  it('ignores deaths from other queues and other reasons', () => {
    const message = messageWithHeaders({
      'x-death': [
        { queue: 'booking.retry', reason: 'expired', count: 8 },
        { queue, reason: 'expired', count: 4 },
        { queue: 'booking.step.other', reason: 'rejected', count: 7 },
        { queue, reason: 'rejected', count: 2 },
      ],
    });

    expect(getFailureCount(message, queue)).toBe(2);
    expect(getFailureCount(message, 'booking.step.missing')).toBe(0);
  });

  it('ignores malformed entries and counts', () => {
    const message = messageWithHeaders({
      'x-death': [
        null,
        'invalid',
        { queue, reason: 'rejected', count: '2' },
        { queue, reason: 'rejected', count: -1 },
        { queue, reason: 'rejected', count: 1.5 },
        { queue, reason: 'rejected', count: 2 },
      ],
    });

    expect(getFailureCount(message, queue)).toBe(2);
  });
});

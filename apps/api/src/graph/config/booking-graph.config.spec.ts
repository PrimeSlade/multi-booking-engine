import bookingGraphConfig from './booking-graph.config';

describe('bookingGraphConfig', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJestWorkerId = process.env.JEST_WORKER_ID;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalJestWorkerId === undefined) delete process.env.JEST_WORKER_ID;
    else process.env.JEST_WORKER_ID = originalJestWorkerId;
  });

  it('keeps the normal decision TTL in development mode', () => {
    process.env.NODE_ENV = 'development';

    expect(bookingGraphConfig().bookingGraph.itinerary.decisionTtlMs).toBe(
      900_000,
    );
  });

  it('uses a 15-second decision TTL in runtime test mode', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JEST_WORKER_ID;

    expect(bookingGraphConfig().bookingGraph.itinerary.decisionTtlMs).toBe(
      15_000,
    );
  });
});

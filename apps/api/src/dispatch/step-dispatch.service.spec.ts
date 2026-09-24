import { of, throwError } from 'rxjs';
import { StepDispatchService, StepPair } from './step-dispatch.service';

describe('StepDispatchService', () => {
  const buildPair = (overrides: Partial<StepPair['step']> = {}): StepPair => ({
    step: {
      id: 'step-1',
      bookingId: 'booking-1',
      stepName: 'flight.availability',
      scope: 'product',
      agent: 'flight-agent',
      flightBookingId: 'flight-booking-1',
      hotelBookingId: null,
      attempt: 0,
      ...overrides,
    },
    generated: {
      stage: 0,
      stepName: 'flight.availability',
      scope: 'product',
      product: 'flight',
      agent: 'flight-agent',
      routingKey: 'booking.step.flight.availability',
      timeoutMs: 5000,
      retry: { max: 3, backoffMs: 1000 },
    },
  });

  it('emits one message per pair with the routing key from the generated step', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const service = new StepDispatchService({ emit } as never);

    const pair = buildPair();
    await service.dispatchSteps([pair]);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('booking.step.flight.availability', {
      stepId: 'step-1',
      bookingId: 'booking-1',
      stepName: 'flight.availability',
      scope: 'product',
      agent: 'flight-agent',
      flightBookingId: 'flight-booking-1',
      hotelBookingId: null,
      attempt: 0,
      timeoutMs: 5000,
      retry: { max: 3, backoffMs: 1000 },
    });
  });

  it('does not let one failed publish stop the others', async () => {
    const emit = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('broker unreachable')))
      .mockReturnValueOnce(of(undefined));
    const service = new StepDispatchService({ emit } as never);

    const pairs = [
      buildPair({ id: 'step-1' }),
      buildPair({ id: 'step-2', hotelBookingId: 'hotel-booking-1' }),
    ];

    await expect(service.dispatchSteps(pairs)).resolves.toBeUndefined();
    expect(emit).toHaveBeenCalledTimes(2);
  });

  describe('dispatchCompensations', () => {
    const buildRow = (
      overrides: Partial<StepPair['step']> = {},
    ): StepPair['step'] => ({
      id: 'step-1',
      bookingId: 'booking-1',
      stepName: 'flight.allotment',
      scope: 'product',
      agent: 'flight-agent',
      flightBookingId: 'flight-booking-1',
      hotelBookingId: null,
      attempt: 0,
      ...overrides,
    });

    it('emits one compensate message per row', async () => {
      const emit = jest.fn().mockReturnValue(of(undefined));
      const service = new StepDispatchService({ emit } as never);

      await service.dispatchCompensations([buildRow()]);

      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith(
        'booking.step.compensate.flight.allotment',
        {
          stepId: 'step-1',
          bookingId: 'booking-1',
          stepName: 'flight.allotment',
          scope: 'product',
          agent: 'flight-agent',
          flightBookingId: 'flight-booking-1',
          hotelBookingId: null,
        },
      );
    });

    it('does not let one failed publish stop the others', async () => {
      const emit = jest
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('broker unreachable')))
        .mockReturnValueOnce(of(undefined));
      const service = new StepDispatchService({ emit } as never);

      const rows = [buildRow({ id: 'step-1' }), buildRow({ id: 'step-2' })];

      await expect(
        service.dispatchCompensations(rows),
      ).resolves.toBeUndefined();
      expect(emit).toHaveBeenCalledTimes(2);
    });
  });
});

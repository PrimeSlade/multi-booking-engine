jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: class MockConfigService {},
}));

import { SagaCompensationService } from './saga-compensation.service';

describe('SagaCompensationService', () => {
  const whereAll = (rows: unknown[]) => ({
    all: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue(rows),
    }),
  });

  it('claims and dispatches only successful compensatable steps', async () => {
    const eligible = {
      id: 'flight-allotment',
      bookingId: 'booking-1',
      stepName: 'flight.allotment',
    };
    const ignored = {
      id: 'fraud',
      bookingId: 'booking-1',
      stepName: 'itinerary.fraud',
    };
    const bookingStepWhere = jest
      .fn()
      .mockReturnValueOnce(whereAll([eligible, ignored]))
      .mockReturnValueOnce({
        update: jest
          .fn()
          .mockResolvedValue({ ...eligible, status: 'compensating' }),
      });
    const dispatchCompensations = jest.fn().mockResolvedValue(undefined);
    const service = new SagaCompensationService(
      {
        db: {
          orm: {
            public: {
              FlightBooking: {
                where: jest.fn().mockReturnValue(whereAll([{}])),
              },
              HotelBooking: { where: jest.fn().mockReturnValue(whereAll([])) },
              BookingStep: { where: bookingStepWhere },
            },
          },
        },
      } as never,
      {
        generate: jest.fn().mockReturnValue({
          steps: [
            { stepName: 'flight.allotment', compensate: true },
            { stepName: 'itinerary.fraud', compensate: false },
          ],
        }),
      } as never,
      { dispatchCompensations } as never,
    );

    await service.compensateSuccessfulSteps('booking-1');

    expect(bookingStepWhere).toHaveBeenLastCalledWith({
      id: 'flight-allotment',
      status: 'success',
    });
    expect(dispatchCompensations).toHaveBeenCalledWith([eligible]);
  });

  it('does not dispatch when another worker wins the compensation claim', async () => {
    const step = {
      id: 'flight-allotment',
      bookingId: 'booking-1',
      stepName: 'flight.allotment',
    };
    const bookingStepWhere = jest
      .fn()
      .mockReturnValueOnce(whereAll([step]))
      .mockReturnValueOnce({ update: jest.fn().mockResolvedValue(null) });
    const dispatchCompensations = jest.fn();
    const service = new SagaCompensationService(
      {
        db: {
          orm: {
            public: {
              FlightBooking: {
                where: jest.fn().mockReturnValue(whereAll([{}])),
              },
              HotelBooking: { where: jest.fn().mockReturnValue(whereAll([])) },
              BookingStep: { where: bookingStepWhere },
            },
          },
        },
      } as never,
      {
        generate: jest.fn().mockReturnValue({
          steps: [{ stepName: 'flight.allotment', compensate: true }],
        }),
      } as never,
      { dispatchCompensations } as never,
    );

    await service.compensateSuccessfulSteps('booking-1');

    expect(dispatchCompensations).not.toHaveBeenCalled();
  });
});

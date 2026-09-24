jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import type { RmqContext } from '@nestjs/microservices';
import { StepCompensationController } from './step-compensation.controller';
import { StepCompensationService } from './step-compensation.service';
import { BookingStepCompensatedMessage } from '@/messaging/messaging.types';

describe('StepCompensationController', () => {
  const message: BookingStepCompensatedMessage = {
    stepId: 'step-1',
    bookingId: 'booking-1',
    stepName: 'flight.allotment',
  };

  const buildContext = () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => ({}),
    } as unknown as RmqContext;
    return { channel, context };
  };

  it('acks once the compensated event is applied', async () => {
    const applyCompensated = jest.fn().mockResolvedValue({ id: 'step-1' });
    const controller = new StepCompensationController({
      applyCompensated,
    } as unknown as StepCompensationService);
    const { channel, context } = buildContext();

    await controller.handle(message, context);

    expect(applyCompensated).toHaveBeenCalledWith(message);
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks and logs when applying the compensated event throws', async () => {
    const compensationService = {
      applyCompensated: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as StepCompensationService;
    const controller = new StepCompensationController(compensationService);
    const { channel, context } = buildContext();

    await controller.handle(message, context);

    expect(channel.nack).toHaveBeenCalledWith({}, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });
});

jest.mock('@nestjs/config', () => ({
  ConfigService: class MockConfigService {},
}));

jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import type { RmqContext } from '@nestjs/microservices';
import { StepCompletionController } from './step-completion.controller';
import { StepCompletionService } from './step-completion.service';
import { StageAdvancementService } from '@/orchestrator/advancement/stage-advancement.service';
import { BookingStepCompletionMessage } from '@/messaging/messaging.types';

describe('StepCompletionController', () => {
  const message: BookingStepCompletionMessage = {
    stepId: 'step-1',
    bookingId: 'booking-1',
    stepName: 'flight.availability',
    scope: 'product',
    agent: 'flight-agent',
    flightBookingId: 'fb-1',
    hotelBookingId: null,
    attempt: 0,
    status: 'success',
    result: { seatsLeft: 5 },
    error: null,
  };

  const buildContext = () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => ({}),
    } as unknown as RmqContext;
    return { channel, context };
  };

  const updatedRow = { ...message, id: message.stepId, stage: 0 };

  it('acks and advances the stage once the completion is applied', async () => {
    const applyCompletion = jest.fn().mockResolvedValue(updatedRow);
    const maybeAdvance = jest.fn().mockResolvedValue(undefined);
    const controller = new StepCompletionController(
      { applyCompletion } as unknown as StepCompletionService,
      { maybeAdvance } as unknown as StageAdvancementService,
    );
    const { channel, context } = buildContext();

    await controller.handle(message, context);

    expect(applyCompletion).toHaveBeenCalledWith(message);
    expect(maybeAdvance).toHaveBeenCalledWith(updatedRow);
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('acks without advancing when applyCompletion finds no matching row', async () => {
    const applyCompletion = jest.fn().mockResolvedValue(null);
    const maybeAdvance = jest.fn().mockResolvedValue(undefined);
    const controller = new StepCompletionController(
      { applyCompletion } as unknown as StepCompletionService,
      { maybeAdvance } as unknown as StageAdvancementService,
    );
    const { channel, context } = buildContext();

    await controller.handle(message, context);

    expect(maybeAdvance).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks and logs when applying the completion throws', async () => {
    const completionService = {
      applyCompletion: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as StepCompletionService;
    const stageAdvancementService = {
      maybeAdvance: jest.fn(),
    } as unknown as StageAdvancementService;
    const controller = new StepCompletionController(
      completionService,
      stageAdvancementService,
    );
    const { channel, context } = buildContext();

    await controller.handle(message, context);

    expect(channel.nack).toHaveBeenCalledWith({}, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('nacks when stage advancement throws', async () => {
    const applyCompletion = jest.fn().mockResolvedValue(updatedRow);
    const maybeAdvance = jest
      .fn()
      .mockRejectedValue(new Error('publish failed'));
    const controller = new StepCompletionController(
      { applyCompletion } as unknown as StepCompletionService,
      { maybeAdvance } as unknown as StageAdvancementService,
    );
    const { channel, context } = buildContext();

    await controller.handle(message, context);

    expect(channel.nack).toHaveBeenCalledWith({}, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });
});

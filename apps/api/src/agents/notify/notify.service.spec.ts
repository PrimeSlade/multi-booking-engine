import { NotifyService } from './notify.service';

describe('NotifyService', () => {
  it('returns a successful simulated notification result', async () => {
    const service = new NotifyService();

    await expect(service.sendNotification('booking-1')).resolves.toEqual({
      notified: true,
    });
  });
});

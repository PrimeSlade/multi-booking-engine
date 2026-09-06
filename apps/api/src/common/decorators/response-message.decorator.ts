import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'responseMessage';

/**
 * Sets an optional human-readable success message for the centralized
 * response envelope. Omit it and the `message` key is left out entirely.
 *
 * Example: `@ResponseMessage('Booking published successfully')`
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);

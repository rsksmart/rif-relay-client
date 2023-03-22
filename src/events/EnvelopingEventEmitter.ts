import EventEmitter from 'events';

const EVENT_WRAPPER = 'enveloping';

export const EVENT_INIT = 'init';
export const EVENT_REFRESH_RELAYS = 'refresh-relays';
export const EVENT_REFRESHED_RELAYS = 'refreshed-relays';
export const EVENT_NEXT_RELAY = 'next-relay';
export const EVENT_SIGN_REQUEST = 'sign-request';
export const EVENT_VALIDATE_REQUEST = 'validate-request';
export const EVENT_SEND_TO_RELAYER = 'send-to-relayer';
export const EVENT_RELAYER_RESPONSE = 'relayer-response';

const events = {
  [EVENT_INIT]: EVENT_INIT,
  [EVENT_REFRESH_RELAYS]: EVENT_REFRESH_RELAYS, // TODO validate if its needed, since we do not refresh relays anymore
  [EVENT_REFRESHED_RELAYS]: EVENT_REFRESHED_RELAYS, // TODO validate if its needed, since we do not refresh relays anymore
  [EVENT_NEXT_RELAY]: EVENT_NEXT_RELAY,
  [EVENT_SIGN_REQUEST]: EVENT_SIGN_REQUEST,
  [EVENT_VALIDATE_REQUEST]: EVENT_VALIDATE_REQUEST,
  [EVENT_SEND_TO_RELAYER]: EVENT_SEND_TO_RELAYER,
  [EVENT_RELAYER_RESPONSE]: EVENT_RELAYER_RESPONSE,
} as const;

type Event = keyof typeof events;

class EnvelopingEventEmitter extends EventEmitter {
  registerEventListener(
    eventHandler: (event: Event, ...args: unknown[]) => void
  ) {
    this.on(EVENT_WRAPPER, eventHandler);
  }

  unregisterEventListener(
    eventHandler: (event: Event, ...args: unknown[]) => void
  ) {
    this.off(EVENT_WRAPPER, eventHandler);
  }

  override emit(eventName: Event, ...args: unknown[]): boolean {
    return super.emit(EVENT_WRAPPER, eventName, ...args);
  }
}

export default EnvelopingEventEmitter;

export { events as envelopingEvents };
export type { Event as EnvelopingEvent };

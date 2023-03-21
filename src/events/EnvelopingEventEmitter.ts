import EventEmitter from 'events';

const EVENT_WRAPPER = 'enveloping';

const events = {
  init: 'init',
  'refresh-relays': 'refresh-relays', // TODO validate if its needed, since we do not refresh relays anymore
  'refreshed-relays': 'refreshed-relays', // TODO validate if its needed, since we do not refresh relays anymore
  'next-relay': 'next-relay',
  'sign-request': 'sign-request',
  'validate-request': 'validate-request',
  'send-to-relayer': 'send-to-relayer',
  'relayer-response': 'relayer-response',
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

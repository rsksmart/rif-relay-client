import EventEmitter from 'events';

const events = {
  init: 'init',
  enveloping: 'enveloping',
  'refresh-relays': 'refresh-relays', // TODO validate if its needed, since we do not refresh relays anymore
  'refreshed-relays': 'refreshed-relays', // TODO validate if its needed, since we do not refresh relays anymore
  'next-relay': 'next-relay',
  'sign-request': 'sign-request',
  'validate-request': 'validate-request',
  'send-to-relayer': 'send-to-relayer',
  'relayer-response': 'relayer-response', // FIXME needs to have a boolean flag
} as const;

type Event = keyof typeof events;

class EnvelopingEventEmitter extends EventEmitter {
  registerEventListener(
    eventType: Event,
    eventHandle: (...args: unknown[]) => void
  ) {
    this.on(eventType, eventHandle);
  }

  unregisterEventListener(
    eventType: Event,
    eventHandle: (...args: unknown[]) => void
  ) {
    this.off(eventType, eventHandle);
  }

  override emit(eventName: Event, ...args: unknown[]): boolean {
    return super.emit(eventName, args);
  }
}

export default EnvelopingEventEmitter;

export { events as envelopingEvents };
export type { Event as EnvelopingEvent };

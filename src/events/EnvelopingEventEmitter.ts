import EventEmitter from 'events';

const events = {
  init: 'init',
  enveloping: 'enveloping',
  'refresh-relays': 'refresh-relays',
  'refreshed-relays': 'refreshed-relays',
  'next-relay': 'next-relay',
  'sign-request': 'sign-request',
  'validate-request': 'validate-request',
  'send-to-relayer': 'send-to-relayer',
  'relayer-response': 'relayer-response',
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

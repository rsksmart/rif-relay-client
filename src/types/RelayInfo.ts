import { PingResponse, RelayData } from '@rsksmart/rif-relay-common';

// Well, I still don't like it
// Some info is known from the event, some from ping
export interface PartialRelayInfo {
    relayData: RelayData;
    pingResponse: PingResponse;
}

export interface RelayInfo {
    pingResponse: PingResponse;
    relayData: RelayData;
}

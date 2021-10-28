import { PingResponse, RelayManagerData } from '@rsksmart/rif-relay-common';

// Well, I still don't like it
// Some info is known from the event, some from ping
export interface PartialRelayInfo {
    relayInfo: RelayManagerData;
    pingResponse: PingResponse;
}

export interface RelayInfo {
    pingResponse: PingResponse;
    relayInfo: RelayManagerData;
}

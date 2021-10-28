import { PingResponse, RelayManagerData } from '@rsksmart/rif-relay-common';
export interface PartialRelayInfo {
    relayInfo: RelayManagerData;
    pingResponse: PingResponse;
}
export interface RelayInfo {
    pingResponse: PingResponse;
    relayInfo: RelayManagerData;
}

import { PingResponse, RelayData } from '@rsksmart/rif-relay-common';
export interface PartialRelayInfo {
    relayData: RelayData;
    pingResponse: PingResponse;
}
export interface RelayInfo {
    pingResponse: PingResponse;
    relayData: RelayData;
}

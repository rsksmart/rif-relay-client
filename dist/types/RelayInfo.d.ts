import { PingResponse } from '@rsksmart/rif-relay-common';
import { RelayManagerData } from '@rsksmart/rif-relay-contracts';
export interface PartialRelayInfo {
    relayInfo: RelayManagerData;
    pingResponse: PingResponse;
}
export interface RelayInfo {
    pingResponse: PingResponse;
    relayInfo: RelayManagerData;
}

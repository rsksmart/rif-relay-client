export interface RelayInfoUrl {
    relayUrl: string;
}
export interface RelayRegisteredEventInfo extends RelayInfoUrl {
    relayManager: string;
}
export declare function isInfoFromEvent(info: RelayInfoUrl): boolean;

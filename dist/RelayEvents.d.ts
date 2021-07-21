export declare class RelayEvent {
    readonly event: string;
    readonly step: number;
    total: number;
    constructor(event: string, step: number);
}
export declare class InitEvent extends RelayEvent {
    constructor();
}
export declare class RefreshRelaysEvent extends RelayEvent {
    constructor();
}
export declare class DoneRefreshRelaysEvent extends RelayEvent {
    readonly relaysCount: number;
    constructor(relaysCount: number);
}
export declare class NextRelayEvent extends RelayEvent {
    readonly relayUrl: string;
    constructor(relayUrl: string);
}
export declare class SignRequestEvent extends RelayEvent {
    constructor();
}
export declare class ValidateRequestEvent extends RelayEvent {
    constructor();
}
export declare class SendToRelayerEvent extends RelayEvent {
    readonly relayUrl: string;
    constructor(relayUrl: string);
}
export declare class RelayerResponseEvent extends RelayEvent {
    readonly success: boolean;
    constructor(success: boolean);
}

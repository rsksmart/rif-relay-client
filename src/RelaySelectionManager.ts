import log from 'loglevel';
import { KnownRelaysManager } from './KnownRelaysManager';
import HttpClient from './HttpClient';
import { PingFilter } from './types/Aliases';
import {
    EnvelopingConfig,
    EnvelopingTransactionDetails,
    replaceErrors
} from '@rsksmart/rif-relay-common';
import { RelayManagerData } from '@rsksmart/rif-relay-contracts';
import { PartialRelayInfo, RelayInfo } from './types/RelayInfo';

export interface RaceResult {
    winner?: PartialRelayInfo;
    errors: Map<string, Error>;
}

export default class RelaySelectionManager {
    private readonly knownRelaysManager: KnownRelaysManager;
    private readonly httpClient: HttpClient;
    private readonly config: EnvelopingConfig;
    private readonly pingFilter: PingFilter;
    private readonly transactionDetails: EnvelopingTransactionDetails;

    private remainingRelays: RelayManagerData[][] = [];
    private isInitialized = false;

    public errors: Map<string, Error> = new Map<string, Error>();

    constructor(
        transactionDetails: EnvelopingTransactionDetails,
        knownRelaysManager: KnownRelaysManager,
        httpClient: HttpClient,
        pingFilter: PingFilter,
        config: EnvelopingConfig
    ) {
        this.transactionDetails = transactionDetails;
        this.knownRelaysManager = knownRelaysManager;
        this.httpClient = httpClient;
        this.pingFilter = pingFilter;
        this.config = config;
    }

    /**
     * Ping those relays that were not pinged yet, and remove both the returned relay or relays re from {@link remainingRelays}
     * @returns the first relay to respond to a ping message. Note: will never return the same relay twice.
     */
    async selectNextRelay(): Promise<RelayInfo | undefined> {
        if (this.transactionDetails.onlyPreferredRelays ?? false) {
            log.info('Only using preferred relays');
            let index = 0;
            const running = true;
            while (running) {
                let relayInfo: RelayInfo | undefined;
                const slice = this._getPreferredRelaysNextSlice(index);

                if (slice.length > 0) {
                    relayInfo = await this._nextRelayInternal(slice);
                    if (relayInfo == null) {
                        index += slice.length;
                        continue;
                    }
                }
                return relayInfo;
            }
        } else {
            const running = true;
            while (running) {
                const slice = this._getNextSlice();
                let relayInfo: RelayInfo | undefined;
                if (slice.length > 0) {
                    relayInfo = await this._nextRelayInternal(slice);
                    if (relayInfo == null) {
                        continue;
                    }
                }
                return relayInfo;
            }
        }
    }

    _getPreferredRelaysNextSlice(index: number): RelayManagerData[] {
        if (!this.isInitialized) {
            throw new Error('init() not called');
        }
        let slice: RelayManagerData[] = [];
        if (this.remainingRelays[0].length >= index + 1) {
            const relays = this.remainingRelays[0].slice(
                index,
                this.remainingRelays[0].length
            );
            const bulkSize = Math.min(this.config.sliceSize, relays.length);
            slice = relays.slice(0, bulkSize);
        }

        return slice;
    }

    async _nextRelayInternal(
        relays: RelayManagerData[]
    ): Promise<RelayInfo | undefined> {
        log.info(
            'nextRelay: find fastest relay from: ' + JSON.stringify(relays)
        );
        const raceResult = await this._raceToSuccess(relays);
        log.info(
            `race finished with a result: ${JSON.stringify(
                raceResult,
                replaceErrors
            )}`
        );
        this._handleRaceResults(raceResult);
        if (raceResult.winner != null) {
            const managerAddress =
                raceResult.winner.pingResponse.relayManagerAddress;
            log.info(
                `finding relay register info for manager address: ${managerAddress}; known info: ${JSON.stringify(
                    raceResult.winner.relayInfo
                )}`
            );
            const activeRelays =
                await this.knownRelaysManager.getRelayDataForManagers(
                    new Set([managerAddress])
                );
            if (activeRelays.length == 1) {
                return {
                    pingResponse: raceResult.winner.pingResponse,
                    relayInfo: activeRelays[0]
                };
            } else {
                throw new Error(
                    `unexpected amount of active relays for manager address: ${managerAddress}`
                );
            }
        } else {
            log.info(
                `no race winner found for relays: ${JSON.stringify(relays)})`
            );
        }
    }

    async init(): Promise<this> {
        this.remainingRelays =
            await this.knownRelaysManager.getRelaysSortedForTransaction(
                this.transactionDetails
            );
        this.isInitialized = true;
        return this;
    }

    // relays left to try
    // (note that some edge-cases (like duplicate urls) are not filtered out)
    relaysLeft(): RelayManagerData[] {
        return this.remainingRelays.flatMap((list) => list);
    }

    _getNextSlice(): RelayManagerData[] {
        if (!this.isInitialized) {
            throw new Error('init() not called');
        }
        for (const relays of this.remainingRelays) {
            const bulkSize = Math.min(this.config.sliceSize, relays.length);
            const slice = relays.slice(0, bulkSize);
            if (slice.length === 0) {
                continue;
            }
            return slice;
        }
        return [];
    }

    /**
     * @returns JSON response from the relay server, but adds the requested URL to it :'-(
     */
    async _getRelayAddressPing(
        relayInfo: RelayManagerData
    ): Promise<PartialRelayInfo> {
        log.info(`getRelayAddressPing URL: ${relayInfo.url}`);
        const pingResponse = await this.httpClient.getPingResponse(
            relayInfo.url,
            this.transactionDetails.callVerifier
        );

        if (!pingResponse.ready) {
            throw new Error(`Relay not ready ${JSON.stringify(pingResponse)}`);
        }
        this.pingFilter(pingResponse, this.transactionDetails);
        return {
            pingResponse,
            relayInfo
        };
    }

    /**
     * From https://stackoverflow.com/a/37235207 (added types, modified to catch exceptions)
     * Accepts an array of promises.
     * Resolves once any promise resolves, ignores the rest. Exceptions returned separately.
     */
    async _raceToSuccess(relays: RelayManagerData[]): Promise<RaceResult> {
        const errors: Map<string, Error> = new Map<string, Error>();
        return await new Promise((resolve) => {
            relays.forEach((relay: RelayManagerData) => {
                this._getRelayAddressPing(relay)
                    .then((winner: PartialRelayInfo) => {
                        resolve({
                            winner,
                            errors
                        });
                    })
                    .catch((err: Error) => {
                        errors.set(relay.url, err);
                        if (errors.size === relays.length) {
                            resolve({ errors });
                        }
                    });
            });
        });
    }

    _handleRaceResults(raceResult: RaceResult): void {
        if (!this.isInitialized) {
            throw new Error('init() not called');
        }
        this.errors = new Map([...this.errors, ...raceResult.errors]);
        this.remainingRelays = this.remainingRelays.map((relays) =>
            relays
                .filter(
                    (relay) => relay.url !== raceResult.winner?.relayInfo.url
                )
                .filter(
                    (relay) =>
                        !Array.from(raceResult.errors.keys()).includes(
                            relay.url
                        )
                )
        );
    }
}

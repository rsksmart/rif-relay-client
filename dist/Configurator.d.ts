import { HttpProvider } from 'web3-core';
import { ContractInteractor, Web3Provider, EnvelopingConfig } from '@rsksmart/rif-relay-common';
import AccountManager from './AccountManager';
import HttpClient from './HttpClient';
import { KnownRelaysManager } from './KnownRelaysManager';
import RelayedTransactionValidator from './RelayedTransactionValidator';
import { AsyncScoreCalculator, PingFilter, RelayFilter } from './types/Aliases';
/**
 * All classes in Enveloping must be configured correctly with non-null values.
 * Yet it is tedious to provide default values to all configuration fields on new instance creation.
 * This helper allows users to provide only the overrides and the remainder of values will be set automatically.
 */
export declare function configure(partialConfig: Partial<EnvelopingConfig>): EnvelopingConfig;
/**
 * Same as {@link configure} but also resolves the Enveloping deployment from Verifier
 * @param provider - web3 provider needed to query blockchain
 * @param partialConfig
 */
export declare function resolveConfiguration(provider: Web3Provider, partialConfig: Partial<EnvelopingConfig>): Promise<EnvelopingConfig>;
export interface EnvelopingDependencies {
    httpClient: HttpClient;
    contractInteractor: ContractInteractor;
    knownRelaysManager: KnownRelaysManager;
    accountManager: AccountManager;
    transactionValidator: RelayedTransactionValidator;
    pingFilter: PingFilter;
    relayFilter: RelayFilter;
    scoreCalculator: AsyncScoreCalculator;
    config: EnvelopingConfig;
}
export declare function getDependencies(config: EnvelopingConfig, provider?: HttpProvider, overrideDependencies?: Partial<EnvelopingDependencies>): EnvelopingDependencies;

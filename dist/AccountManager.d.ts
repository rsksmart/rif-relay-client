/// <reference types="node" />
import { DeployRequest, RelayRequest, EnvelopingConfig, TypedDeployRequestData, TypedRequestData } from '@rsksmart/rif-relay-common';
import { Address } from './types/Aliases';
import { PrefixedHexString } from 'ethereumjs-tx';
import { HttpProvider } from 'web3-core';
export interface AccountKeypair {
    privateKey: Buffer;
    address: Address;
}
export default class AccountManager {
    private readonly web3;
    private readonly accounts;
    private readonly config;
    readonly chainId: number;
    private readonly signWithProviderImpl;
    constructor(provider: HttpProvider, chainId: number, config: EnvelopingConfig, signWithProviderImpl?: (signedData: any) => Promise<string>);
    addAccount(keypair: AccountKeypair): void;
    newAccount(): AccountKeypair;
    isDeployRequest(req: any): boolean;
    sign(relayRequest: RelayRequest | DeployRequest): Promise<PrefixedHexString>;
    _signWithProvider(signedData: any): Promise<string>;
    _signWithProviderDefault(signedData: any): Promise<string>;
    _signWithControlledKey(keypair: AccountKeypair, signedData: TypedRequestData | TypedDeployRequestData): string;
    getAccounts(): string[];
}

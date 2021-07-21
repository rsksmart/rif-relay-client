import { PrefixedHexString } from 'ethereumjs-tx';
import { ContractInteractor, DeployTransactionRequest, RelayTransactionRequest, EnvelopingConfig } from '@rsksmart/rif-relay-common';
export default class RelayedTransactionValidator {
    private readonly contractInteractor;
    private readonly config;
    constructor(contractInteractor: ContractInteractor, config: EnvelopingConfig);
    /**
     * Decode the signed transaction returned from the Relay Server, compare it to the
     * requested transaction and validate its signature.
     * @returns a signed {@link Transaction} instance for broadcasting, or null if returned
     * transaction is not valid.
     */
    validateRelayResponse(request: RelayTransactionRequest | DeployTransactionRequest, returnedTx: PrefixedHexString): boolean;
}

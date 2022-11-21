import type { EnvelopingConfig } from '@rsksmart/rif-relay-common';
import type { JsonRpcProvider } from '@ethersproject/providers';
import config from 'config';

const defaultEnvelopingConfig: EnvelopingConfig = config.get('EnvelopingConfig');

/**
 * All classes in Enveloping must be configured correctly with non-null values.
 * Yet it is tedious to provide default values to all configuration fields on new instance creation.
 * This helper allows users to provide only the overrides and the remainder of values will be set automatically.
 */
export function configure(
    partialConfig: Partial<EnvelopingConfig>
): EnvelopingConfig {
    return Object.assign(
        {},
        defaultEnvelopingConfig,
        partialConfig
    );
}

/**
 * Same as {@link configure} but also resolves the Enveloping deployment from Verifier
 * @param provider - web3 provider needed to query blockchain
 * @param partialConfig
 */
export function resolveConfiguration(
    provider: JsonRpcProvider & { isMetaMask: boolean },
    partialConfig: Partial<EnvelopingConfig>
): EnvelopingConfig {
    if (provider?.send == null) {
        throw new Error('First param is not a web3 provider');
    }

    if (partialConfig?.relayHubAddress != null) {
        throw new Error('Resolve cannot override passed values');
    }

    const [chainId, forwarderAddress] = [
        partialConfig.chainId,
        partialConfig.forwarderAddress ?? ''
    ];
    const isMetamask: boolean = provider.isMetaMask;
    // provide defaults valid for metamask (unless explicitly specified values)
    const methodSuffix =
        partialConfig.methodSuffix ??
        (isMetamask ? '_v4' : defaultEnvelopingConfig.methodSuffix);
    const jsonStringifyRequest =
        partialConfig.jsonStringifyRequest ??
        (isMetamask ? true : defaultEnvelopingConfig.jsonStringifyRequest);
    const resolvedConfig = {
        forwarderAddress,
        chainId,
        methodSuffix,
        jsonStringifyRequest
    };

    return {
        ...defaultEnvelopingConfig,
        ...partialConfig,
        ...resolvedConfig
    } as EnvelopingConfig;
}
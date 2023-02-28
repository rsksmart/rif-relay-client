import type { Response } from 'superagent';
import log from 'loglevel';
import type { RelayEstimation } from '../../common/estimation.types';
import type { HubInfo } from '../../common/relayHub.types';
import type { EnvelopingTxRequest } from '../../common/relayTransaction.types';
import HttpWrapper, { requestInterceptors } from './HttpWrapper';

const PATHS = {
  CHAIN_INFO: '/chain-info',
  POST_RELAY_REQUEST: '/relay',
  POST_ESTIMATE: '/estimate',
} as const;
const VERIFIER_SUFFIX = '?verifier=';

type RelayPath = (typeof PATHS)[keyof typeof PATHS];

type SignedTransactionDetails = {
  transactionHash: string;
  signedTx: string;
};

export function buildUrl(base: string, path: string): string {
  const url = new URL(base);
  const basePathname = url.pathname.endsWith('/')
    ? url.pathname.substring(0, url.pathname.length - 1)
    : url.pathname;
  url.pathname = `${basePathname}${path}`;

  return url.toString();
}

class HttpClient {
  private readonly _httpWrapper: HttpWrapper;

  constructor(httpWrapper: HttpWrapper = new HttpWrapper()) {
    this._httpWrapper = httpWrapper;
  }

  async getChainInfo(relayUrl: string, verifier = ''): Promise<HubInfo> {
    const verifierSuffix = verifier && `${VERIFIER_SUFFIX}${verifier}`;

    const url = buildUrl(relayUrl, PATHS.CHAIN_INFO + verifierSuffix);

    const hubInfo: HubInfo = await this._httpWrapper.sendPromise(url);
    log.info(`hubInfo: ${JSON.stringify(hubInfo)}`);
    requestInterceptors.logRequest.onErrorResponse({
      body: hubInfo,
    } as Response);

    return hubInfo;
  }

  private _stringifyEnvelopingTx(
    envelopingTx: EnvelopingTxRequest
  ): EnvelopingTxRequest {
    const {
      relayRequest: {
        request: { tokenGas, nonce, value, tokenAmount, gas },
        relayData: { gasPrice },
      },
    } = envelopingTx;

    return {
      ...envelopingTx,
      relayRequest: {
        ...envelopingTx.relayRequest,
        request: {
          ...envelopingTx.relayRequest.request,
          tokenGas: tokenGas.toString(),
          nonce: nonce.toString(),
          value: value.toString(),
          tokenAmount: tokenAmount.toString(),
          gas: gas?.toString(),
        },
        relayData: {
          ...envelopingTx.relayRequest.relayData,
          gasPrice: gasPrice.toString(),
        },
      },
    } as EnvelopingTxRequest;
  }

  async relayTransaction(
    relayUrl: string,
    envelopingTx: EnvelopingTxRequest
  ): Promise<string> {
    const url = buildUrl(relayUrl, PATHS.POST_RELAY_REQUEST);

    const { signedTx } =
      await this._httpWrapper.sendPromise<SignedTransactionDetails>(
        url,
        this._stringifyEnvelopingTx(envelopingTx)
      );
    log.info('relayTransaction response:', signedTx);

    if (!signedTx) {
      throw new Error(
        'Got invalid response from relay: signedTx field missing.'
      );
    }

    return signedTx;
  }

  async estimateMaxPossibleGas(
    relayUrl: string,
    envelopingTx: EnvelopingTxRequest
  ): Promise<RelayEstimation> {
    const url = buildUrl(relayUrl, PATHS.POST_ESTIMATE);

    const response = await this._httpWrapper.sendPromise<RelayEstimation>(
      url,
      this._stringifyEnvelopingTx(envelopingTx)
    );
    log.info('esimation relayTransaction response:', response);

    return response;
  }
}

export default HttpClient;

export { PATHS as RELAY_PATHS, VERIFIER_SUFFIX };
export type { RelayPath, SignedTransactionDetails };

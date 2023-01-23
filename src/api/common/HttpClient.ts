import type { AxiosResponse } from 'axios';
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

class HttpClient {
  private readonly _httpWrapper: HttpWrapper;

  constructor(httpWrapper: HttpWrapper = new HttpWrapper()) {
    this._httpWrapper = httpWrapper;
  }

  async getChainInfo(relayUrl: string, verifier = ''): Promise<HubInfo> {
    const verifierSuffix = verifier && `${VERIFIER_SUFFIX}${verifier}`;
    const hubInfo: HubInfo = await this._httpWrapper.sendPromise(
      relayUrl + PATHS.CHAIN_INFO + verifierSuffix
    );
    log.info(`hubInfo: ${JSON.stringify(hubInfo)}`);
    requestInterceptors.logRequest.onErrorResponse({
      data: { error: (hubInfo as unknown as { message: string }).message },
    } as unknown as AxiosResponse); //FIXME: the server return data should not morph like this. In any case, the response should be same across all endpoints, meaning this too should contain "error" property instead of "message"

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
    const { signedTx } =
      await this._httpWrapper.sendPromise<SignedTransactionDetails>(
        relayUrl + PATHS.POST_RELAY_REQUEST,
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
    const response = await this._httpWrapper.sendPromise<RelayEstimation>(
      relayUrl + PATHS.POST_ESTIMATE,
      this._stringifyEnvelopingTx(envelopingTx)
    );
    log.info('esimation relayTransaction response:', response);

    return response;
  }
}

export default HttpClient;

export { PATHS as RELAY_PATHS, VERIFIER_SUFFIX };
export type { RelayPath, SignedTransactionDetails };

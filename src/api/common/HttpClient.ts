import type { AxiosResponse } from 'axios';
import log from 'loglevel';
import type { RelayEstimation } from 'src/common/estimation.types';
import type { HubInfo } from 'src/common/relayHub.types';
import type { EnvelopingTxRequest } from 'src/common/relayTransaction.types';
import HttpWrapper, { requestInterceptors } from './HttpWrapper';

const PATHS = {
  GET_INFO: '/getaddr',
  POST_RELAY_REQUEST: '/relay',
  POST_ESTIMATE: '/estimate',
} as const;
const VERIFIER_SUFFIX = '?verifier=';

type RelayPath = typeof PATHS[keyof typeof PATHS];

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
      relayUrl + PATHS.GET_INFO + verifierSuffix
    );
    log.info(`hubInfo: ${JSON.stringify(hubInfo)}`);
    requestInterceptors.logRequest.onErrorResponse({
      data: { error: (hubInfo as unknown as { message: string }).message },
    } as unknown as AxiosResponse); //FIXME: the server return data should not morph like this. In any case, the response should be same across all endpoints, meaning this too should contain "error" property instead of "message"

    return hubInfo;
  }

  async relayTransaction(
    relayUrl: string,
    request: EnvelopingTxRequest
  ): Promise<string> {
    const { signedTx } =
      await this._httpWrapper.sendPromise<SignedTransactionDetails>(
        relayUrl + PATHS.POST_RELAY_REQUEST,
        request
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
    request: EnvelopingTxRequest
  ): Promise<RelayEstimation> {
    const response = await this._httpWrapper.sendPromise<RelayEstimation>(
      relayUrl + PATHS.POST_ESTIMATE,
      request
    );
    log.info('esimation relayTransaction response:', response);

    return response;
  }
}

export default HttpClient;

export { PATHS as RELAY_PATHS, VERIFIER_SUFFIX };
export type { RelayPath, SignedTransactionDetails };

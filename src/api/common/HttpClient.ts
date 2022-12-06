import type { AxiosResponse } from 'axios';
import log from 'loglevel';
import type {
    HubInfo,
    RelayEstimation,
    RelayOrDeployRequest
} from '../../common/relay.types';
import HttpWrapper from './HttpWrapper';
import { requestInterceptors } from './HttpWrapper';
import type {
    AxiosRequestConfig,
} from 'axios';
import type { LogLevelDesc } from 'loglevel';

const PATHS = {
  GET_INFO: '/getaddr',
  POST_RELAY_REQUEST: '/relay',
  POST_ESTIMATE: '/estimate',
} as const;
const VERIFIER_SUFFIX = '?verifier=';

type SignedTransactionDetails = {
  transactionHash: string;
  signedTx: string;
};

export default class HttpClient {
  private readonly _httpWrapper: HttpWrapper;

  constructor(httpWrapper: HttpWrapper) {
    this._httpWrapper = httpWrapper;
  }

  async getChainInfo(relayUrl: string, verifier = ''): Promise<HubInfo> {
    const verifierSuffix = verifier && `${VERIFIER_SUFFIX}${verifier}`;
    const hubInfo: HubInfo = await this._httpWrapper.sendPromise(
      relayUrl + PATHS.GET_INFO + verifierSuffix
    );
    log.info(`hubInfo: ${JSON.stringify(hubInfo)}`);
    requestInterceptors.logRequest.onErrorResponse({ data: {error: (hubInfo as unknown as { message: string; }).message} } as unknown as AxiosResponse); //FIXME: the server return data should not morph like this. In any case, the response should be same across all endpoints, meaning this too should contain "error" property instead of "message"

    return hubInfo;
  }

  async relayTransaction(
    relayUrl: string,
    request: RelayOrDeployRequest
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
    request: RelayOrDeployRequest
  ): Promise<RelayEstimation> {
    const response = await this._httpWrapper.sendPromise<RelayEstimation>(
      relayUrl + PATHS.POST_ESTIMATE,
      request
    );
    log.info('esimation relayTransaction response:', response);

    return response;
  }
}

export type RelayPath = typeof PATHS[keyof typeof PATHS];
export const RELAY_PATHS = PATHS;
export const getDefaultHttpClient = (
  opts: AxiosRequestConfig = {},
  logLevel: LogLevelDesc = 'error'
) => new HttpClient(new HttpWrapper(opts, logLevel));

import SuperAgent, { Response, ResponseError } from 'superagent';
import log, { LogLevelDesc } from 'loglevel';

const logger = log.getLogger('HttpWrapper');
const LOGMAXLEN = 120;
const DEFAULT_TIMEOUT = 30000;

type HttpWrapperOpts = {
  timeout?: number;
};

const getCircularReplacer = () => {
  const seen = new WeakSet();

  return (_: unknown, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }

    return value;
  };
};
const stringify = (something: unknown): string =>
  JSON.stringify(something, getCircularReplacer(), 3);

const interceptors = {
  logRequest: {
    onErrorResponse: (response: Response) => {
      logger.debug('relayTransaction response:', response.body);
      const data = response.body as { error: string } | undefined;

      if (!data) {
        const message = 'Got undefined response from relay';
        logger.error(message);
        throw new Error(message);
      }

      if (data.error) {
        logger.error(`Error within response: ${data.error}`);
        throw new Error(`Got error response from relay: ${data.error}`);
      }

      return response;
    },
    onResponse: (response: Response) => {
      logger.info(`Got a response:${response.text.slice(0, LOGMAXLEN)}`);

      return response;
    },
    onError: (error: ResponseError) => {
      const { response, message } = error;
      logger.error('Error while setting up request', message);
      if (response) {
        logger.error(`Response error: ${stringify(response)}`);
      }

      return error;
    },
  },
};

export default class HttpWrapper {
  private readonly _httpClient;

  private timeout;

  constructor(opts: HttpWrapperOpts = {}, logLevel: LogLevelDesc = 'error') {
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    this._httpClient = SuperAgent.agent()
      .timeout(this.timeout)
      .type('json')
      .on('response', interceptors.logRequest.onResponse)
      .on('error', interceptors.logRequest.onError);

    logger.setLevel(logLevel);
  }

  async sendPromise<T>(url: string, jsonRequestData?: unknown) {
    logger.info(
      'Sending request:',
      url,
      jsonRequestData && stringify(jsonRequestData).slice(0, LOGMAXLEN)
    );

    const request = jsonRequestData
      ? this._httpClient.post(url).send(jsonRequestData)
      : this._httpClient.get(url);

    const response = await request.catch(() => {
      logger.debug(`Request failed: ${stringify(request)}`);

      return request;
    });

    return response.body as T;
  }
}

export const requestInterceptors = interceptors;

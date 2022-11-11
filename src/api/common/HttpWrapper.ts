import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse
} from 'axios';
import log, { LogLevelDesc } from 'loglevel';

const LOGMAXLEN = 120;
const DEFAULT_TIMEOUT = 30000;

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
    onErrorResponse: (response: AxiosResponse) => {
      log.debug('relayTransaction response:', response);
      const data = (response.data as {error: string} | undefined);
      if (data?.error) {
        log.error(`Error within response: ${data.error}`);
        throw new Error(`Got error response from relay: ${data.error}`);
      }
      
      return response;
    },
    onResponse: (response: AxiosResponse) => {
      log.info(
        `Got a response: ${response.config.url as string}${stringify(
          response.data
        ).slice(0, LOGMAXLEN)}`
      );

      return response;
    },
    onError: (error: AxiosError) => {
      const { response, message, config } = error;
      if (error.request) {
        log.error(`Request failed: ${stringify(error.request)}`);
      }
      if (response) {
        log.error(`Response error: ${stringify(response)}`);
      }
      if (!error.request && !response) {
        log.error('Error while setting up request', stringify(message));
      }
      log.debug(`Configuration: ${stringify(config)}`);

      return Promise.reject(error);
    },
  },
};

export default class HttpWrapper {
  private readonly _httpClient: AxiosInstance;

  constructor(
    opts: AxiosRequestConfig = {},
    loglLevel: LogLevelDesc = 'error'
  ) {
    this._httpClient = axios.create({
      timeout: DEFAULT_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    log.setLevel(loglLevel);

    this._httpClient.interceptors.response.use(
      interceptors.logRequest.onResponse,
      interceptors.logRequest.onError
    );
  }

  async sendPromise<T>(url: string, jsonRequestData?: unknown): Promise<T> {
    log.info(
      'Sending request:',
      url,
      jsonRequestData && stringify(jsonRequestData).slice(0, LOGMAXLEN)
    );

    const { data } = await this._httpClient.request<T>({
      url,
      method: jsonRequestData ? 'POST' : 'GET',
      data: jsonRequestData,
    });

    return data;
  }
}

export const requestInterceptors = interceptors;

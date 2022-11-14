import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import BigNumber from 'bignumber.js';
import BaseExchangeApi, { CurrencyMapping } from './ExchangeApi';
import log, { LogLevelDesc } from 'loglevel';

const URL = 'https://api.coinbase.com/v2/exchange-rates';

export type CoinBaseResponse = {
    data: {
        currency: string;
        rates: Record<string, string>;
    };
};

type CoinBaseError = {
    id: string;
    message: string;
};

export type CoinBaseErrorResponse = {
    errors: Array<CoinBaseError>;
};

const CURRENCY_MAPPING: CurrencyMapping = {
    RIF: 'RIF',
    RBTC: 'RBTC',
    TRIF: 'RIF'
};

/* TODO:
 * This part need to be reviewed to avoid the duplicated code with the
 * [HttpWrapper](https://github.com/rsksmart/rif-relay-client/blob/45337c5a7c3958dcee5610c77a0054ae43606b11/src/api/common/HttpWrapper.ts#L29)
 * available in the branch that includes the ethers.js support.
 */
const interceptors = {
    logRequest: {
        onResponse: (response: AxiosResponse) => {
            log.info(
                `Got a response: ${response.config.url as string}`,
                response.data
            );

            return response;
        },
        onError: (error: AxiosError) => {
            const { response, request } = error;
            if (!request) {
                log.error('Error while setting up request', error);
            }
            if (request) {
                log.error('Request sent:', request);
            }
            if (response) {
                log.error('Response error:', response.data, response.status);
            }

            return Promise.reject(error);
        }
    }
};

export default class CoinBase extends BaseExchangeApi {
    private readonly _httpClient: AxiosInstance;

    constructor(loglLevel: LogLevelDesc = 'error') {
        super('CoinBase', CURRENCY_MAPPING, ['RIF', 'RBTC', 'tRif']);
        log.setLevel(loglLevel);

        this._httpClient = axios.create();
        this._httpClient.interceptors.response.use(
            interceptors.logRequest.onResponse,
            interceptors.logRequest.onError
        );
    }

    async queryExchangeRate(
        sourceCurrency: string,
        targetCurrency: string
    ): Promise<BigNumber> {
        const upperCaseTargetCurrency = targetCurrency.toUpperCase();
        let response: AxiosResponse;

        try {
            response = await axios.get(`${URL}?currency=${sourceCurrency}`);
        } catch (error: unknown) {
            const { response, request } = error as AxiosError;
            if (response) {
                throw Error(
                    `CoinBase API status ${response.status}/${response.statusText}`
                );
            }
            if (request) {
                throw Error('No response received from CoinBase API');
            }
            throw new Error('The request was not sent to the CoinBase API');
        }

        const {
            data: { rates }
        }: CoinBaseResponse = response.data;
        const conversionRate = rates[upperCaseTargetCurrency];

        if (!conversionRate) {
            throw Error(
                `Exchange rate for currency pair ${sourceCurrency}/${targetCurrency} is not available`
            );
        }

        return new BigNumber(conversionRate);
    }
}

export interface SourceApi {
    query(input: string, ouput: string): Promise<number>;
}

export type CoinBaseResponse = {
    data: {
        currency: string;
        rates: Record<string, string>;
    };
};

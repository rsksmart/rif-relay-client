import type { BigNumber } from 'ethers';

type EthersError = {
  code?: string | number;
  message: string;
  error?: NestedEthersError;
  transaction?: {
    gasLimit: BigNumber;
    nonce: number;
  };
  receipt?: {
    gasUsed: BigNumber;
  };
  action?: string;
  reason?: string;
};

type NestedEthersError = {
  code?: string | number;
  message?: string;
  data?: {
    message: string;
  };
  error?: {
    error?: {
      code?: string | number;
    };
    body?: string;
  };
};

const parseEthersError = (ethersError: EthersError): string => {
  const message = ethersError.message;

  if (!ethersError.error) {
    return message;
  }

  const { error } = ethersError;

  if (!error.data) {
    return error.message ?? message;
  }

  const { data } = error;

  return data.message;
};

export { parseEthersError };

export type { EthersError };

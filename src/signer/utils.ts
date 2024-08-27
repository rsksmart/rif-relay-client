import { providers, utils, Wallet } from 'ethers';
import type {
  EnvelopingMessageTypes,
  TypedMessage,
} from '../typedRequestData.utils';
import { getProvider } from '../common';
import { _TypedDataEncoder } from 'ethers/lib/utils';

const recoverSignature = (
  data: TypedMessage<EnvelopingMessageTypes>,
  signature: string
) => {
  const { domain, types, value } = data;

  return utils.verifyTypedData(domain, types, value, signature);
};

const signWithProvider = async <T>(
  from: string,
  data: TypedMessage<EnvelopingMessageTypes>,
  signatureVersion = 'v4',
  jsonStringify = true
): Promise<T> => {
  const provider = getProvider() as providers.JsonRpcProvider;
  if (!provider.send) {
    throw new Error(`Not an RPC provider`);
  }

  const { domain, types, value } = data;

  let encondedData: TypedMessage<EnvelopingMessageTypes> | string;
  if (jsonStringify) {
    encondedData = JSON.stringify(
      _TypedDataEncoder.getPayload(domain, types, value)
    );
  } else {
    encondedData = _TypedDataEncoder.getPayload(
      domain,
      types,
      value
    ) as TypedMessage<EnvelopingMessageTypes>;
  }

  return (await provider.send(`eth_signTypedData_${signatureVersion}`, [
    from,
    encondedData,
  ])) as T;
};

const signWithWallet = async (
  wallet: Wallet,
  data: TypedMessage<EnvelopingMessageTypes>
): Promise<string> => {
  const { domain, types, value } = data;

  return await wallet._signTypedData(domain, types, value);
};

export { recoverSignature, signWithProvider, signWithWallet };

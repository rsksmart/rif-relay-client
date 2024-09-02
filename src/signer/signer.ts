import type { Wallet } from 'ethers';
import {
  deployRequestType,
  EnvelopingMessageTypes,
  getEnvelopingRequestDataV4Field,
  relayRequestType,
  TypedMessage,
} from '../typedRequestData.utils';
import { EnvelopingRequest, getProvider, isDeployRequest } from '../common';
import { recoverSignature, signWithProvider, signWithWallet } from './utils';

const signEnvelopingRequest = async (
  envelopingRequest: EnvelopingRequest,
  fromAddress: string,
  signerWallet?: Wallet
): Promise<string> => {
  const callForwarder = await envelopingRequest.relayData.callForwarder;
  const provider = getProvider();
  const { chainId } = await provider.getNetwork();

  const data = getEnvelopingRequestDataV4Field({
    chainId,
    verifier: callForwarder,
    envelopingRequest,
    requestTypes: isDeployRequest(envelopingRequest)
      ? deployRequestType
      : relayRequestType,
  });

  const { signature, recoveredAddr } = await getSignatureFromTypedData(
    data,
    fromAddress,
    signerWallet
  ).catch((error) => {
    throw new Error(
      `Failed to sign relayed transaction for ${fromAddress}: ${
        error as string
      }`
    );
  });

  if (recoveredAddr !== fromAddress) {
    throw new Error(
      `Internal RelayClient exception: signature is not correct: sender=${fromAddress}, recovered=${recoveredAddr}`
    );
  }

  return signature;
};

const getSignatureFromTypedData = async (
  data: TypedMessage<EnvelopingMessageTypes>,
  from: string,
  wallet?: Wallet
): Promise<{ signature: string; recoveredAddr: string }> => {
  const signature: string = wallet
    ? await signWithWallet(wallet, data)
    : await signWithProvider(from, data);
  const recoveredAddr = recoverSignature(data, signature);

  return { signature, recoveredAddr };
};

export { signEnvelopingRequest };

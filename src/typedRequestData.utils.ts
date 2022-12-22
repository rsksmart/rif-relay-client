import {
  MessageTypeProperty,
  MessageTypes,
  SignTypedDataVersion,
  TypedDataUtils,
  TypedMessage,
} from '@metamask/eth-sig-util';
import type { EnvelopingRequest } from './common/relayRequest.types';

export type EIP712Domain = TypedMessage<EnvelopingMessageTypes>['domain'];

export const eip712DomainType = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

export const relayDataType = [
  { name: 'gasPrice', type: 'uint256' },
  { name: 'feesReceiver', type: 'address' },
  { name: 'callForwarder', type: 'address' },
  { name: 'callVerifier', type: 'address' },
];

export const requestType = [
  { name: 'relayHub', type: 'address' },
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'tokenContract', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'tokenAmount', type: 'uint256' },
  { name: 'tokenGas', type: 'uint256' },
  { name: 'data', type: 'bytes' },
  { name: 'relayData', type: 'RelayData' },
];

export const relayRequestType = [
  ...requestType,
  { name: 'gas', type: 'uint256' },
];

export const deployRequestType = [
  ...requestType,
  { name: 'recoverer', type: 'address' },
  { name: 'index', type: 'uint256' },
];

export type EnvelopingMessageTypes = MessageTypes & {
  RelayRequest: MessageTypeProperty[];
  RelayData: MessageTypeProperty[];
};

export function getDomainSeparator(
  verifyingContract: string,
  chainId: number
): EIP712Domain {
  return {
    name: 'RSK Enveloping Transaction',
    version: '2',
    chainId: chainId,
    verifyingContract: verifyingContract,
  };
}

export const getDomainSeparatorHash = (
  verifier: string,
  chainId: number
): string =>
  TypedDataUtils.hashStruct(
    'EIP712Domain',
    getDomainSeparator(verifier, chainId),
    { EIP712Domain: eip712DomainType },
    SignTypedDataVersion.V4
  ).toString('hex');

type GetRequestDataFieldProps = {
  chainId: number;
  verifier: string;
  envelopingRequest: EnvelopingRequest;
  requestTypes: MessageTypeProperty[];
};

export const getEnvelopingRequestDataV4Field = ({
  chainId,
  verifier,
  envelopingRequest,
  requestTypes,
}: GetRequestDataFieldProps): TypedMessage<EnvelopingMessageTypes> => ({
  types: {
    EIP712Domain: eip712DomainType,
    RelayRequest: requestTypes,
    RelayData: relayDataType,
  },
  primaryType: 'RelayRequest',
  domain: getDomainSeparator(verifier, chainId),
  message: {
    ...envelopingRequest.request,
    relayData: envelopingRequest.relayData,
  },
});

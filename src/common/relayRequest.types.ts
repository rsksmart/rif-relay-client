import type { EnvelopingTypes } from '@rsksmart/rif-relay-contracts';
import type { Modify } from './utility.types';

type RelayRequest = EnvelopingTypes.RelayRequestStruct;
type DeployRequest = EnvelopingTypes.DeployRequestStruct;

type RelayRequestBody = RelayRequest['request'];
type DeployRequestBody = DeployRequest['request'];

type EnvelopingRequest = RelayRequest | DeployRequest;

type UserDefinedRelayRequestBody = Modify<
  RelayRequestBody,
  Pick<Partial<RelayRequestBody>, 'relayHub' | 'gas' | 'nonce' | 'tokenGas'>
>;

type UserDefinedDeployRequestBody = Modify<
  DeployRequestBody,
  Pick<
    Partial<DeployRequestBody>,
    'relayHub' | 'nonce' | 'tokenGas' | 'recoverer' | 'index'
  >
>;

type EnvelopingRequestData = RelayRequest['relayData'];

type UserDefinedRelayData = Modify<
  EnvelopingRequestData,
  Pick<
    Partial<EnvelopingRequestData>,
    'callVerifier' | 'feesReceiver' | 'gasPrice'
  >
>;
type UserDefinedDeployData = Partial<EnvelopingRequestData>;

type RelayOnlyRequestKey = keyof Omit<
  RelayRequestBody,
  keyof DeployRequestBody
>;

type DeployOnlyRequestKey = keyof Omit<
  DeployRequestBody,
  keyof RelayRequestBody
>;

type UserDefinedRelayRequest = Modify<
  RelayRequest,
  {
    request: UserDefinedRelayRequestBody;
    relayData: UserDefinedRelayData;
  }
>;

type UserDefinedDeployRequest = Modify<
  DeployRequest,
  {
    request: UserDefinedDeployRequestBody;
    relayData: UserDefinedRelayData;
  }
>;

type UserDefinedEnvelopingRequest =
  | UserDefinedRelayRequest
  | UserDefinedDeployRequest;

export type {
  UserDefinedRelayRequestBody,
  UserDefinedDeployRequestBody,
  UserDefinedRelayRequest,
  UserDefinedDeployRequest,
  UserDefinedEnvelopingRequest,
  UserDefinedRelayData,
  UserDefinedDeployData,
};
export type {
  RelayRequest,
  DeployRequest,
  EnvelopingRequest,
  RelayRequestBody,
  DeployRequestBody,
  EnvelopingRequestData,
};
export type { RelayOnlyRequestKey, DeployOnlyRequestKey };

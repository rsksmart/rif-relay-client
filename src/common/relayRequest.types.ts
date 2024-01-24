import type { EnvelopingTypes } from '@rsksmart/rif-relay-contracts';
import type { Either, Modify } from './utility.types';

type RelayRequest = EnvelopingTypes.RelayRequestStruct;
type DeployRequest = EnvelopingTypes.DeployRequestStruct;

type RelayRequestBody = RelayRequest['request'];
type DeployRequestBody = DeployRequest['request'];

type EnvelopingRequest = {
  request: Either<RelayRequestBody, DeployRequestBody>;
  relayData: EnvelopingRequestData;
};

type UserDefinedRelayRequestBody = Modify<
  RelayRequestBody,
  Pick<
    Partial<RelayRequestBody>,
    | 'relayHub'
    | 'nonce'
    | 'tokenGas'
    | 'validUntilTime'
    | 'value'
    | 'tokenAmount'
    | 'gas'
  >
>;

type UserDefinedDeployRequestBody = Modify<
  DeployRequestBody,
  Pick<
    Partial<DeployRequestBody>,
    | 'relayHub'
    | 'nonce'
    | 'tokenGas'
    | 'validUntilTime'
    | 'value'
    | 'tokenAmount'
    | 'recoverer'
    | 'data'
    | 'to'
    | 'gas'
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

type CommonEnvelopingRequestBody = Omit<
  RelayRequestBody,
  RelayOnlyRequestKey | DeployOnlyRequestKey
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
    relayData?: UserDefinedDeployData;
  }
>;

type UserDefinedEnvelopingRequest = Either<
  UserDefinedRelayRequest,
  UserDefinedDeployRequest
>;

/* type UserDefinedEnvelopingRequest = UserDefinedRelayRequest &
  UserDefinedDeployRequest;  */

export type {
  UserDefinedRelayRequestBody,
  UserDefinedDeployRequestBody,
  CommonEnvelopingRequestBody,
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

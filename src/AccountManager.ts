import sigUtil, {
  SignTypedDataVersion,
  TypedMessage,
} from '@metamask/eth-sig-util';
import type { EnvelopingTypes } from '@rsksmart/rif-relay-contracts/dist/typechain-types/contracts/RelayHub';
import { providers, Wallet } from 'ethers';
import { getAddress } from 'ethers/lib/utils';
import {
  deployRequestType,
  EnvelopingMessageTypes,
  getEnvelopingRequestDataV4Field,
  relayRequestType,
} from './typedRequestData.utils';

export type RelayOrDeployRequest =
  | EnvelopingTypes.RelayRequestStruct
  | EnvelopingTypes.DeployRequestStruct;

export default class AccountManager {
  private _provider: providers.Provider;

  private _accounts: Wallet[] = [];

  chainId: number;

  constructor(provider: providers.Provider, chainId: number) {
    this._provider = provider;
    this.chainId = chainId;
  }

  getAccounts(): string[] {
    return this._accounts.map((it) => it.address);
  }

  addAccount(account: Wallet): void {
    const wallet = new Wallet(account.privateKey, this._provider);
    if (wallet.address !== account.address) {
      throw new Error('invalid keypair');
    }
    this._accounts.push(wallet);
  }

  isDeployRequest({ request }: RelayOrDeployRequest): boolean {
    return 'index' in request;
  }

  async sign(relayRequest: RelayOrDeployRequest): Promise<string> {
    const callForwarder = relayRequest.relayData.callForwarder.toString();
    const fromAddress: string = getAddress(
      relayRequest.request.from.toString()
    );
    const isDeploy = this.isDeployRequest(relayRequest);
    const data = getEnvelopingRequestDataV4Field({
      chainId: this.chainId,
      verifier: callForwarder,
      relayRequest,
      requestTypes: isDeploy ? deployRequestType : relayRequestType,
    });
    const wallet = this._accounts.find(
      (account) => getAddress(account.address) === fromAddress
    );
    const { signature, recoveredAddr } = await this._getSignatureFromTypedData(
      data,
      fromAddress,
      wallet
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
  }

  private async _getSignatureFromTypedData(
    data: TypedMessage<EnvelopingMessageTypes>,
    from: string,
    wallet?: Wallet
  ): Promise<{ signature: string; recoveredAddr: string }> {
    const signature: string = wallet
      ? this._signWithWallet(wallet, data)
      : await this._signWithProvider(from, data);
    const recoveredAddr = getAddress(this._recoverSignature(data, signature));

    return { signature, recoveredAddr };
  }

  private _recoverSignature(
    data: TypedMessage<EnvelopingMessageTypes>,
    signature: string
  ) {
    return sigUtil.recoverTypedSignature<
      SignTypedDataVersion.V4,
      EnvelopingMessageTypes
    >({
      data,
      signature,
      version: SignTypedDataVersion.V4,
    });
  }

  private async _signWithProvider<T>(
    from: string,
    data: TypedMessage<EnvelopingMessageTypes>
  ): Promise<T> {
    const provider = this._provider as providers.JsonRpcProvider;
    if (!provider.send) {
      throw new Error(`Not an RPC provider`);
    }

    return (await provider.send('eth_signTypedData_v4', [from, data])) as T;
  }

  private _signWithWallet(
    { privateKey }: Wallet,
    data: TypedMessage<EnvelopingMessageTypes>
  ): string {
    return sigUtil.signTypedData({
      privateKey: Buffer.from(privateKey, 'hex'),
      data,
      version: SignTypedDataVersion.V4,
    });
  }
}

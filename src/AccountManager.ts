import { providers, Wallet, utils } from 'ethers';
import { getAddress, _TypedDataEncoder } from 'ethers/lib/utils';
import { getProvider, isDeployRequest } from './common';
import type { EnvelopingRequest } from './common';
import {
  deployRequestType,
  EnvelopingMessageTypes,
  getEnvelopingRequestDataV4Field,
  relayRequestType,
  TypedMessage,
} from './typedRequestData.utils';

export default class AccountManager {
  private static instance: AccountManager;

  private readonly _accounts: Wallet[];

  private constructor() {
    this._accounts = [];
  }

  public static getInstance(): AccountManager {
    if (!AccountManager.instance) {
      AccountManager.instance = new AccountManager();
    }

    return AccountManager.instance;
  }

  getAccounts(): string[] {
    return this._accounts.map((it) => it.address);
  }

  addAccount(account: Wallet): void {
    const provider = getProvider();
    const wallet = new Wallet(account.privateKey, provider); //***************?????????? */
    if (wallet.address !== account.address) {
      throw new Error('invalid keypair');
    }
    this._accounts.push(wallet);
  }

  removeAccount(addressToRemove: string) {
    const indexToDelete = this._accounts.findIndex(function (wallet) {
      return wallet.address === addressToRemove;
    });

    if (indexToDelete !== -1) {
      this._accounts.splice(indexToDelete, 1);
    } else {
      throw new Error('Account not founded');
    }
  }

  async sign(
    envelopingRequest: EnvelopingRequest,
    signerPrivateKey?: string
  ): Promise<string> {
    const callForwarder = envelopingRequest.relayData.callForwarder.toString();
    const provider = getProvider();
    const { chainId } = await provider.getNetwork();

    let signerWallet: Wallet | undefined;
    let fromAddress: string;

    if (signerPrivateKey) {
      signerWallet = new Wallet(signerPrivateKey, provider);//*******TODO: What if the PK is wrong*/
      fromAddress = signerWallet.address;
    } else {
      fromAddress = getAddress(
        envelopingRequest.request.from.toString()
      );
      signerWallet = this._accounts.find(
        (account) => getAddress(account.address) === fromAddress
      );

      if(!signerWallet){
        throw new Error('Account not founded');
      }
    }

    const data = getEnvelopingRequestDataV4Field({
      chainId,
      verifier: callForwarder,
      envelopingRequest,
      requestTypes: isDeployRequest(envelopingRequest)
        ? deployRequestType
        : relayRequestType,
    });

    const { signature, recoveredAddr } = await this._getSignatureFromTypedData(//*******fromAddress is being ignored here */
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
  }

  private async _getSignatureFromTypedData(
    data: TypedMessage<EnvelopingMessageTypes>,
    from: string,
    wallet?: Wallet
  ): Promise<{ signature: string; recoveredAddr: string }> {
    const signature: string = wallet
      ? await this._signWithWallet(wallet, data)
      : await this._signWithProvider(from, data);
    const recoveredAddr = this._recoverSignature(data, signature);

    return { signature, recoveredAddr };
  }

  private _recoverSignature(
    data: TypedMessage<EnvelopingMessageTypes>,
    signature: string
  ) {
    const { domain, types, value } = data;

    return utils.verifyTypedData(domain, types, value, signature);
  }

  private async _signWithProvider<T>(
    from: string,
    data: TypedMessage<EnvelopingMessageTypes>,
    signatureVersion = 'v4',
    jsonStringify = true
  ): Promise<T> {
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
  }

  private async _signWithWallet(
    wallet: Wallet,
    data: TypedMessage<EnvelopingMessageTypes>
  ): Promise<string> {
    const { domain, types, value } = data;

    return await wallet._signTypedData(domain, types, value);
  }
}

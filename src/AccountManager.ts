import { Wallet } from 'ethers';
import { getAddress } from 'ethers/lib/utils';
import { getProvider } from './common';
import type { EnvelopingRequest } from './common';
import { signEnvelopingRequest } from './signer';

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
    const wallet = new Wallet(account.privateKey, provider);
    if (wallet.address !== account.address) {
      throw new Error('invalid keypair');
    }
    this._accounts.push(wallet);
  }

  removeAccount(addressToRemove: string) {
    const indexToRemove = this._accounts.findIndex(function (wallet) {
      return wallet.address === addressToRemove;
    });

    if (indexToRemove !== -1) {
      this._accounts.splice(indexToRemove, 1);
    } else {
      throw new Error('Account not found');
    }
  }

  async sign(
    envelopingRequest: EnvelopingRequest,
    signerWalletOnTheFly?: Wallet
  ): Promise<string> {
    const fromAddress = getAddress(await envelopingRequest.request.from);

    const signerWallet =
      signerWalletOnTheFly ||
      this._accounts.find(
        (account) => getAddress(account.address) === fromAddress
      );

    return signEnvelopingRequest(envelopingRequest, fromAddress, signerWallet);
  }
}

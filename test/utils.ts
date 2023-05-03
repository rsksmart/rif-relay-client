import { BigNumber, Wallet } from 'ethers';

export const createRandomAddress = () => Wallet.createRandom().address;
export const createRandomValue = (value: number) =>
  `${(Math.random() * value).toFixed(0)}`;
export const createRandomBigNumber = (base: number) =>
  BigNumber.from((Math.random() * base).toFixed(0));

import { Wallet } from 'ethers';

const createRandomAddress = () => Wallet.createRandom().address;

export { createRandomAddress };

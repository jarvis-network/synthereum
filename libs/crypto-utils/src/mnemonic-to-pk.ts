import * as bip39 from 'ethereum-cryptography/bip39';
import { wordlist as wordList } from 'ethereum-cryptography/bip39/wordlists/english';
import Wallet, { hdkey as EthereumHDKey } from 'ethereumjs-wallet';

export interface MnemonicOptions {
  phrase: string;
  password?: string;
  startAddress?: number;
  numberOfAddresses?: number;
  walletHdPath: string;
  deriveExact: boolean;
}

export function deriveWalletsFromBip39Mnemonic({
  phrase,
  password,
  deriveExact = false,
  startAddress = 0,
  numberOfAddresses = 10,
  walletHdPath = `m/44'/60'/0'/0/`,
}: MnemonicOptions): { wallets: Record<string, Wallet>; accounts: string[] } {
  // Based on: https://github.com/trufflesuite/truffle/blob/v5.3.7/packages/hdwallet-provider/src/index.ts

  if (!bip39.validateMnemonic(phrase, wordList)) {
    throw new Error('Mnemonic invalid or undefined');
  }

  const hdWallet = EthereumHDKey.fromMasterSeed(
    bip39.mnemonicToSeedSync(phrase, password),
  );

  const accounts: string[] = [];
  const wallets: Record<string, Wallet> = {};

  if (deriveExact) {
    const wallet = hdWallet.derivePath(walletHdPath).getWallet();
    const addr = `0x${wallet.getAddress().toString('hex')}`;
    accounts.push(addr);
    wallets[addr] = wallet;
  } else {
    for (let i = startAddress; i < startAddress + numberOfAddresses; i++) {
      const wallet = hdWallet.derivePath(walletHdPath + i).getWallet();
      const addr = `0x${wallet.getAddress().toString('hex')}`;
      accounts.push(addr);
      wallets[addr] = wallet;
    }
  }

  return {
    wallets,
    accounts,
  };
}

export function mnemonicToPrivateKey(mnemonic: string, path: string): string {
  const result = deriveWalletsFromBip39Mnemonic({
    phrase: mnemonic,
    walletHdPath: path,
    deriveExact: true,
  });
  return result.wallets[result.accounts[0]].getPrivateKeyString();
}

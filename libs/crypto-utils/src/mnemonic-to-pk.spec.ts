import {
  mnemonicToPrivateKey,
  deriveWalletsFromBip39Mnemonic,
} from './mnemonic-to-pk';

describe('mnemonicToPrivateKey', () => {
  it('should have a sane test environnement', () => {
    // This will fail if `jest.config.js` doesn't contain
    // `Uint8Array: Uint8Array` in the globals.
    // This required by the secp256k1 library use indirectly by the tests below.
    expect(Buffer.from('hello') instanceof Uint8Array).toBeTruthy();
  });

  it('`mnemonicToPrivateKey` should return the same result as `ethers.Wallet.fromMnemonic`', () => {
    const mnemonic =
      'test test test test test test test test test test test junk';
    const path = "m/44'/60'/0'/0/3";
    const expectedPrivateKey =
      '7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';
    expect(mnemonicToPrivateKey(mnemonic, path).toString('hex')).toEqual(
      expectedPrivateKey,
    );
  });

  it('should return the expected set of addresses and private keys', () => {
    const mnemonic =
      'can fiction dirt wrestle ridge unit crash super include alter left rose';
    const path = `m/44'/60'/0'/0/`;

    const addresses = [
      '0x1871A6dED4fcB9dCFC10f2e31f3d1FC11379be27',
      '0x8640Fc5Db40dc069193b1B3aa3074cfD0ff5B0a7',
      '0xf1Ffa8fc7b4aF1b6865e5eDDAAB339b788541f13',
      '0x7D222B62B15b335D3c62aF9c8aBd36f29b38ED4b',
      '0x5106D3F67EcaddD70f3053DEb99A512FB629B9B9',
      '0x683EEf653E8FCe744f1c462bB365f325A5e5dd41',
      '0xb9025530aB5715E72F786A21aeb73663a341C2c2',
      '0x6f5cC75709E0CDeb751d0b1a0f38ce4b0cb762De',
      '0xC9E25C9d9B1b5905d1C1E722cCE45C811417b424',
      '0x18fd780d57fdC170b316D13aB32152D039444C78',
    ].map(x => x.toLowerCase());

    const privateKeys = [
      '0x1d7fca4132188684b184c99ce6c4db12fd8a043c278bcb86385fa150665fc3df',
      '0x543fc8e44cd95a6a722db0b6d63efb1ce874289e675b037bfa0727755046dcc7',
      '0xb185955bab4906f23709d3b5c6849284e8b46e98daa09927043fb1f89921e62a',
      '0xdbaf61c4fb0543441d6494ae7c32fa889874fa6e3c991f721f4536236809ea52',
      '0x35c5e310105730d4b499732d13ae87ed1c78fa8df721e83749653de16888b818',
      '0x34d04c9b6ab9bc0c0e01d16003a03c25e47435945586a4b3c1478502520dd360',
      '0x9252ac4b60c5ca3b791b14ffc1ce07ad155f40a2ad4396b1e862d7f90c8643ba',
      '0x32c26faaf7246bf378a171317e03e1a1adbc7ec48ed65baea632861a37de3d13',
      '0xfe6e50e819dc61b48fd80616d61ab7efcbd737833383926c3a354437cbb70d14',
      '0x9474a8a01c539bfc4cc0e3d31da14cf0429716f7443f76a9aef4cdb10b25d83b',
    ].map(x => x.toLowerCase());

    const wallets = deriveWalletsFromBip39Mnemonic({
      phrase: mnemonic,
      walletHdPath: path,
      startAddress: 0,
      numberOfAddresses: 10,
      deriveExact: false,
      password: undefined,
    });

    expect(wallets.accounts.map(a => a.toLowerCase())).toEqual(addresses);

    for (const [idx, addr] of Object.entries(addresses)) {
      expect(wallets.wallets[addr].getPrivateKeyString().toLowerCase()).toEqual(
        privateKeys[parseInt(idx, 10)],
      );
    }
  });
});

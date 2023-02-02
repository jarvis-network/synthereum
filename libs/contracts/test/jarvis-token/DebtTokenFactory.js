const { artifacts, contract } = require('hardhat');
const { assert, AssertionError } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const web3Utils = require('web3-utils');
const { toWei, hexToUtf8, toBN, utf8ToHex } = web3Utils;
const truffleAssert = require('truffle-assertions');

const TestnetSelfMintingERC20 = artifacts.require('MintableBurnableERC20');
const DebtTokenFactory = artifacts.require('DebtTokenFactory');

contract('Debt Toke Factory Contract', accounts => {
  let jFiat, debtToken;
  let roles = {
    admin: accounts[0],
    maintainer: accounts[1],
  };
  let debtTokenFactory;
  let user1 = accounts[4];
  const debtTokenName = 'Debt Jarvis Synthetic Euro';
  const debtTokenSymbol = 'D-jEUR';

  before(async () => {
    debtTokenFactory = await DebtTokenFactory.new(roles);
    jFiat = await TestnetSelfMintingERC20.new('Jarvis Euro', 'jEur', 18, {
      from: accounts[0],
    });
  });

  describe('Should deploy', () => {
    it('Can deploy using the factory', async () => {
      const debTokenAddress = await debtTokenFactory.createDebtToken.call(
        jFiat.address,
        debtTokenName,
        debtTokenSymbol,
        roles,
        {
          from: roles.maintainer,
        },
      );
      let tx = await debtTokenFactory.createDebtToken(
        jFiat.address,
        debtTokenName,
        debtTokenSymbol,
        roles,
        {
          from: roles.maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'DebtTokenCreated', ev => {
        return ev.jAsset == jFiat.address && ev.debtToken == debTokenAddress;
      });
      const jTokenSymbol = await jFiat.symbol.call();
      let tokenSymbols = await debtTokenFactory.getSyntheticTokens.call();
      assert.deepEqual(tokenSymbols, [jTokenSymbol], 'Wrong token symbols');
      assert.equal(
        debTokenAddress,
        await debtTokenFactory.debtToken.call(jTokenSymbol),
      );
      assert.notEqual(debTokenAddress, ZERO_ADDRESS);
      jFiat = await TestnetSelfMintingERC20.new('Jarvis Euro', 'jEur', 18, {
        from: accounts[0],
      });
      const secondJTokenSymbol = 'jGBP';
      jFiatSecond = await TestnetSelfMintingERC20.new(
        'Jarvis British Pound',
        secondJTokenSymbol,
        18,
        {
          from: accounts[0],
        },
      );
      await debtTokenFactory.createDebtToken(
        jFiatSecond.address,
        'Debt Jarvis Synthetic British Pound',
        'D-jGBP',
        roles,
        {
          from: roles.maintainer,
        },
      );
      tokenSymbols = await debtTokenFactory.getSyntheticTokens.call();
      assert.deepEqual(
        tokenSymbols,
        [jTokenSymbol, secondJTokenSymbol],
        'Wrong token symbols',
      );
    });
    it('Can revert if sender is not the maintainer', async () => {
      await truffleAssert.reverts(
        debtTokenFactory.createDebtToken(
          jFiat.address,
          debtTokenName,
          debtTokenSymbol,
          roles,
          {
            from: user1,
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can revert if debt token linked to an existing synthetic asset', async () => {
      await truffleAssert.reverts(
        debtTokenFactory.createDebtToken(
          jFiat.address,
          debtTokenName,
          debtTokenSymbol,
          roles,
          {
            from: roles.maintainer,
          },
        ),
        'Debt token already created',
      );
    });
    it('Can revert if tryying to get a not existing debt-token', async () => {
      await truffleAssert.reverts(
        debtTokenFactory.debtToken.call('jCHF'),
        'Debt token not supported',
      );
    });
  });
});

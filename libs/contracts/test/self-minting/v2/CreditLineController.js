const {
  ZERO_ADDRESS,
  RegistryRolesEnum,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
  encodeSelfMintingDerivative,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const { version } = require('yargs');
const { assert } = require('console');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const CreditLineController = artifacts.require('CreditLineController');
const SyntheticToken = artifacts.require('MintableBurnableSyntheticToken');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const CreditLine = artifacts.require('CreditLine');
const CreditLineLib = artifacts.require('CreditLineLib');

const { toWei, toBN, stringToHex, utf8ToHex, hexToUtf8 } = web3Utils;

contract('Self-minting controller', function (accounts) {
  let derivativeVersion = 2;

  // Derivative params
  let collateral, tokenCurrency, creditLine, creditLineLib;
  const priceFeedIdentifier = web3.utils.padRight(utf8ToHex('JRT/EUR'), 64);
  const syntheticName = 'Test Synthetic Token';
  const syntheticSymbol = 'SYNTH';
  let feePercentage = toBN(toWei('0.002'));
  let collateralRequirement = toBN(toWei('1.2'));
  let liquidationRewardPct = toBN(toWei('0.2'));

  let feeRecipient = accounts[7];
  let Fee = {
    feePercentage: feePercentage,
    feeRecipients: [feeRecipient],
    feeProportions: [1],
    totalFeeProportions: [1],
  };
  let capMintAmount = toBN(toWei('1000000'));
  const startingPrice = toBN(toWei('1.02'));
  const minSponsorTokens = toWei('5');
  let excessBeneficiary = accounts[4];
  let derivativeAdmins;
  let derivativePools;

  //Pool params
  let derivativeAddress = ZERO_ADDRESS;
  let synthereumFinderAddress;
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];

  //Other params
  let creditLineAddress;
  let controllerInstance;
  let synthereumFinderInstance;

  before(async () => {
    // deploy and link library
    creditLineLib = await CreditLineLib.deployed();
    await CreditLine.link(creditLineLib);
  });
  beforeEach(async () => {
    // set roles
    roles = {
      admin,
      maintainer,
    };

    // Represents WETH or some other token that the sponsor and contracts don't control.
    collateral = await TestnetSelfMintingERC20.new('test', 'tsc', 18);
    await collateral.allocateTo(sponsor, toWei('10000000000000'), {
      from: collateralOwner,
    });
    await collateral.allocateTo(other, toWei('10000000000000000'), {
      from: collateralOwner,
    });

    tokenCurrency = await SyntheticToken.new(
      syntheticName,
      syntheticSymbol,
      18,
      {
        from: admin,
      },
    );

    // Create a mockOracle and finder. Register the mockMoracle with the finder.
    synthereumFinderInstance = await SynthereumFinder.deployed();

    creditLineParams = {
      collateralToken: collateral.address,
      syntheticToken: tokenCurrency.address,
      priceFeedIdentifier: priceFeedIdentifier,
      minSponsorTokens: { rawValue: minSponsorTokens.toString() },
      excessTokenBeneficiary: beneficiary,
      version: derivativeVersion,
      synthereumFinder: synthereumFinderInstance.address,
    };

    creditLine = await CreditLine.new(creditLineParams, {
      from: admin,
    });
    creditLineAddress = creditLine.address;

    controllerInstance = await CreditLineController.new(
      synthereumFinderAddress,
      roles,
      version,
      { from: maintainer },
    );
    await controllerInstance.setCapMintAmount(
      [creditLineAddress],
      [capMintAmount],
      { from: maintainer },
    );
    await controllerInstance.setCollateralRequirement(
      [creditLineAddress],
      [collateralRequirement],
      { from: maintainer },
    );
    await controllerInstance.setLiquidationRewardPercentage(
      [creditLineAddress],
      [liquidationRewardPct],
      { from: maintainer },
    );
    await creditLineControllerInstance.setFeePercentage(
      [creditLine.address],
      [feePercentage],
      { from: maintainer },
    );
    await creditLineControllerInstance.setFeeRecipients(
      [creditLine.address],
      [[Fee.feeRecipients]],
      [[Fee.feeProportions]],
      { from: maintainer },
    );
  });

  describe('Cap mint amount', () => {
    it('Set cap mint amount', async () => {
      let capMint = await controllerInstance.getCapMintAmount.call(
        creditLineAddress,
      );
      assert.equal(capMint, capMintAmount, 'Wrong initial cap mint amount');
      const newCapMintAmount = toWei('1000');
      const updateTx = await controllerInstance.setCapMintAmount(
        [creditLineAddress],
        [newCapMintAmount],
        { from: maintainer },
      );
      capMint = await controllerInstance.getCapMintAmount.call(
        creditLineAddress,
      );
      assert.equal(
        capMint,
        newCapMintAmount,
        'Wrong cap mint amount after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetCapMintAmount', ev => {
        return (
          ev.selfMintingDerivative == creditLineAddress &&
          ev.capMintAmount == capMint.toString()
        );
      });
      await controllerInstance.setCapMintAmount(
        [creditLineAddress],
        [capMintAmount],
        { from: maintainer },
      );
    });
    it('Revert if no self-minting derivatives are passed', async () => {
      await truffleAssert.reverts(
        controllerInstance.setCapMintAmount([], [], {
          from: maintainer,
        }),
        'No self-minting derivatives passed',
      );
    });
    it('Revert if different number of self-minting derivatives and mint amounts', async () => {
      const newCapMintAmount = toWei('1000');
      await truffleAssert.reverts(
        controllerInstance.setCapMintAmount(
          [creditLineAddress, firstWrongAddress],
          [newCapMintAmount],
          {
            from: maintainer,
          },
        ),
        'Number of derivatives and mint cap amounts must be the same',
      );
    });
    it('Revert if try to set the same cap deposit amount', async () => {
      await truffleAssert.reverts(
        controllerInstance.setCapMintAmount(
          [creditLineAddress],
          [capMintAmount],
          {
            from: maintainer,
          },
        ),
        'Cap mint amount is the same',
      );
    });
  });

  describe('Collateral Requirement', () => {
    it('Set collateral requirement', async () => {
      let collReq = await controllerInstance.getCollateralRequirement.call(
        creditLineAddress,
      );
      assert.equal(
        collReq,
        collateralRequirement,
        'Wrong initial collateral req',
      );
      const newCollReq = toWei('1.3');
      const updateTx = await controllerInstance.setCollateralRequirement(
        [creditLineAddress],
        [newCollReq],
        { from: maintainer },
      );
      collReq = await controllerInstance.getCollateralRequirement.call(
        creditLineAddress,
      );
      assert.equal(collReq, newCollReq, 'Wrong coll req after updte');
      truffleAssert.eventEmitted(updateTx, 'SetCollateralRequirement', ev => {
        return (
          ev.selfMintingDerivative == creditLineAddress &&
          ev.collateralRequirement == collReq.toString()
        );
      });
    });
    it('Revert if no self-minting derivatives are passed', async () => {
      await truffleAssert.reverts(
        controllerInstance.setCollateralRequirement([], [], {
          from: maintainer,
        }),
        'No self-minting derivatives passed',
      );
    });
    it('Revert if different number of self-minting derivatives and collateral requirements', async () => {
      const newCollReq = toWei('1000');
      await truffleAssert.reverts(
        controllerInstance.setCollateralRequirement(
          [creditLineAddress, firstWrongAddress],
          [newCollReq],
          {
            from: maintainer,
          },
        ),
        'Number of derivatives and overcollaterals must be the same',
      );
    });
    it('Revert if try to set the same collateral requirement as existing', async () => {
      await truffleAssert.reverts(
        controllerInstance.setCollateralRequirement(
          [creditLineAddress],
          [collateralRequirement],
          {
            from: maintainer,
          },
        ),
        'Collateral requirement is the same',
      );
    });
  });

  describe('Liquidation Reward', () => {
    it('Set liquidation reward', async () => {
      let liqRew = await controllerInstance.getLiquidationRewardPercentage.call(
        creditLineAddress,
      );
      assert.equal(
        liqRew,
        liquidationRewardPct,
        'Wrong initial collateral req',
      );
      const newLiqRew = toWei('1.3');
      const updateTx = await controllerInstance.setLiquidationRewardPercentage(
        [creditLineAddress],
        [newLiqRew],
        { from: maintainer },
      );
      liqRew = await controllerInstance.getLiquidationRewardPercentage.call(
        creditLineAddress,
      );
      assert.equal(liqRew, newLiqRew, 'Wrong liq rew after updte');
      truffleAssert.eventEmitted(updateTx, 'SetLiquidationReward', ev => {
        return (
          ev.selfMintingDerivative == creditLineAddress &&
          ev.liquidationReward == newLiqRew.toString()
        );
      });
    });
    it('Revert if no self-minting derivatives are passed', async () => {
      await truffleAssert.reverts(
        controllerInstance.setLiquidationRewardPercentage([], [], {
          from: maintainer,
        }),
        'No self-minting derivatives passed',
      );
    });
    it('Revert if different number of self-minting derivatives and collateral requirements', async () => {
      const newLiqRew = toWei('1.3');
      await truffleAssert.reverts(
        controllerInstance.setLiquidationRewardPercentage(
          [creditLineAddress, firstWrongAddress],
          [newLiqRew],
          {
            from: maintainer,
          },
        ),
        'Mismatch between derivatives to update and liquidation rewards',
      );
    });
    it('Revert if try to set the same collateral requirement as existing', async () => {
      await truffleAssert.reverts(
        controllerInstance.setLiquidationRewardPercentage(
          [creditLineAddress],
          [liquidationRewardPct],
          {
            from: maintainer,
          },
        ),
        'Liquidation reward is the same',
      );
    });
  });

  describe('Fees', () => {
    it('Set fee percentage', async () => {
      let feeInfo = await controllerInstance.getFeeInfo.call(creditLineAddress);
      assert.equal(
        feeInfo.feePercentage,
        feePercentage,
        'Wrong initial fee percentage',
      );
      const newFeePerc = toWei('1.3');
      const updateTx = await controllerInstance.setFeePercentage(
        [creditLineAddress],
        [newFeePerc],
        { from: maintainer },
      );
      feeInfo = await controllerInstance.getFeeInfo.call(creditLineAddress);
      assert.equal(
        feeInfo.feePercentage,
        newFeePerc,
        'Wrong fee percentage after updte',
      );
      truffleAssert.eventEmitted(updateTx, 'SetFeePercentage', ev => {
        return (
          ev.selfMintingDerivative == creditLineAddress &&
          ev.feePercentage == newFeePerc.toString()
        );
      });
    });
    it('Revert if no self-minting derivatives are passed', async () => {
      await truffleAssert.reverts(
        controllerInstance.setFeePercentage([], [], {
          from: maintainer,
        }),
        'No self-minting derivatives passed',
      );
    });
    it('Revert if different number of self-minting derivatives and fee percentages', async () => {
      const newFeePerc = toWei('1.3');
      await truffleAssert.reverts(
        controllerInstance.setFeePercentage(
          [creditLineAddress, firstWrongAddress],
          [newFeePerc],
          {
            from: maintainer,
          },
        ),
        'Number of derivatives and fee percentages must be the same',
      );
    });
    it('Revert if try to set fee percentage greater than 100%', async () => {
      await truffleAssert.reverts(
        controllerInstance.setFeePercentage(
          [creditLineAddress],
          [toWei('110')],
          {
            from: maintainer,
          },
        ),
        'Fee percentage must be less than 100%',
      );
    });
    it('Revert if try to set the same fee percentage as existing', async () => {
      await truffleAssert.reverts(
        controllerInstance.setFeePercentage(
          [creditLineAddress],
          [feePercentage],
          {
            from: maintainer,
          },
        ),
        'Fee percentage is the same',
      );
    });
    it('Set fee recipients', async () => {
      let feeInfo = await controllerInstance.getFeeInfo.call(creditLineAddress);
      assert.equal(
        feeInfo.feeProportions,
        Fee.feeProportions,
        'Wrong initial fee proportions',
      );
      assert.equal(
        feeInfo.feeRecipients,
        Fee.feeRecipients,
        'Wrong initial fee recipients',
      );

      const newFeeRecipients = { recipients: [accounts[5]], proportions: [1] };
      const updateTx = await controllerInstance.setFeeRecipients(
        [creditLineAddress],
        [[newFeeRecipients.feeRecipients]],
        [[newFeeRecipients.feeProportions]],
        { from: maintainer },
      );
      feeInfo = await controllerInstance.getFeeInfo.call(creditLineAddress);
      assert.equal(
        feeInfo.feeProportions,
        newFeeRecipients.feeProportions,
        'Wrong fee proportions after update',
      );
      assert.equal(
        feeInfo.feeRecipients,
        newFeeRecipients.feeRecipients,
        'Wrong fee recipients after update',
      );

      truffleAssert.eventEmitted(updateTx, 'SetFeeRecipients', ev => {
        return (
          ev.selfMintingDerivative == creditLineAddress &&
          ev.feeRecipient == newFeeRecipients.recipients &&
          ev.feeProportions == newFeeRecipients.feeProportions
        );
      });
    });
    it('Revert if no self-minting derivatives are passed', async () => {
      await truffleAssert.reverts(
        controllerInstance.setFeeRecipients([], [[]], [[]], {
          from: maintainer,
        }),
        'No self-minting derivatives passed',
      );
    });
    it('Revert if different number of self-minting derivatives and fee recipients', async () => {
      await truffleAssert.reverts(
        controllerInstance.setFeeRecipients(
          [creditLineAddress, firstWrongAddress],
          [[]],
          [[]],
          { from: maintainer },
        ),
        'Mismatch between derivatives to update and fee recipients',
      );
      await truffleAssert.reverts(
        controllerInstance.setFeeRecipients(
          [creditLineAddress, firstWrongAddress],
          [[newFeeRecipients.feeRecipients], [newFeeRecipients.feeRecipients]],
          [[]],
          { from: maintainer },
        ),
        'Mismatch between derivatives to update and fee proportions',
      );
    });
  });
  it('Revert if self-minting derivative is not registred', async () => {
    const newSelfMintingRegistry = await SelfMintingRegistry.new(
      synthereumFinderAddress,
    );
    await synthereumFinderInstance.changeImplementationAddress(
      web3Utils.stringToHex('SelfMintingRegistry'),
      newSelfMintingRegistry.address,
      { from: maintainer },
    );
    const notRegistredDerivative = creditLineAddress;
    await truffleAssert.reverts(
      controllerInstance.setCapMintAmount(
        [creditLineAddress],
        [capMintAmount],
        { from: maintainer },
      ),
      'Self-minting derivative not registred',
    );
    await truffleAssert.reverts(
      controllerInstance.setFeePercentage(
        [notRegistredDerivative],
        [feePercentage],
        {
          from: maintainer,
        },
      ),
      'Self-minting derivative not registred',
    );
    await truffleAssert.reverts(
      controllerInstance.setCollateralRequirement(
        [creditLineAddress],
        [collateralRequirement],
        { from: maintainer },
      ),
      'Self-minting derivative not registred',
    );
    await truffleAssert.reverts(
      controllerInstance.setLiquidationRewardPercentage(
        [creditLineAddress],
        [liquidationRewardPct],
        { from: maintainer },
      ),
      'Self-minting derivative not registred',
    );

    await truffleAssert.reverts(
      creditLineControllerInstance.setFeeRecipients(
        [creditLine.address],
        [[Fee.feeRecipients]],
        [[Fee.feeProportions]],
        { from: maintainer },
      ),
      'Self-minting derivative not registred',
    );
  });

  it('Revert if sender is not maintainer', async () => {
    await truffleAssert.reverts(
      controllerInstance.setCapMintAmount(
        [creditLineAddress],
        [capMintAmount],
        { from: accounts[6] },
      ),
      'Sender must be the maintainer',
    );
    await truffleAssert.reverts(
      controllerInstance.setFeePercentage(
        [notRegistredDerivative],
        [feePercentage],
        { from: accounts[6] },
      ),
      'Sender must be the maintainer',
    );
    await truffleAssert.reverts(
      controllerInstance.setCollateralRequirement(
        [creditLineAddress],
        [collateralRequirement],
        { from: accounts[6] },
      ),
      'Sender must be the maintainer',
    );
    await truffleAssert.reverts(
      controllerInstance.setLiquidationRewardPercentage(
        [creditLineAddress],
        [liquidationRewardPct],
        { from: accounts[6] },
      ),
      'Sender must be the maintainer',
    );

    await truffleAssert.reverts(
      creditLineControllerInstance.setFeeRecipients(
        [creditLine.address],
        [[Fee.feeRecipients]],
        [[Fee.feeProportions]],
        { from: accounts[6] },
      ),
      'Sender must be the maintainer',
    );
  });
});

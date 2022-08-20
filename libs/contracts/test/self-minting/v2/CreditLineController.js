const {
  ZERO_ADDRESS,
  RegistryRolesEnum,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeCreditLineDerivative,
} = require('@jarvis-network/hardhat-utils/dist/deployment/encoding');
const { assert } = require('chai');
const SynthereumManager = artifacts.require('SynthereumManager');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SynthereumCollateralWhitelist = artifacts.require(
  'SynthereumCollateralWhitelist',
);
const SelfMintingRegistry = artifacts.require('SelfMintingRegistry');
const SynthereumIdentifierWhitelist = artifacts.require(
  'SynthereumIdentifierWhitelist',
);
const CreditLineController = artifacts.require('CreditLineController');
const SyntheticToken = artifacts.require(
  'MintableBurnableSyntheticTokenPermit',
);
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const CreditLine = artifacts.require('CreditLine');
const CreditLineLib = artifacts.require('CreditLineLib');
const MockAggregator = artifacts.require('MockAggregator');
const SynthereumChainlinkPriceFeed = artifacts.require(
  'SynthereumChainlinkPriceFeed',
);
const { toWei, toBN, stringToHex, utf8ToHex, hexToUtf8 } = web3Utils;

contract('Self-minting controller', function (accounts) {
  let version = 2;

  // Derivative params
  let collateral, tokenCurrency, creditLine, creditLineLib;
  const priceFeedIdentifier = 'EURUSD';
  const syntheticName = 'Jarvis Euro Token';
  const syntheticSymbol = 'jEUR';
  let feePercentage = 0.002;
  let collateralRequirement = toWei('1.2');
  let liquidationRewardPct = toWei('0.2');

  let feeRecipient = accounts[7];
  let Fee = {
    feePercentage,
    feeRecipients: [feeRecipient],
    feeProportions: [1],
  };
  let capMintAmount = toWei('100');
  const minSponsorTokens = toWei('5');
  let excessBeneficiary = accounts[4];
  let derivativeAdmins;
  let derivativePools;

  //Pool params
  let derivativeAddress = ZERO_ADDRESS;
  let synthereumFinderAddress;
  let poolVersion = 2;
  let admin = accounts[0];
  let maintainer = accounts[1];

  //Other params
  let creditLineAddress;
  let creditLineControllerInstance;
  let synthereumFinderInstance;
  let minterRole;
  let burnerRole;

  before(async () => {
    // set roles
    roles = {
      admin,
      maintainer,
    };

    // deploy and link library
    creditLineLib = await CreditLineLib.deployed();
    await CreditLine.link(creditLineLib);

    // Represents WETH or some other token that the sponsor and contracts don't control.
    collateral = await TestnetSelfMintingERC20.new('Test Token', 'USDC', 6);

    tokenCurrency = await SyntheticToken.new(
      syntheticName,
      syntheticSymbol,
      18,
      {
        from: maintainer,
      },
    );

    deployerInstance = await SynthereumDeployer.deployed();
    synthereumFinderInstance = await SynthereumFinder.deployed();
    synthereumFinderAddress = synthereumFinderInstance.address;
    synthereumManagerInstance = await SynthereumManager.deployed();

    synthereumCollateralWhitelistInstance = await SynthereumCollateralWhitelist.deployed();
    await synthereumCollateralWhitelistInstance.addToWhitelist(
      collateral.address,
      { from: maintainer },
    );

    synthereumIdWhitelist = await SynthereumIdentifierWhitelist.deployed();
    await synthereumIdWhitelist.addToWhitelist(utf8ToHex(priceFeedIdentifier), {
      from: maintainer,
    });

    mockAggregator = await MockAggregator.new(8, 140000000);
    synthereumChainlinkPriceFeed = await SynthereumChainlinkPriceFeed.deployed();
    await synthereumChainlinkPriceFeed.setPair(
      0,
      utf8ToHex(priceFeedIdentifier),
      mockAggregator.address,
      [],
      { from: roles.maintainer },
    );

    await tokenCurrency.grantRole(
      ZERO_ADDRESS,
      synthereumManagerInstance.address,
      { from: maintainer },
    );

    selfMintingPayload = encodeCreditLineDerivative(
      collateral.address,
      priceFeedIdentifier,
      syntheticName,
      syntheticSymbol,
      tokenCurrency.address,
      collateralRequirement,
      minSponsorTokens,
      excessBeneficiary,
      version,
      Fee,
      liquidationRewardPct,
      capMintAmount,
    );

    creditLineAddress = await deployerInstance.deploySelfMintingDerivative.call(
      version,
      selfMintingPayload,
      { from: roles.maintainer },
    );
    await deployerInstance.deploySelfMintingDerivative(
      version,
      selfMintingPayload,
      { from: roles.maintainer },
    );
    creditLine = await CreditLine.at(creditLineAddress);
    creditLineControllerInstance = await CreditLineController.deployed();
    minterRole = web3Utils.soliditySha3('Minter');
    burnerRole = web3Utils.soliditySha3('Burner');
  });

  context('CreditLineController', async () => {
    let liquidationRewardPct = toWei('0.2');

    describe('Cap mint amount', () => {
      it('Set cap mint amount', async () => {
        let capMint = await creditLineControllerInstance.getCapMintAmount.call(
          creditLine.address,
        );
        assert.equal(capMint, capMintAmount, 'Wrong initial cap mint amount');
        const newCapMintAmount = toWei('1000');
        const updateTx = await creditLineControllerInstance.setCapMintAmount(
          [creditLine.address],
          [newCapMintAmount],
          { from: maintainer },
        );
        capMint = await creditLineControllerInstance.getCapMintAmount.call(
          creditLine.address,
        );
        assert.equal(
          capMint,
          newCapMintAmount,
          'Wrong cap mint amount after update',
        );
        truffleAssert.eventEmitted(updateTx, 'SetCapMintAmount', ev => {
          return (
            ev.selfMintingDerivative == creditLine.address &&
            ev.capMintAmount == capMint.toString()
          );
        });
        await creditLineControllerInstance.setCapMintAmount(
          [creditLine.address],
          [capMintAmount],
          { from: maintainer },
        );
      });
      it('Revert if no self-minting derivatives are passed', async () => {
        await truffleAssert.reverts(
          creditLineControllerInstance.setCapMintAmount([], [], {
            from: maintainer,
          }),
          'No self-minting derivatives passed',
        );
      });
      it('Revert if different number of self-minting derivatives and mint amounts', async () => {
        const newCapMintAmount = toWei('1000');
        await truffleAssert.reverts(
          creditLineControllerInstance.setCapMintAmount(
            [creditLine.address, accounts[7]],
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
          creditLineControllerInstance.setCapMintAmount(
            [creditLine.address],
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
        let collReq = await creditLineControllerInstance.getCollateralRequirement.call(
          creditLine.address,
        );
        assert.equal(
          collReq,
          collateralRequirement,
          'Wrong initial collateral req',
        );
        const newCollReq = toWei('1.3');
        const updateTx = await creditLineControllerInstance.setCollateralRequirement(
          [creditLine.address],
          [newCollReq],
          { from: maintainer },
        );
        collReq = await creditLineControllerInstance.getCollateralRequirement.call(
          creditLine.address,
        );
        assert.equal(collReq, newCollReq, 'Wrong coll req after updte');
        truffleAssert.eventEmitted(updateTx, 'SetCollateralRequirement', ev => {
          return (
            ev.selfMintingDerivative == creditLine.address &&
            ev.collateralRequirement == collReq.toString()
          );
        });
      });
      it('Revert if no self-minting derivatives are passed', async () => {
        await truffleAssert.reverts(
          creditLineControllerInstance.setCollateralRequirement([], [], {
            from: maintainer,
          }),
          'No self-minting derivatives passed',
        );
      });
      it('Revert if different number of self-minting derivatives and collateral requirements', async () => {
        const newCollReq = toWei('1000');
        await truffleAssert.reverts(
          creditLineControllerInstance.setCollateralRequirement(
            [creditLine.address, accounts[7]],
            [newCollReq],
            {
              from: maintainer,
            },
          ),
          'Number of derivatives and overcollaterals must be the same',
        );
      });
      it('Revert if try to set the same collateral requirement as existing', async () => {
        const newCollReq = toWei('1.3');
        await truffleAssert.reverts(
          creditLineControllerInstance.setCollateralRequirement(
            [creditLine.address],
            [newCollReq],
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
        let liqRew = await creditLineControllerInstance.getLiquidationRewardPercentage.call(
          creditLine.address,
        );
        assert.equal(
          liqRew,
          liquidationRewardPct,
          'Wrong initial collateral req',
        );
        const newLiqRew = toWei('0.3');
        const updateTx = await creditLineControllerInstance.setLiquidationRewardPercentage(
          [creditLine.address],
          [newLiqRew],
          { from: maintainer },
        );
        liqRew = await creditLineControllerInstance.getLiquidationRewardPercentage.call(
          creditLine.address,
        );
        assert.equal(liqRew, newLiqRew, 'Wrong liq rew after updte');
        truffleAssert.eventEmitted(updateTx, 'SetLiquidationReward', ev => {
          return (
            ev.selfMintingDerivative == creditLine.address &&
            ev.liquidationReward == newLiqRew.toString()
          );
        });
      });
      it('Revert if no self-minting derivatives are passed', async () => {
        await truffleAssert.reverts(
          creditLineControllerInstance.setLiquidationRewardPercentage([], [], {
            from: maintainer,
          }),
          'No self-minting derivatives passed',
        );
      });
      it('Revert if different number of self-minting derivatives and collateral requirements', async () => {
        const newLiqRew = toWei('1.3');
        await truffleAssert.reverts(
          creditLineControllerInstance.setLiquidationRewardPercentage(
            [creditLine.address, accounts[7]],
            [newLiqRew],
            {
              from: maintainer,
            },
          ),
          'Mismatch between derivatives to update and liquidation rewards',
        );
      });
      it('Revert if try to set the same collateral requirement as existing', async () => {
        const newLiqRew = toWei('0.3');
        await truffleAssert.reverts(
          creditLineControllerInstance.setLiquidationRewardPercentage(
            [creditLine.address],
            [newLiqRew],
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
        let feeInfo = await creditLineControllerInstance.getFeeInfo.call(
          creditLine.address,
        );
        assert.equal(
          feeInfo.feePercentage,
          toWei(feePercentage.toString()),
          'Wrong initial fee percentage',
        );
        assert.equal(
          (
            await creditLineControllerInstance.feePercentage.call(
              creditLine.address,
            )
          ).toString(),
          toWei(feePercentage.toString()),
          'Wrong initial fee percentage',
        );
        const newFeePerc = toWei('0.3');
        const updateTx = await creditLineControllerInstance.setFeePercentage(
          [creditLine.address],
          [newFeePerc],
          { from: maintainer },
        );
        feeInfo = await creditLineControllerInstance.getFeeInfo.call(
          creditLine.address,
        );
        assert.equal(
          feeInfo.feePercentage,
          newFeePerc,
          'Wrong fee percentage after updte',
        );
        truffleAssert.eventEmitted(updateTx, 'SetFeePercentage', ev => {
          return (
            ev.selfMintingDerivative == creditLine.address &&
            ev.feePercentage == newFeePerc.toString()
          );
        });
      });
      it('Revert if no self-minting derivatives are passed', async () => {
        await truffleAssert.reverts(
          creditLineControllerInstance.setFeePercentage([], [], {
            from: maintainer,
          }),
          'No self-minting derivatives passed',
        );
      });
      it('Revert if different number of self-minting derivatives and fee percentages', async () => {
        const newFeePerc = toWei('1.3');
        await truffleAssert.reverts(
          creditLineControllerInstance.setFeePercentage(
            [creditLine.address, accounts[7]],
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
          creditLineControllerInstance.setFeePercentage(
            [creditLine.address],
            [toWei('110')],
            {
              from: maintainer,
            },
          ),
          'Fee percentage must be less than 100%',
        );
      });
      it('Revert if try to set the same fee percentage as existing', async () => {
        const newFeePerc = toWei('0.3');
        await truffleAssert.reverts(
          creditLineControllerInstance.setFeePercentage(
            [creditLine.address],
            [newFeePerc],
            {
              from: maintainer,
            },
          ),
          'Fee percentage is the same',
        );
      });
      it('Set fee recipients', async () => {
        let feeInfo = await creditLineControllerInstance.getFeeInfo.call(
          creditLine.address,
        );
        assert.equal(
          feeInfo.feeProportions,
          Fee.feeProportions.toString(),
          'Wrong initial fee proportions',
        );
        assert.equal(
          feeInfo.feeRecipients[0],
          Fee.feeRecipients[0],
          'Wrong initial fee recipients',
        );

        const expectedRec = await creditLineControllerInstance.feeRecipientsInfo(
          creditLine.address,
        );
        assert.equal(Fee.feeRecipients[0], expectedRec[0][0].toString());
        assert.equal(
          Fee.feeProportions[0].toString(),
          expectedRec[1][0].toString(),
        );

        const newFeeRecipients = {
          recipients: [accounts[5]],
          proportions: [1],
        };
        const updateTx = await creditLineControllerInstance.setFeeRecipients(
          [creditLine.address],
          [newFeeRecipients.recipients],
          [newFeeRecipients.proportions],
          { from: maintainer },
        );
        feeInfo = await creditLineControllerInstance.getFeeInfo.call(
          creditLine.address,
        );
        assert.equal(
          feeInfo.feeProportions[0],
          newFeeRecipients.proportions[0].toString(),
          'Wrong fee proportions after update',
        );
        assert.equal(
          feeInfo.feeRecipients[0],
          newFeeRecipients.recipients[0],
          'Wrong fee recipients after update',
        );

        truffleAssert.eventEmitted(updateTx, 'SetFeeRecipients', ev => {
          return (
            ev.selfMintingDerivative == creditLine.address &&
            ev.feeRecipient == newFeeRecipients.recipients[0] &&
            ev.feeProportions == newFeeRecipients.proportions[0].toString()
          );
        });
      });
      it('Revert if no self-minting derivatives are passed', async () => {
        await truffleAssert.reverts(
          creditLineControllerInstance.setFeeRecipients([], [[]], [[]], {
            from: maintainer,
          }),
          'No self-minting derivatives passed',
        );
      });
      it('Revert if different number of self-minting derivatives and fee recipients', async () => {
        const newFeeRecipients = {
          recipients: [accounts[5]],
          proportions: [1],
        };

        await truffleAssert.reverts(
          creditLineControllerInstance.setFeeRecipients(
            [creditLine.address, accounts[7]],
            [[]],
            [[]],
            { from: maintainer },
          ),
          'Mismatch between derivatives to update and fee recipients',
        );
        await truffleAssert.reverts(
          creditLineControllerInstance.setFeeRecipients(
            [creditLine.address, accounts[7]],
            [newFeeRecipients.recipients, newFeeRecipients.recipients],
            [[]],
            { from: maintainer },
          ),
          'Mismatch between derivatives to update and fee proportions',
        );
      });
      it('Revert if sender is not maintainer', async () => {
        const newWrongValue = toWei('0.11');

        await truffleAssert.reverts(
          creditLineControllerInstance.setCapMintAmount(
            [creditLine.address],
            [newWrongValue],
            { from: accounts[6] },
          ),
          'Sender must be the maintainer or a self-minting factory',
        );
        await truffleAssert.reverts(
          creditLineControllerInstance.setFeePercentage(
            [creditLine.address],
            [newWrongValue],
            { from: accounts[6] },
          ),
          'Sender must be the maintainer or a self-minting factory',
        );
        await truffleAssert.reverts(
          creditLineControllerInstance.setCollateralRequirement(
            [creditLine.address],
            [newWrongValue],
            { from: accounts[6] },
          ),
          'Sender must be the maintainer or a self-minting factory',
        );
        await truffleAssert.reverts(
          creditLineControllerInstance.setLiquidationRewardPercentage(
            [creditLine.address],
            [newWrongValue],
            { from: accounts[6] },
          ),
          'Sender must be the maintainer or a self-minting factory',
        );

        await truffleAssert.reverts(
          creditLineControllerInstance.setFeeRecipients(
            [creditLine.address],
            [Fee.feeRecipients],
            [Fee.feeProportions],
            { from: accounts[6] },
          ),
          'Sender must be the maintainer or a self-minting factory',
        );
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
        const notRegistredDerivative = creditLine.address;
        const synthTokenAddress = await creditLine.syntheticToken.call();
        await synthereumManagerInstance.revokeSynthereumRole(
          [synthTokenAddress, synthTokenAddress],
          [minterRole, burnerRole],
          [notRegistredDerivative, notRegistredDerivative],
          { from: maintainer },
        );
        await deployerInstance.removeSelfMintingDerivative(
          notRegistredDerivative,
          { from: maintainer },
        );
        await truffleAssert.reverts(
          creditLineControllerInstance.setCapMintAmount(
            [notRegistredDerivative],
            [capMintAmount],
            { from: maintainer },
          ),
          'Self-minting derivative not registred',
        );
        await truffleAssert.reverts(
          creditLineControllerInstance.setFeePercentage(
            [notRegistredDerivative],
            [toWei('50')],
            {
              from: maintainer,
            },
          ),
          'Self-minting derivative not registred',
        );
        await truffleAssert.reverts(
          creditLineControllerInstance.setCollateralRequirement(
            [notRegistredDerivative],
            [collateralRequirement],
            { from: maintainer },
          ),
          'Self-minting derivative not registred',
        );
        await truffleAssert.reverts(
          creditLineControllerInstance.setLiquidationRewardPercentage(
            [notRegistredDerivative],
            [liquidationRewardPct],
            { from: maintainer },
          ),
          'Self-minting derivative not registred',
        );

        await truffleAssert.reverts(
          creditLineControllerInstance.setFeeRecipients(
            [notRegistredDerivative],
            [Fee.feeRecipients],
            [Fee.feeProportions],
            { from: maintainer },
          ),
          'Self-minting derivative not registred',
        );
        const selfMintingRegistry = await SelfMintingRegistry.deployed();
        await synthereumFinderInstance.changeImplementationAddress(
          web3Utils.stringToHex('SelfMintingRegistry'),
          selfMintingRegistry.address,
          { from: maintainer },
        );
      });
    });
  });
});

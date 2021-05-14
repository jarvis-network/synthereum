const {
  ZERO_ADDRESS,
  RegistryRolesEnum,
} = require('@jarvis-network/uma-common');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const {
  encodeDerivative,
  encodePoolOnChainPriceFeed,
  encodeSelfMintingDerivative,
} = require('../../utils/encoding.js');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumDeployer = artifacts.require('SynthereumDeployer');
const SelfMintingController = artifacts.require('SelfMintingController');
const TestnetERC20 = artifacts.require('TestnetERC20');
const TestnetSelfMintingERC20 = artifacts.require('TestnetSelfMintingERC20');
const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');
const MintableBurnableSyntheticToken = artifacts.require(
  'MintableBurnableSyntheticToken',
);
const SelfMintingRegistry = artifacts.require('SelfMintingRegistry');
const { toWei, toBN, stringToHex } = web3Utils;

contract('Self-minting controller', function (accounts) {
  let derivativeVersion = 2;

  // Derivative params
  let collateralAddress;
  let priceFeedIdentifier = 'EUR/USD';
  let syntheticName = 'Jarvis Synthetic Euro';
  let syntheticSymbol = 'jEUR';
  let syntheticTokenAddress = ZERO_ADDRESS;
  let collateralRequirement = web3Utils.toWei('1.1');
  let disputeBondPct = web3Utils.toWei('1.5');
  let sponsorDisputeRewardPct = web3Utils.toWei('0.5');
  let disputerDisputeRewardPct = web3Utils.toWei('0.4');
  let minSponsorTokens = web3Utils.toWei('1');
  let withdrawalLiveness = 3600;
  let liquidationLiveness = 3600;
  let excessBeneficiary = accounts[4];
  let derivativeAdmins;
  let derivativePools;

  //Pool params
  let derivativeAddress = ZERO_ADDRESS;
  let synthereumFinderAddress;
  let poolVersion;
  let admin = accounts[0];
  let maintainer = accounts[1];
  let liquidityProvider = accounts[2];
  let validator = accounts[3];
  let roles = {
    admin,
    maintainer,
    liquidityProvider,
    validator,
  };
  let isContractAllowed = false;
  let startingCollateralization = '1586700';
  let feePercentage = 0.02;
  let DAO = accounts[5];
  let feeRecipients = [liquidityProvider, DAO];
  let feeProportions = [50, 50];
  let fee = {
    feePercentage,
    feeRecipients,
    feeProportions,
  };
  let feeRecipient = DAO;
  let daoFee = {
    feePercentage,
    feeRecipient,
  };
  let secondFeeRecipient = accounts[8];
  let capMintAmount = web3Utils.toWei('1000000');
  let capDepositRatio = 700;
  //Other params
  let firstWrongAddress = accounts[6];
  let sender = accounts[7];
  let derivativePayload;
  let poolPayload;
  let synthTokenAddress;
  let selfMintingDerivativeVersion;
  let selfMintingCollateralAddress;
  let selfMintingPriceFeedIdentifier;
  let selfMintingPayload;
  let selfMintingDerivativeAddr;
  let controllerInstance;
  let synthereumFinderInstance;
  let derivativeAddr;

  beforeEach(async () => {
    collateralAddress = (await TestnetERC20.deployed()).address;
    deployerInstance = await SynthereumDeployer.deployed();
    derivativeAdmins = [deployerInstance.address];
    derivativePools = [];
    poolVersion = 3;
    synthereumFinderInstance = await SynthereumFinder.deployed();
    synthereumFinderAddress = synthereumFinderInstance.address;
    controllerInstance = await SelfMintingController.deployed();
    selfMintingControllerInstanceAddr = (await SelfMintingController.deployed())
      .address;
    derivativePayload = encodeDerivative(
      collateralAddress,
      priceFeedIdentifier,
      syntheticName,
      syntheticSymbol,
      syntheticTokenAddress,
      collateralRequirement,
      disputeBondPct,
      sponsorDisputeRewardPct,
      disputerDisputeRewardPct,
      minSponsorTokens,
      withdrawalLiveness,
      liquidationLiveness,
      excessBeneficiary,
      derivativeAdmins,
      derivativePools,
    );
    poolPayload = encodePoolOnChainPriceFeed(
      derivativeAddress,
      synthereumFinderAddress,
      poolVersion,
      roles,
      isContractAllowed,
      startingCollateralization,
      fee,
    );
    const {
      derivative,
      pool,
    } = await deployerInstance.deployPoolAndDerivative.call(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    await deployerInstance.deployPoolAndDerivative(
      derivativeVersion,
      poolVersion,
      derivativePayload,
      poolPayload,
      { from: maintainer },
    );
    derivativeAddr = derivative;
    const poolParty = await PerpetualPoolParty.at(derivative);
    synthTokenAddress = await poolParty.tokenCurrency.call();
    selfMintingDerivativeVersion = 1;
    selfMintingCollateralAddress = (await TestnetSelfMintingERC20.deployed())
      .address;
    selfMintingPriceFeedIdentifier = 'EUR/JRT';
    selfMintingPayload = encodeSelfMintingDerivative(
      selfMintingCollateralAddress,
      selfMintingPriceFeedIdentifier,
      syntheticName,
      syntheticSymbol,
      synthTokenAddress,
      collateralRequirement,
      disputeBondPct,
      sponsorDisputeRewardPct,
      disputerDisputeRewardPct,
      minSponsorTokens,
      withdrawalLiveness,
      liquidationLiveness,
      excessBeneficiary,
      selfMintingDerivativeVersion,
      daoFee,
      capMintAmount,
      capDepositRatio,
    );
    selfMintingDerivativeAddr = await deployerInstance.deployOnlySelfMintingDerivative.call(
      selfMintingDerivativeVersion,
      selfMintingPayload,
      { from: maintainer },
    );
    await deployerInstance.deployOnlySelfMintingDerivative(
      selfMintingDerivativeVersion,
      selfMintingPayload,
      { from: maintainer },
    );
  });

  describe('Cap mint amount', () => {
    it('Set cap mint amount', async () => {
      let capMint = await controllerInstance.getCapMintAmount.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(capMint, capMintAmount, 'Wrong initial cap mint amount');
      const newCapMintAmount = toWei('1000');
      const updateTx = await controllerInstance.setCapMintAmount(
        [selfMintingDerivativeAddr],
        [newCapMintAmount],
        { from: maintainer },
      );
      capMint = await controllerInstance.getCapMintAmount.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(
        capMint,
        newCapMintAmount,
        'Wrong cap mint amount after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetCapMintAmount', ev => {
        return (
          ev.selfMintingDerivative == selfMintingDerivativeAddr &&
          ev.capMintAmount == capMint.toString()
        );
      });
      await controllerInstance.setCapMintAmount(
        [selfMintingDerivativeAddr],
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
          [selfMintingDerivativeAddr, firstWrongAddress],
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
          [selfMintingDerivativeAddr],
          [capMintAmount],
          {
            from: maintainer,
          },
        ),
        'Cap mint amount is the same',
      );
    });
  });

  describe('Cap deposit ratio', () => {
    it('Set cap deposit ratio', async () => {
      let capDeposit = await controllerInstance.getCapDepositRatio.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(
        capDeposit.toString(),
        toBN(toWei(capDepositRatio.toString())).toString(),
        'Wrong initial cap deposit ratio',
      );
      const newCapDepositRatio = toWei('10');
      const updateTx = await controllerInstance.setCapDepositRatio(
        [selfMintingDerivativeAddr],
        [newCapDepositRatio],
        { from: maintainer },
      );
      capDeposit = await controllerInstance.getCapDepositRatio.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(
        capDeposit.toString(),
        newCapDepositRatio,
        'Wrong cap deposit ratio after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetCapDepositRatio', ev => {
        return (
          ev.selfMintingDerivative == selfMintingDerivativeAddr &&
          ev.capDepositRatio == capDeposit.toString()
        );
      });
      await controllerInstance.setCapDepositRatio(
        [selfMintingDerivativeAddr],
        [toWei(capDepositRatio.toString())],
        { from: maintainer },
      );
    });
    it('Revert if no self-minting derivatives are passed', async () => {
      await truffleAssert.reverts(
        controllerInstance.setCapDepositRatio([], [], {
          from: maintainer,
        }),
        'No self-minting derivatives passed',
      );
    });
    it('Revert if different number of self-minting derivatives and deposit ratios', async () => {
      const newCapDepositRatio = toWei('10');
      await truffleAssert.reverts(
        controllerInstance.setCapDepositRatio(
          [selfMintingDerivativeAddr, firstWrongAddress],
          [newCapDepositRatio],
          {
            from: maintainer,
          },
        ),
        'Number of derivatives and deposit cap ratios must be the same',
      );
    });
    it('Revert if try to set the same cap deposit ratio', async () => {
      await truffleAssert.reverts(
        controllerInstance.setCapDepositRatio(
          [selfMintingDerivativeAddr],
          [toWei(capDepositRatio.toString())],
          {
            from: maintainer,
          },
        ),
        'Cap deposit ratio is the same',
      );
    });
  });

  describe('Dao fee', () => {
    it('Set Dao fee', async () => {
      let daoFee = await controllerInstance.getDaoFee.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(
        daoFee.feePercentage.toString(),
        toWei(feePercentage.toString()).toString(),
        'Wrong initial Dao fee percentage',
      );
      assert.equal(
        daoFee.feeRecipient,
        feeRecipient,
        'Wrong initial Dao fee recipeint',
      );
      const newDaoFee = {
        feePercentage: toWei('0.005').toString(),
        feeRecipient: secondFeeRecipient,
      };
      const updateTx = await controllerInstance.setDaoFee(
        [selfMintingDerivativeAddr],
        [newDaoFee],
        { from: maintainer },
      );
      daoFee = await controllerInstance.getDaoFee.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(
        daoFee.feePercentage.toString(),
        newDaoFee.feePercentage.toString(),
        'Wrong Dao fee percentage after update',
      );
      assert.equal(
        daoFee.feeRecipient,
        newDaoFee.feeRecipient,
        'Wrong Dao fee recipeint after update',
      );

      truffleAssert.eventEmitted(updateTx, 'SetDaoFee', ev => {
        return (
          ev.selfMintingDerivative == selfMintingDerivativeAddr &&
          ev.daoFee.feeRecipient == newDaoFee.feeRecipient &&
          ev.daoFee.feePercentage == newDaoFee.feePercentage.toString()
        );
      });
      await controllerInstance.setDaoFee(
        [selfMintingDerivativeAddr],
        [
          {
            feePercentage: toWei(daoFee.feePercentage.toString()),
            feeRecipient: feeRecipient,
          },
        ],
        {
          from: maintainer,
        },
      );
    });
    it('Revert if no self-minting derivatives are passed', async () => {
      await truffleAssert.reverts(
        controllerInstance.setDaoFee([], [], {
          from: maintainer,
        }),
        'No self-minting derivatives passed',
      );
    });
    it('Revert if different number of self-minting derivatives and fees', async () => {
      const newDaoFee = {
        feePercentage: toWei('0.005').toString(),
        feeRecipient: secondFeeRecipient,
      };
      await truffleAssert.reverts(
        controllerInstance.setDaoFee(
          [selfMintingDerivativeAddr, firstWrongAddress],
          [newDaoFee],
          {
            from: maintainer,
          },
        ),
        'Number of derivatives and Dao fees must be the same',
      );
    });
    it('Revert if try to set the same Dao fee', async () => {
      await truffleAssert.reverts(
        controllerInstance.setDaoFee(
          [selfMintingDerivativeAddr],
          [
            {
              feePercentage: toWei(daoFee.feePercentage.toString()),
              feeRecipient: feeRecipient,
            },
          ],
          {
            from: maintainer,
          },
        ),
        'Dao fee is the same',
      );
    });
  });

  describe('Dao fee percentage', () => {
    it('Set Dao fee percentage', async () => {
      let daoFeePercentage = await controllerInstance.getDaoFeePercentage.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(
        daoFeePercentage,
        toWei(feePercentage.toString()).toString(),
        'Wrong initial Dao fee percentage',
      );
      const newDaoFeePercentage = toBN(toWei('0.01'));
      const updateTx = await controllerInstance.setDaoFeePercentage(
        [selfMintingDerivativeAddr],
        [newDaoFeePercentage],
        { from: maintainer },
      );
      daoFeePercentage = await controllerInstance.getDaoFeePercentage.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(
        daoFeePercentage.toString(),
        newDaoFeePercentage.toString(),
        'Wrong Dao fee percentage after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetDaoFeePercentage', ev => {
        return (
          ev.selfMintingDerivative == selfMintingDerivativeAddr &&
          ev.daoFeePercentage.toString() == daoFeePercentage.toString()
        );
      });
      await controllerInstance.setDaoFeePercentage(
        [selfMintingDerivativeAddr],
        [toWei(feePercentage.toString())],
        { from: maintainer },
      );
    });
    it('Revert if no self-minting derivatives are passed', async () => {
      await truffleAssert.reverts(
        controllerInstance.setDaoFeePercentage([], [], {
          from: maintainer,
        }),
        'No self-minting derivatives passed',
      );
    });
    it('Revert if different number of self-minting derivatives and fee percentages', async () => {
      const newDaoFeePercentage = toBN(toWei('0.01'));
      await truffleAssert.reverts(
        controllerInstance.setDaoFeePercentage(
          [selfMintingDerivativeAddr, firstWrongAddress],
          [newDaoFeePercentage],
          {
            from: maintainer,
          },
        ),
        'Number of derivatives and dao fee percentages must be the same',
      );
    });
    it('Revert if try to set the same Dao fee percentage', async () => {
      await truffleAssert.reverts(
        controllerInstance.setDaoFeePercentage(
          [selfMintingDerivativeAddr],
          [toWei(feePercentage.toString())],
          {
            from: maintainer,
          },
        ),
        'Dao fee percentage is the same',
      );
    });
  });

  describe('Dao fee recipient', () => {
    it('Set Dao fee recipient', async () => {
      let daoFeeRecipient = await controllerInstance.getDaoFeeRecipient.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(
        daoFeeRecipient,
        feeRecipient,
        'Wrong initial Dao fee recipient',
      );
      const updateTx = await controllerInstance.setDaoFeeRecipient(
        [selfMintingDerivativeAddr],
        [secondFeeRecipient],
        { from: maintainer },
      );
      daoFeeRecipient = await controllerInstance.getDaoFeeRecipient.call(
        selfMintingDerivativeAddr,
      );
      assert.equal(
        daoFeeRecipient,
        secondFeeRecipient,
        'Wrong Dao fee recipient after update',
      );
      truffleAssert.eventEmitted(updateTx, 'SetDaoFeeRecipient', ev => {
        return (
          ev.selfMintingDerivative == selfMintingDerivativeAddr &&
          ev.daoFeeRecipient == daoFeeRecipient
        );
      });
      await controllerInstance.setDaoFeeRecipient(
        [selfMintingDerivativeAddr],
        [feeRecipient],
        { from: maintainer },
      );
    });
    it('Revert if no self-minting derivatives are passed', async () => {
      await truffleAssert.reverts(
        controllerInstance.setDaoFeeRecipient([], [], {
          from: maintainer,
        }),
        'No self-minting derivatives passed',
      );
    });
    it('Revert if different number of self-minting derivatives and fee percentages', async () => {
      const newDaoFeePercentage = toBN(toWei('0.01'));
      await truffleAssert.reverts(
        controllerInstance.setDaoFeeRecipient(
          [selfMintingDerivativeAddr, firstWrongAddress],
          [feeRecipient],
          {
            from: maintainer,
          },
        ),
        'Number of derivatives and Dao fee recipients must be the same',
      );
    });
    it('Revert if try to set the same Dao fee recipient', async () => {
      await truffleAssert.reverts(
        controllerInstance.setDaoFeeRecipient(
          [selfMintingDerivativeAddr],
          [feeRecipient],
          {
            from: maintainer,
          },
        ),
        'Dao fee recipient is the same',
      );
    });
  });

  it('Revert if self-minting derivative is not registred', async () => {
    const selfMintingRegistryAddr = (await SelfMintingRegistry.deployed())
      .address;
    const newSelfMintingRegistry = await SelfMintingRegistry.new(
      synthereumFinderAddress,
    );
    await synthereumFinderInstance.changeImplementationAddress(
      web3Utils.stringToHex('SelfMintingRegistry'),
      newSelfMintingRegistry.address,
      { from: maintainer },
    );
    const notRegistredDerivative = selfMintingDerivativeAddr;
    await truffleAssert.reverts(
      controllerInstance.setDaoFee(
        [notRegistredDerivative],
        [
          {
            feePercentage: toWei(daoFee.feePercentage.toString()),
            feeRecipient: feeRecipient,
          },
        ],
        {
          from: maintainer,
        },
      ),
      'Self-minting derivative not registred',
    );
    await truffleAssert.reverts(
      controllerInstance.setCapMintAmount(
        [notRegistredDerivative],
        [capMintAmount],
        {
          from: maintainer,
        },
      ),
      'Self-minting derivative not registred',
    );
    await truffleAssert.reverts(
      controllerInstance.setCapDepositRatio(
        [notRegistredDerivative],
        [capDepositRatio],
        {
          from: maintainer,
        },
      ),
      'Self-minting derivative not registred',
    );
    await truffleAssert.reverts(
      controllerInstance.setDaoFeePercentage(
        [notRegistredDerivative],
        [toWei(feePercentage.toString())],
        {
          from: maintainer,
        },
      ),
      'Self-minting derivative not registred',
    );
    truffleAssert.reverts(
      controllerInstance.setDaoFeeRecipient(
        [notRegistredDerivative],
        [feeRecipient],
        {
          from: maintainer,
        },
      ),
      'Self-minting derivative not registred',
    );
    await synthereumFinderInstance.changeImplementationAddress(
      web3Utils.stringToHex('SelfMintingRegistry'),
      selfMintingRegistryAddr,
      { from: maintainer },
    );
  });

  it('Revert if sender is not the maintainer', async () => {
    await truffleAssert.reverts(
      controllerInstance.setDaoFee(
        [selfMintingDerivativeAddr],
        [
          {
            feePercentage: toWei(daoFee.feePercentage.toString()),
            feeRecipient: feeRecipient,
          },
        ],
        {
          from: sender,
        },
      ),
      'Sender must be the maintainer or a self-minting factory',
    );
    await truffleAssert.reverts(
      controllerInstance.setCapMintAmount(
        [selfMintingDerivativeAddr],
        [capMintAmount],
        {
          from: sender,
        },
      ),
      'Sender must be the maintainer or a self-minting factory',
    );
    await truffleAssert.reverts(
      controllerInstance.setCapDepositRatio(
        [selfMintingDerivativeAddr],
        [capDepositRatio],
        {
          from: sender,
        },
      ),
      'Sender must be the maintainer or a self-minting factory',
    );
    await truffleAssert.reverts(
      controllerInstance.setDaoFeePercentage(
        [selfMintingDerivativeAddr],
        [toWei(feePercentage.toString())],
        {
          from: sender,
        },
      ),
      'Sender must be the maintainer',
    );
    await truffleAssert.reverts(
      controllerInstance.setDaoFeeRecipient(
        [selfMintingDerivativeAddr],
        [feeRecipient],
        {
          from: sender,
        },
      ),
      'Sender must be the maintainer',
    );
  });
});

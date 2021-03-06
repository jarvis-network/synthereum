const { toWei } = web3.utils;

// Tested Contract
const PerpetualPoolParty = artifacts.require('PerpetualPoolParty');

// Helper Contracts
const Finder = artifacts.require('Finder');
const IdentifierWhitelist = artifacts.require('IdentifierWhitelist');
const AddressWhitelist = artifacts.require('AddressWhitelist');
const Token = artifacts.require('MintableBurnableSyntheticToken');
const Timer = artifacts.require('Timer');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const FeePayerPartyLib = artifacts.require('FeePayerPartyLib');
const PerpetualPositionManagerPoolPartyLib = artifacts.require(
  'PerpetualPositionManagerPoolPartyLib',
);
const PerpetualLiquidatablePoolPartyLib = artifacts.require(
  'PerpetualLiquidatablePoolPartyLib',
);

contract('PerpetualPoolParty', function (accounts) {
  let finder, timer, synthereumFinder, collateralWithelist;
  let maintainer = accounts[1];

  beforeEach(async () => {
    timer = await Timer.deployed();
    finder = await Finder.deployed();
    synthereumFinder = await SynthereumFinder.deployed();
  });

  it('Can deploy', async function () {
    const collateralToken = await Token.new('UMA', 'UMA', 18, {
      from: accounts[0],
    });
    const syntheticToken = await Token.new('SYNTH', 'SYNTH', 18, {
      from: accounts[0],
    });

    collateralWithelist = await AddressWhitelist.deployed();
    await collateralWithelist.addToWhitelist(collateralToken.address);

    const positionManagerParams = {
      withdrawalLiveness: '1000',
      collateralAddress: collateralToken.address,
      tokenAddress: syntheticToken.address,
      finderAddress: finder.address,
      priceFeedIdentifier: web3.utils.padRight(
        web3.utils.utf8ToHex('UMATEST'),
        64,
      ),
      minSponsorTokens: { rawValue: toWei('1') },
      timerAddress: timer.address,
      excessTokenBeneficiary: accounts[0],
      synthereumFinder: synthereumFinder.address,
    };

    const roles = {
      admins: [accounts[1]],
      pools: [accounts[1]],
    };

    const liquidatableParams = {
      liquidationLiveness: '1000',
      collateralRequirement: { rawValue: toWei('1.5') },
      disputeBondPct: { rawValue: toWei('0.1') },
      sponsorDisputeRewardPct: { rawValue: toWei('0.1') },
      disputerDisputeRewardPct: { rawValue: toWei('0.1') },
    };

    const constructorParams = {
      positionManagerParams,
      roles,
      liquidatableParams,
    };

    const identifierWhitelist = await IdentifierWhitelist.deployed();
    await identifierWhitelist.addSupportedIdentifier(
      constructorParams.positionManagerParams.priceFeedIdentifier,
      {
        from: accounts[0],
      },
    );
    const feePayerPartyLib = await FeePayerPartyLib.deployed();
    const perpetualPositionManagerPoolPartyLib = await PerpetualPositionManagerPoolPartyLib.deployed();
    const perpetualLiquidatablePoolPartyLib = await PerpetualLiquidatablePoolPartyLib.deployed();
    if (
      FeePayerPartyLib.setAsDeployed ||
      PerpetualPositionManagerPoolPartyLib.setAsDeployed ||
      PerpetualLiquidatablePoolPartyLib.setAsDeployed
    ) {
      try {
        await PerpetualPoolParty.link(feePayerPartyLib);
        await PerpetualPoolParty.link(perpetualPositionManagerPoolPartyLib);
        await PerpetualPoolParty.link(perpetualLiquidatablePoolPartyLib);
      } catch (e) {
        // Allow this to fail in the Buidler case.
      }
    } else {
      // Truffle
      await PerpetualPoolParty.link(FeePayerPartyLib, feePayerPartyLib.address);
      await PerpetualPoolParty.link(
        PerpetualPositionManagerPoolPartyLib,
        perpetualPositionManagerPoolPartyLib.address,
      );
      await PerpetualPoolParty.link(
        PerpetualLiquidatablePoolPartyLib,
        perpetualLiquidatablePoolPartyLib.address,
      );
    }
    await PerpetualPoolParty.new(constructorParams);
  });
});

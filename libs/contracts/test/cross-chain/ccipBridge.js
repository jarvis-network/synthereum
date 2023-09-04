const {
  ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toBN, toWei, toHex } = web3Utils;

const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const SynthereumCCIPBridge = artifacts.require('SynthereumCCIPBridge');
const MintableBurnableSyntheticTokenPermit = artifacts.require(
  'MintableBurnableSyntheticTokenPermit',
);
const MockRouter = artifacts.require('MockCCIPRouter');
const ERC20 = artifacts.require('ERC20');
const bridge = require('../../data/test/bridge.json');

contract('Synthereum ccip bridge', accounts => {
  let admin = accounts[0];
  let maintainer = accounts[1];
  let general = accounts[2];
  let srcEndpoint = accounts[3];
  let destEndpoint = accounts[4];
  let sender = accounts[5];
  let recipient = accounts[6];
  let finderInstance;
  let bridgeInstance;
  let networkId;
  let destChainSelector;
  let linkToken;
  let linkTokenStorage;
  let unsupportedToken;
  let unsupportedTokenStorage;

  const getTxGasFee = async receipt => {
    const gasUsed = receipt.gasUsed;
    const tx = await web3.eth.getTransaction(receipt.transactionHash);
    const gasPrice = tx.gasPrice;
    return toBN(gasUsed).mul(toBN(gasPrice));
  };

  const setTokenBalance = async (tokenAddr, user, balance, slotStorage) => {
    const slot = web3.utils.soliditySha3(
      web3.utils.hexToNumberString(user),
      slotStorage,
    );
    await network.provider.send('hardhat_setStorageAt', [
      tokenAddr,
      slot.replace('0x0', '0x'),
      web3.utils.padLeft(web3.utils.numberToHex(toBN(toWei(balance))), 64),
    ]);
  };

  before(async () => {
    networkId = await web3.eth.net.getId();
    finderInstance = await SynthereumFinder.deployed();
    bridgeInstance = await SynthereumCCIPBridge.deployed();
    destChainSelector = bridge[networkId].chainSelector;
    linkToken = await ERC20.at(bridge[networkId].linkToken.addr);
    linkTokenStorage = bridge[networkId].linkToken.slotBalanceStorage;
    unsupportedToken = await ERC20.at(bridge[networkId].unsupportedToken.addr);
    unsupportedTokenStorage =
      bridge[networkId].unsupportedToken.slotBalanceStorage;
  });

  describe('Should check initialization', async () => {
    it('Can check router is correct', async () => {
      const router = await bridgeInstance.getRouter.call();
      assert.notEqual(router, ZERO_ADDRESS, 'wrong router');
    });
    it('Can revert if null router passed ', async () => {
      await truffleAssert.reverts(
        SynthereumCCIPBridge.new(finderInstance.address, ZERO_ADDRESS, {
          admin: admin,
          maintainer: maintainer,
        }),
        'Invalid router',
      );
    });
  });

  describe('Should set and remove endpoints', async () => {
    it('Can set endpoints', async () => {
      const tx = await bridgeInstance.setEndpoints(
        destChainSelector,
        srcEndpoint,
        destEndpoint,
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'EndpointsSet', ev => {
        return (
          ev.chainSelector == destChainSelector &&
          ev.messageSender == srcEndpoint &&
          ev.messageReceiver == destEndpoint
        );
      });
      assert.equal(
        srcEndpoint,
        await bridgeInstance.getSrcEndpoint.call(destChainSelector),
        'wrong src endpoint',
      );
      assert.equal(
        destEndpoint,
        await bridgeInstance.getDestEndpoint.call(destChainSelector),
        'wrong dest endpoint',
      );
      assert.equal(
        true,
        await bridgeInstance.isEndpointSupported.call(destChainSelector),
        'wrong bool endpoint',
      );
    });
    it('Can revert if null endpoint passed ', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setEndpoints(
          destChainSelector,
          ZERO_ADDRESS,
          destEndpoint,
          {
            from: maintainer,
          },
        ),
        'Null input endpoint',
      );
      await truffleAssert.reverts(
        bridgeInstance.setEndpoints(
          destChainSelector,
          srcEndpoint,
          ZERO_ADDRESS,
          {
            from: maintainer,
          },
        ),
        'Null input endpoint',
      );
    });
    it('Can revert if chain selector not supported', async () => {
      const wrongChainSelector = '4009297550715157269';
      await truffleAssert.reverts(
        bridgeInstance.setEndpoints(
          wrongChainSelector,
          srcEndpoint,
          destEndpoint,
          {
            from: maintainer,
          },
        ),
        'Chain not supported',
      );
    });
    it('Can revert if sender that sets is not the maintainer', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setEndpoints(
          destChainSelector,
          srcEndpoint,
          destEndpoint,
          {
            from: accounts[6],
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can remove endpoints', async () => {
      const tx = await bridgeInstance.removeEndpoints(destChainSelector, {
        from: maintainer,
      });
      truffleAssert.eventEmitted(tx, 'EndpointsRemoved', ev => {
        return ev.chainSelector == destChainSelector;
      });
      await truffleAssert.reverts(
        bridgeInstance.getSrcEndpoint.call(destChainSelector),
        'Src endpoint not supported',
      );
      await truffleAssert.reverts(
        bridgeInstance.getDestEndpoint.call(destChainSelector),
        'Dest endpoint not supported',
      );
      assert.equal(
        false,
        await bridgeInstance.isEndpointSupported.call(destChainSelector),
        'wrong bool endpoint',
      );
    });
    it('Can revert if removing a not supported endpoint', async () => {
      const wrongChainSelector = '4009297550715157269';
      await truffleAssert.reverts(
        bridgeInstance.removeEndpoints(wrongChainSelector, {
          from: maintainer,
        }),
        'Endpoints not supported',
      );
    });
    it('Can revert if sender that removes is not the maintainer', async () => {
      await bridgeInstance.setEndpoints(
        destChainSelector,
        srcEndpoint,
        destEndpoint,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        bridgeInstance.removeEndpoints(destChainSelector, {
          from: accounts[6],
        }),
        'Sender must be the maintainer',
      );
      await bridgeInstance.removeEndpoints(destChainSelector, {
        from: maintainer,
      });
    });
  });

  describe('Should set and remove extra-args', async () => {
    const gasLimit = 300000;
    const strictMode = false;
    it('Can set extra-args', async () => {
      const tx = await bridgeInstance.setExtraArgs(
        destChainSelector,
        gasLimit,
        strictMode,
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'ExtraArgsSet', ev => {
        return (
          ev.chainSelector == destChainSelector &&
          ev.gasLimit == gasLimit &&
          ev.strict == strictMode
        );
      });
      const outputArgs = await bridgeInstance.getExtraArgs.call(
        destChainSelector,
      );
      const outputGasLimit = outputArgs.gasLimit;
      const outputStrict = outputArgs.strict;
      assert.equal(gasLimit, outputGasLimit, 'wrong output gas limit');
      assert.equal(strictMode, outputStrict, 'wrong output strict mode');
      assert.equal(
        true,
        await bridgeInstance.isExtraArgsSupported.call(destChainSelector),
        'wrong bool extra-args',
      );
    });
    it('Can revert if null args passed ', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setExtraArgs(destChainSelector, '0', strictMode, {
          from: maintainer,
        }),
        'Null gas input',
      );
    });
    it('Can revert if chain selector not supported', async () => {
      const wrongChainSelector = '4009297550715157269';
      await truffleAssert.reverts(
        bridgeInstance.setExtraArgs(wrongChainSelector, gasLimit, strictMode, {
          from: maintainer,
        }),
        'Chain not supported',
      );
    });
    it('Can revert if sender that sets is not the maintainer', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setExtraArgs(destChainSelector, gasLimit, strictMode, {
          from: accounts[6],
        }),
        'Sender must be the maintainer',
      );
    });
    it('Can remove extra-args', async () => {
      const tx = await bridgeInstance.removeExtraArgs(destChainSelector, {
        from: maintainer,
      });
      truffleAssert.eventEmitted(tx, 'ExtraArgsRemoved', ev => {
        return ev.chainSelector == destChainSelector;
      });
      await truffleAssert.reverts(
        bridgeInstance.getExtraArgs.call(destChainSelector),
        'Args not supported',
      );
      assert.equal(
        false,
        await bridgeInstance.isExtraArgsSupported.call(destChainSelector),
        'wrong bool extra-args',
      );
    });
    it('Can revert if removing a not supported extra-args', async () => {
      const wrongChainSelector = '4009297550715157269';
      await truffleAssert.reverts(
        bridgeInstance.removeExtraArgs(wrongChainSelector, {
          from: maintainer,
        }),
        'Args not supported',
      );
    });
    it('Can revert if sender that removes is not the maintainer', async () => {
      await bridgeInstance.setExtraArgs(
        destChainSelector,
        gasLimit,
        strictMode,
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        bridgeInstance.removeExtraArgs(destChainSelector, {
          from: accounts[6],
        }),
        'Sender must be the maintainer',
      );
      await bridgeInstance.removeExtraArgs(destChainSelector, {
        from: maintainer,
      });
    });
  });

  describe('Should set and remove tokens', async () => {
    const gasLimit = 300000;
    const strictMode = false;
    let srcToken = accounts[5];
    let destToken = accounts[6];
    let secondSrcToken = accounts[7];
    let secondDestToken = accounts[8];

    it('Can set tokens', async () => {
      const tx = await bridgeInstance.setMappedTokens(
        destChainSelector,
        [srcToken, secondSrcToken],
        [destToken, secondDestToken],
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'TokenMapped', ev => {
        return (
          ev.sourceToken == srcToken &&
          ev.chainSelector == destChainSelector &&
          ev.destinationToken == destToken
        );
      });
      truffleAssert.eventEmitted(tx, 'TokenMapped', ev => {
        return (
          ev.sourceToken == secondSrcToken &&
          ev.chainSelector == destChainSelector &&
          ev.destinationToken == secondDestToken
        );
      });
      const firstOutputToken = await bridgeInstance.getMappedToken.call(
        srcToken,
        destChainSelector,
      );
      assert.equal(firstOutputToken, destToken, 'wrong first dest token');
      const secondOutputToken = await bridgeInstance.getMappedToken.call(
        secondSrcToken,
        destChainSelector,
      );
      assert.equal(
        secondOutputToken,
        secondDestToken,
        'wrong second dest token',
      );
      assert.equal(
        true,
        await bridgeInstance.isTokenWhitelisted.call(
          srcToken,
          destChainSelector,
        ),
        'wrong first token withelisted',
      );
      assert.equal(
        true,
        await bridgeInstance.isTokenWhitelisted.call(
          secondSrcToken,
          destChainSelector,
        ),
        'wrong second token withelisted',
      );
    });
    it('Can revert if no tokens passed ', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setMappedTokens(destChainSelector, [], [], {
          from: maintainer,
        }),
        'No tokens passed',
      );
    });
    it('Can revert if tokens length does not match ', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setMappedTokens(
          destChainSelector,
          [srcToken, secondSrcToken],
          [destToken],
          {
            from: maintainer,
          },
        ),
        'Src and dest tokens do not match',
      );
    });
    it('Can revert if null token passed ', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setMappedTokens(
          destChainSelector,
          [srcToken, destToken],
          [secondSrcToken, ZERO_ADDRESS],
          {
            from: maintainer,
          },
        ),
        'Null token',
      );
      await truffleAssert.reverts(
        bridgeInstance.setMappedTokens(
          destChainSelector,
          [ZERO_ADDRESS, secondSrcToken],
          [destToken, secondDestToken],
          {
            from: maintainer,
          },
        ),
        'Null token',
      );
    });
    it('Can revert if chain selector not supported', async () => {
      const wrongChainSelector = '4009297550715157269';
      await truffleAssert.reverts(
        bridgeInstance.setMappedTokens(
          wrongChainSelector,
          [srcToken],
          [destToken],
          {
            from: maintainer,
          },
        ),
        'Chain not supported',
      );
    });
    it('Can revert if sender that sets is not the maintainer', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setMappedTokens(
          destChainSelector,
          [srcToken],
          [destToken],
          {
            from: accounts[6],
          },
        ),
        'Sender must be the maintainer',
      );
    });
    it('Can remove tokens', async () => {
      const tx = await bridgeInstance.removeMappedTokens(
        destChainSelector,
        [srcToken, secondSrcToken],
        {
          from: maintainer,
        },
      );
      truffleAssert.eventEmitted(tx, 'TokenUnmapped', ev => {
        return (
          ev.sourceToken == srcToken && ev.chainSelector == destChainSelector
        );
      });
      truffleAssert.eventEmitted(tx, 'TokenUnmapped', ev => {
        return (
          ev.sourceToken == secondSrcToken &&
          ev.chainSelector == destChainSelector
        );
      });
      await truffleAssert.reverts(
        bridgeInstance.getMappedToken.call(srcToken, destChainSelector),
        'Token not supported',
      );
      await truffleAssert.reverts(
        bridgeInstance.getMappedToken.call(secondSrcToken, destChainSelector),
        'Token not supported',
      );
      assert.equal(
        false,
        await bridgeInstance.isTokenWhitelisted.call(
          srcToken,
          destChainSelector,
        ),
        'wrong first token withelisted',
      );
      assert.equal(
        false,
        await bridgeInstance.isTokenWhitelisted.call(
          secondSrcToken,
          destChainSelector,
        ),
        'wrong second token withelisted',
      );
    });
    it('Can revert if no tokens passed ', async () => {
      await bridgeInstance.setMappedTokens(
        destChainSelector,
        [srcToken, secondSrcToken],
        [destToken, secondDestToken],
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        bridgeInstance.removeMappedTokens(destChainSelector, [], {
          from: maintainer,
        }),
        'No tokens passed',
      );
      await bridgeInstance.removeMappedTokens(
        destChainSelector,
        [srcToken, secondSrcToken],
        {
          from: maintainer,
        },
      );
    });
    it('Can revert if token not supported ', async () => {
      await bridgeInstance.setMappedTokens(
        destChainSelector,
        [srcToken, secondSrcToken],
        [destToken, secondDestToken],
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        bridgeInstance.removeMappedTokens(
          destChainSelector,
          [srcToken, accounts[9]],
          {
            from: maintainer,
          },
        ),
        'Token not supported',
      );
      await bridgeInstance.removeMappedTokens(
        destChainSelector,
        [srcToken, secondSrcToken],
        {
          from: maintainer,
        },
      );
    });
    it('Can revert if sender that removes is not the maintainer', async () => {
      await bridgeInstance.setMappedTokens(
        destChainSelector,
        [srcToken, destToken],
        [secondSrcToken, secondDestToken],
        {
          from: maintainer,
        },
      );
      await truffleAssert.reverts(
        bridgeInstance.removeMappedTokens(
          destChainSelector,
          [srcToken, destToken],
          {
            from: accounts[6],
          },
        ),
        'Sender must be the maintainer',
      );
      await bridgeInstance.removeMappedTokens(
        destChainSelector,
        [srcToken, destToken],
        {
          from: maintainer,
        },
      );
    });
  });

  describe('Should set free fee', async () => {
    it('Can set free fee', async () => {
      assert.equal(
        false,
        await bridgeInstance.isFeeFree.call(),
        'wrong free fee false',
      );
      const tx = await bridgeInstance.setFreeFee(true, {
        from: maintainer,
      });
      truffleAssert.eventEmitted(tx, 'FreeFeeSet', ev => {
        return ev.isFree == true;
      });
      assert.equal(
        true,
        await bridgeInstance.isFeeFree.call(),
        'wrong free fee true',
      );
    });
    it('Can revert if same fee status passed', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setFreeFee(true, {
          from: maintainer,
        }),
        'Free fee already set',
      );
      await bridgeInstance.setFreeFee(false, {
        from: maintainer,
      });
      await truffleAssert.reverts(
        bridgeInstance.setFreeFee(false, {
          from: maintainer,
        }),
        'Free fee already set',
      );
    });
    it('Can revert if sender that sets is not the maintainer', async () => {
      await truffleAssert.reverts(
        bridgeInstance.setFreeFee(true, {
          from: accounts[6],
        }),
        'Sender must be the maintainer',
      );
    });
  });

  describe('Should move tokens from the source chain', async () => {
    let bridgeToken;
    let amount;
    let gasLimit;
    let destToken;
    before(async () => {
      gasLimit = 300000;
      amount = toWei('10000');
      bridgeToken = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        'jEUR',
        18,
        { from: admin },
      );
      await bridgeToken.addMinter(admin, {
        from: admin,
      });
      await bridgeToken.addBurner(bridgeInstance.address, {
        from: admin,
      });
      await bridgeToken.mint(sender, toWei('1000000000'), { from: admin });
      destToken = accounts[8];
      await bridgeInstance.setEndpoints(
        destChainSelector,
        srcEndpoint,
        destEndpoint,
        { from: maintainer },
      );
      await bridgeInstance.setExtraArgs(destChainSelector, gasLimit, false, {
        from: maintainer,
      });
      await bridgeInstance.setMappedTokens(
        destChainSelector,
        [bridgeToken.address],
        [destToken],
        {
          from: maintainer,
        },
      );
      await setTokenBalance(
        linkToken.address,
        sender,
        '100000000',
        linkTokenStorage,
      );
      await setTokenBalance(
        linkToken.address,
        admin,
        '100000000',
        linkTokenStorage,
      );
      await setTokenBalance(
        unsupportedToken.address,
        sender,
        '100000000',
        unsupportedTokenStorage,
      );
    });
    after(async () => {
      await bridgeInstance.removeEndpoints(destChainSelector, {
        from: maintainer,
      });
      await bridgeInstance.removeExtraArgs(destChainSelector, {
        from: maintainer,
      });
      await bridgeInstance.removeMappedTokens(
        destChainSelector,
        [bridgeToken.address],
        {
          from: maintainer,
        },
      );
    });
    it('Can bridge token paying native fees', async () => {
      const prevBridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      const prevNativeBalance = await web3.eth.getBalance(sender);
      let retValues =
        await bridgeInstance.transferTokensToDestinationChain.call(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender, value: toWei('1000') },
        );
      const tx = await bridgeInstance.transferTokensToDestinationChain(
        destChainSelector,
        bridgeToken.address,
        amount,
        recipient,
        ZERO_ADDRESS,
        { from: sender, value: retValues[1] },
      );
      truffleAssert.eventEmitted(tx, 'TransferInitiated', ev => {
        return (
          ev.messageId.toString() == retValues[0].toString() &&
          ev.destinationChainSelector == destChainSelector &&
          ev.destinationEndpoint == destEndpoint &&
          ev.sourceToken == bridgeToken.address &&
          ev.destinationToken == destToken &&
          ev.amount.toString() == amount.toString() &&
          ev.sender == sender &&
          ev.receiver == recipient &&
          ev.feeToken == ZERO_ADDRESS &&
          ev.fees.toString() == retValues[1].toString()
        );
      });
      const bridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      const nativeBalance = await web3.eth.getBalance(sender);
      assert.equal(
        toBN(bridgeTokenBalance).toString(),
        toBN(prevBridgeTokenBalance).sub(toBN(amount)).toString(),
        'Wrong token balance',
      );
      const txCost = await getTxGasFee(tx.receipt);
      assert.equal(
        toBN(nativeBalance).toString(),
        toBN(prevNativeBalance).sub(toBN(retValues[1])).sub(txCost).toString(),
        'Wrong native balance',
      );
      let bridgedChainAmount = await bridgeInstance.getChainBridgedAmount.call(
        bridgeToken.address,
        destChainSelector,
      );
      let bridgedTotalAmount = await bridgeInstance.getTotalBridgedAmount.call(
        bridgeToken.address,
      );
      assert.equal(
        bridgedChainAmount.toString(),
        '-' + toBN(amount).toString(),
        'Wrong bridge chain amount',
      );
      assert.equal(
        bridgedTotalAmount.toString(),
        '-' + toBN(amount).toString(),
        'Wrong bridge total amount',
      );
      const secondAmount = toWei('20000');
      await bridgeToken.approve(bridgeInstance.address, secondAmount, {
        from: sender,
      });
      retValues = await bridgeInstance.transferTokensToDestinationChain.call(
        destChainSelector,
        bridgeToken.address,
        secondAmount,
        recipient,
        ZERO_ADDRESS,
        { from: sender, value: toWei('1000') },
      );
      await bridgeInstance.transferTokensToDestinationChain(
        destChainSelector,
        bridgeToken.address,
        secondAmount,
        recipient,
        ZERO_ADDRESS,
        { from: sender, value: retValues[1] },
      );
      bridgedChainAmount = await bridgeInstance.getChainBridgedAmount.call(
        bridgeToken.address,
        destChainSelector,
      );
      bridgedTotalAmount = await bridgeInstance.getTotalBridgedAmount.call(
        bridgeToken.address,
      );
      assert.equal(
        bridgedChainAmount.toString(),
        '-' + toBN(amount).add(toBN(secondAmount)).toString(),
        'Wrong bridge chain amount',
      );
      assert.equal(
        bridgedTotalAmount.toString(),
        '-' + toBN(amount).add(toBN(secondAmount)).toString(),
        'Wrong bridge total amount',
      );
      const secondDestChainSelector = bridge[networkId].secondChainSelector;
      await bridgeInstance.setEndpoints(
        secondDestChainSelector,
        srcEndpoint,
        destEndpoint,
        { from: maintainer },
      );
      const secondDestToken = accounts[9];
      await bridgeInstance.setExtraArgs(
        secondDestChainSelector,
        gasLimit,
        false,
        {
          from: maintainer,
        },
      );
      await bridgeInstance.setMappedTokens(
        secondDestChainSelector,
        [bridgeToken.address],
        [secondDestToken],
        {
          from: maintainer,
        },
      );
      const thirdAmount = toWei('25000');
      await bridgeToken.approve(bridgeInstance.address, thirdAmount, {
        from: sender,
      });
      retValues = await bridgeInstance.transferTokensToDestinationChain.call(
        secondDestChainSelector,
        bridgeToken.address,
        thirdAmount,
        recipient,
        ZERO_ADDRESS,
        { from: sender, value: toWei('1000') },
      );
      await bridgeInstance.transferTokensToDestinationChain(
        secondDestChainSelector,
        bridgeToken.address,
        thirdAmount,
        recipient,
        ZERO_ADDRESS,
        { from: sender, value: retValues[1] },
      );
      bridgedChainAmount = await bridgeInstance.getChainBridgedAmount.call(
        bridgeToken.address,
        destChainSelector,
      );
      let secondBridgeChainAmount =
        await bridgeInstance.getChainBridgedAmount.call(
          bridgeToken.address,
          secondDestChainSelector,
        );
      bridgedTotalAmount = await bridgeInstance.getTotalBridgedAmount.call(
        bridgeToken.address,
      );
      assert.equal(
        bridgedChainAmount.toString(),
        '-' + toBN(amount).add(toBN(secondAmount)).toString(),
        'Wrong bridge chain amount',
      );
      assert.equal(
        secondBridgeChainAmount.toString(),
        '-' + toBN(thirdAmount).toString(),
        'Wrong second bridge chain amount',
      );
      assert.equal(
        bridgedTotalAmount.toString(),
        '-' +
          toBN(amount)
            .add(toBN(secondAmount))
            .add(toBN(thirdAmount))
            .toString(),
        'Wrong bridge total amount',
      );
      await bridgeInstance.removeEndpoints(secondDestChainSelector, {
        from: maintainer,
      });
      await bridgeInstance.removeExtraArgs(secondDestChainSelector, {
        from: maintainer,
      });
      await bridgeInstance.removeMappedTokens(
        secondDestChainSelector,
        [bridgeToken.address],
        {
          from: maintainer,
        },
      );
    });
    it('Can bridge token paying native fees with refuding of exceeding amount', async () => {
      const prevBridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      const prevNativeBalance = await web3.eth.getBalance(sender);
      const retValues =
        await bridgeInstance.transferTokensToDestinationChain.call(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender, value: toWei('1000') },
        );
      const exceedingFee = toBN(toWei('0.01'));
      const tx = await bridgeInstance.transferTokensToDestinationChain(
        destChainSelector,
        bridgeToken.address,
        amount,
        recipient,
        ZERO_ADDRESS,
        { from: sender, value: toBN(retValues[1]).add(exceedingFee) },
      );
      truffleAssert.eventEmitted(tx, 'TransferInitiated', ev => {
        return (
          ev.messageId.toString() == retValues[0].toString() &&
          ev.destinationChainSelector == destChainSelector &&
          ev.destinationEndpoint == destEndpoint &&
          ev.sourceToken == bridgeToken.address &&
          ev.destinationToken == destToken &&
          ev.amount.toString() == amount.toString() &&
          ev.sender == sender &&
          ev.receiver == recipient &&
          ev.feeToken == ZERO_ADDRESS &&
          ev.fees.toString() == retValues[1].toString()
        );
      });
      const bridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      const nativeBalance = await web3.eth.getBalance(sender);
      assert.equal(
        toBN(bridgeTokenBalance).toString(),
        toBN(prevBridgeTokenBalance).sub(toBN(amount)).toString(),
        'Wrong token balance',
      );
      const txCost = await getTxGasFee(tx.receipt);
      assert.equal(
        toBN(nativeBalance).toString(),
        toBN(prevNativeBalance).sub(toBN(retValues[1])).sub(txCost).toString(),
        'Wrong native balance',
      );
    });
    it('Can bridge token with free native fees', async () => {
      await bridgeInstance.setFreeFee(true, { from: maintainer });
      const prevBridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      const prevNativeBalance = await web3.eth.getBalance(sender);
      const retValues =
        await bridgeInstance.transferTokensToDestinationChain.call(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender, value: toWei('1000') },
        );
      const exceedingFee = toBN(toWei('0.01'));
      const sendAmount = toBN(retValues[1]).add(exceedingFee);
      await web3.eth.sendTransaction({
        from: admin,
        to: bridgeInstance.address,
        value: sendAmount,
      });
      const preBridgeBalance = await web3.eth.getBalance(
        bridgeInstance.address,
      );
      const tx = await bridgeInstance.transferTokensToDestinationChain(
        destChainSelector,
        bridgeToken.address,
        amount,
        recipient,
        ZERO_ADDRESS,
        { from: sender },
      );
      truffleAssert.eventEmitted(tx, 'TransferInitiated', ev => {
        return (
          ev.messageId.toString() == retValues[0].toString() &&
          ev.destinationChainSelector == destChainSelector &&
          ev.destinationEndpoint == destEndpoint &&
          ev.sourceToken == bridgeToken.address &&
          ev.destinationToken == destToken &&
          ev.amount.toString() == amount.toString() &&
          ev.sender == sender &&
          ev.receiver == recipient &&
          ev.feeToken == ZERO_ADDRESS &&
          ev.fees.toString() == retValues[1].toString()
        );
      });
      const bridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      const nativeBalance = await web3.eth.getBalance(sender);
      const bridgeBalance = await web3.eth.getBalance(bridgeInstance.address);
      assert.equal(
        toBN(bridgeTokenBalance).toString(),
        toBN(prevBridgeTokenBalance).sub(toBN(amount)).toString(),
        'Wrong token balance',
      );
      const txCost = await getTxGasFee(tx.receipt);
      assert.equal(
        toBN(nativeBalance).toString(),
        toBN(prevNativeBalance).sub(txCost).toString(),
        'Wrong native balance',
      );
      assert.equal(
        toBN(bridgeBalance).toString(),
        toBN(preBridgeBalance).sub(toBN(retValues[1])).toString(),
        'Wrong native balance',
      );
      await bridgeInstance.withdraw(admin, { from: maintainer });
      await bridgeInstance.setFreeFee(false, { from: maintainer });
    });
    it('Can revert if not enough native fees paid', async () => {
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      const retValues =
        await bridgeInstance.transferTokensToDestinationChain.call(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender, value: toWei('1000') },
        );
      await truffleAssert.reverts(
        bridgeInstance.transferTokensToDestinationChain(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender, value: toBN(retValues[1]).sub(toBN('1')) },
        ),
        'Not enough native fees sent',
      );
    });
    it('Can revert if not enough balance with native free fees', async () => {
      await bridgeInstance.setFreeFee(true, { from: maintainer });
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      const retValues =
        await bridgeInstance.transferTokensToDestinationChain.call(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender, value: toWei('1000') },
        );
      const removingFee = toBN('1');
      const sendAmount = toBN(retValues[1]).sub(removingFee);
      await web3.eth.sendTransaction({
        from: admin,
        to: bridgeInstance.address,
        value: sendAmount,
      });
      await truffleAssert.reverts(
        bridgeInstance.transferTokensToDestinationChain(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender },
        ),
        'Not enough balance',
      );
      await bridgeInstance.setFreeFee(false, { from: maintainer });
    });
    it('Can bridge token paying ERC20 fees', async () => {
      const prevBridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      const prevFeeBalance = await linkToken.balanceOf.call(sender);
      await linkToken.approve(bridgeInstance.address, toWei('100000'), {
        from: sender,
      });
      const retValues =
        await bridgeInstance.transferTokensToDestinationChain.call(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          linkToken.address,
          { from: sender },
        );
      await linkToken.approve(bridgeInstance.address, retValues[1], {
        from: sender,
      });
      const tx = await bridgeInstance.transferTokensToDestinationChain(
        destChainSelector,
        bridgeToken.address,
        amount,
        recipient,
        linkToken.address,
        { from: sender },
      );
      truffleAssert.eventEmitted(tx, 'TransferInitiated', ev => {
        return (
          ev.messageId.toString() == retValues[0].toString() &&
          ev.destinationChainSelector == destChainSelector &&
          ev.destinationEndpoint == destEndpoint &&
          ev.sourceToken == bridgeToken.address &&
          ev.destinationToken == destToken &&
          ev.amount.toString() == amount.toString() &&
          ev.sender == sender &&
          ev.receiver == recipient &&
          ev.feeToken == linkToken.address &&
          ev.fees.toString() == retValues[1].toString()
        );
      });
      const bridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      const feeBalance = await linkToken.balanceOf.call(sender);
      assert.equal(
        toBN(bridgeTokenBalance).toString(),
        toBN(prevBridgeTokenBalance).sub(toBN(amount)).toString(),
        'Wrong token balance',
      );
      assert.equal(
        toBN(feeBalance).toString(),
        toBN(prevFeeBalance).sub(toBN(retValues[1])).toString(),
        'Wrong fee balance',
      );
    });
    it('Can bridge token with free ERC20 fees', async () => {
      await bridgeInstance.setFreeFee(true, { from: maintainer });
      const prevBridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      const prevFeeBalance = await linkToken.balanceOf.call(sender);
      await linkToken.transfer(
        bridgeInstance.address,
        await linkToken.balanceOf(admin),
        {
          from: admin,
        },
      );
      const retValues =
        await bridgeInstance.transferTokensToDestinationChain.call(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          linkToken.address,
          { from: sender },
        );
      await bridgeInstance.withdrawToken(linkToken.address, admin, {
        from: maintainer,
      });
      const exceedingFee = toBN(toWei('0.01'));
      const sendAmount = toBN(retValues[1]).add(exceedingFee);
      await linkToken.transfer(bridgeInstance.address, sendAmount, {
        from: admin,
      });
      const preBridgeBalance = await linkToken.balanceOf.call(
        bridgeInstance.address,
      );
      const tx = await bridgeInstance.transferTokensToDestinationChain(
        destChainSelector,
        bridgeToken.address,
        amount,
        recipient,
        linkToken.address,
        { from: sender },
      );
      truffleAssert.eventEmitted(tx, 'TransferInitiated', ev => {
        return (
          ev.messageId.toString() == retValues[0].toString() &&
          ev.destinationChainSelector == destChainSelector &&
          ev.destinationEndpoint == destEndpoint &&
          ev.sourceToken == bridgeToken.address &&
          ev.destinationToken == destToken &&
          ev.amount.toString() == amount.toString() &&
          ev.sender == sender &&
          ev.receiver == recipient &&
          ev.feeToken == linkToken.address &&
          ev.fees.toString() == retValues[1].toString()
        );
      });
      const bridgeTokenBalance = await bridgeToken.balanceOf.call(sender);
      const feeBalance = await linkToken.balanceOf.call(sender);
      const bridgeBalance = await linkToken.balanceOf.call(
        bridgeInstance.address,
      );
      assert.equal(
        toBN(bridgeTokenBalance).toString(),
        toBN(prevBridgeTokenBalance).sub(toBN(amount)).toString(),
        'Wrong token balance',
      );
      assert.equal(
        toBN(feeBalance).toString(),
        toBN(prevFeeBalance),
        'Wrong fee balance',
      );
      assert.equal(
        toBN(bridgeBalance).toString(),
        toBN(preBridgeBalance).sub(toBN(retValues[1])).toString(),
        'Wrong bridge balance',
      );
      await bridgeInstance.withdrawToken(linkToken.address, admin, {
        from: maintainer,
      });
      await bridgeInstance.setFreeFee(false, { from: maintainer });
    });
    it('Can revert if native token sent with ERC20 fees', async () => {
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      await linkToken.approve(bridgeInstance.address, toWei('100000'), {
        from: sender,
      });
      const retValues =
        await bridgeInstance.transferTokensToDestinationChain.call(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          linkToken.address,
          { from: sender },
        );
      await linkToken.approve(bridgeInstance.address, retValues[1], {
        from: sender,
      });
      await truffleAssert.reverts(
        bridgeInstance.transferTokensToDestinationChain(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          linkToken.address,
          { from: sender, value: '1' },
        ),
        'Native token sent',
      );
    });
    it('Can revert if not enough balance with native ERC20 free fees', async () => {
      await bridgeInstance.setFreeFee(true, { from: maintainer });
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      await linkToken.transfer(
        bridgeInstance.address,
        await linkToken.balanceOf(admin),
        {
          from: admin,
        },
      );
      const retValues =
        await bridgeInstance.transferTokensToDestinationChain.call(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          linkToken.address,
          { from: sender },
        );
      await bridgeInstance.withdrawToken(linkToken.address, admin, {
        from: maintainer,
      });
      await linkToken.transfer(
        bridgeInstance.address,
        toBN(retValues[1]).sub(toBN('1')),
        {
          from: admin,
        },
      );
      await truffleAssert.reverts(
        bridgeInstance.transferTokensToDestinationChain(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          linkToken.address,
          { from: sender },
        ),
        'Not enough balance',
      );
      await bridgeInstance.withdrawToken(linkToken.address, admin, {
        from: maintainer,
      });
      await bridgeInstance.setFreeFee(false, { from: maintainer });
    });
    it('Can revert if paying fees with an unsupported ERC20 token', async () => {
      await bridgeToken.approve(bridgeInstance.address, amount, {
        from: sender,
      });
      await linkToken.approve(bridgeInstance.address, toWei('100000'), {
        from: sender,
      });
      await unsupportedToken.approve(
        bridgeInstance.address,
        toWei('10000000000000000'),
        {
          from: sender,
        },
      );
      await truffleAssert.reverts(
        bridgeInstance.transferTokensToDestinationChain(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          unsupportedToken.address,
          { from: sender },
        ),
      );
    });
    it('Can revert if token not supported', async () => {
      await bridgeToken.approve(unsupportedToken.address, amount, {
        from: sender,
      });
      await truffleAssert.reverts(
        bridgeInstance.transferTokensToDestinationChain(
          destChainSelector,
          unsupportedToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender, value: toWei('1000') },
        ),
        'Token not supported',
      );
    });
    it('Can revert if endpoint not supported', async () => {
      await bridgeInstance.removeEndpoints(destChainSelector, {
        from: maintainer,
      });
      await bridgeToken.approve(bridgeToken.address, amount, {
        from: sender,
      });
      await truffleAssert.reverts(
        bridgeInstance.transferTokensToDestinationChain(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender, value: toWei('1000') },
        ),
        'Dest endpoint not supported',
      );
      await bridgeInstance.setEndpoints(
        destChainSelector,
        srcEndpoint,
        destEndpoint,
        { from: maintainer },
      );
    });
    it('Can revert if extraargs not supported', async () => {
      await bridgeInstance.removeExtraArgs(destChainSelector, {
        from: maintainer,
      });
      await bridgeToken.approve(bridgeToken.address, amount, {
        from: sender,
      });
      await truffleAssert.reverts(
        bridgeInstance.transferTokensToDestinationChain(
          destChainSelector,
          bridgeToken.address,
          amount,
          recipient,
          ZERO_ADDRESS,
          { from: sender, value: toWei('1000') },
        ),
        'Args not supported',
      );
      await bridgeInstance.setExtraArgs(destChainSelector, gasLimit, false, {
        from: maintainer,
      });
    });
  });

  describe('Should receive tokens in the destination chain', async () => {
    let bridgeToken;
    let amount;
    let destToken;
    let mockBridgeInstance, mockRouter;
    before(async () => {
      mockRouter = await MockRouter.new();
      mockBridgeInstance = await SynthereumCCIPBridge.new(
        finderInstance.address,
        mockRouter.address,
        { admin: admin, maintainer: maintainer },
      );
      amount = toWei('10000');
      destToken = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        'jEUR',
        18,
        { from: admin },
      );
      await destToken.addMinter(mockBridgeInstance.address, {
        from: admin,
      });
      bridgeToken = accounts[8];
      await mockBridgeInstance.setEndpoints(
        destChainSelector,
        srcEndpoint,
        destEndpoint,
        { from: maintainer },
      );
      await mockBridgeInstance.setMappedTokens(
        destChainSelector,
        [destToken.address],
        [bridgeToken],
        {
          from: maintainer,
        },
      );
    });
    after(async () => {
      await mockBridgeInstance.removeEndpoints(destChainSelector, {
        from: maintainer,
      });
      await mockBridgeInstance.removeMappedTokens(
        destChainSelector,
        [destToken.address],
        {
          from: maintainer,
        },
      );
    });
    it('Can mint tokens on the destination chain', async () => {
      let data = web3.eth.abi.encodeParameters(
        ['address', 'address', 'uint256', 'address'],
        [bridgeToken, destToken.address, amount, recipient],
      );

      let messageId = web3.eth.abi.encodeParameters(
        ['bytes32'],
        [toHex('test')],
      );
      let message = {
        messageId,
        sourceChainSelector: destChainSelector,
        sender: web3.eth.abi.encodeParameters(['address'], [srcEndpoint]),
        data,
        destTokenAmounts: [],
      };

      const prevDestTokenBalance = await destToken.balanceOf.call(recipient);
      const tx = await mockRouter.ccipSend(
        mockBridgeInstance.address,
        0,
        message,
      );

      // the event is now internal since using a mock contract to call
      // truffleAssert.eventEmitted(tx, 'TransferCompleted', ev => {
      //   return (
      //     ev.messageId.toString() == messageId &&
      //     ev.sourceChainSelector == destChainSelector &&
      //     ev.sourceEndpoint == sourceEndpoint &&
      //     ev.sourceToken == bridgeToken &&
      //     ev.destinationToken == destToken &&
      //     ev.amount.toString() == amount &&
      //     ev.receiver == recipient
      //     );
      // });
      const destTokenBalance = await destToken.balanceOf.call(recipient);

      assert.equal(
        destTokenBalance.toString(),
        toBN(prevDestTokenBalance).add(toBN(amount)).toString(),
      );
      let bridgedChainAmount =
        await mockBridgeInstance.getChainBridgedAmount.call(
          destToken.address,
          destChainSelector,
        );
      let bridgedTotalAmount =
        await mockBridgeInstance.getTotalBridgedAmount.call(destToken.address);
      assert.equal(
        bridgedChainAmount.toString(),
        toBN(amount).toString(),
        'Wrong bridge chain amount',
      );
      assert.equal(
        bridgedTotalAmount.toString(),
        toBN(amount).toString(),
        'Wrong bridge total amount',
      );
      const secondAmount = toWei('5000');
      data = web3.eth.abi.encodeParameters(
        ['address', 'address', 'uint256', 'address'],
        [bridgeToken, destToken.address, secondAmount, recipient],
      );
      messageId = web3.eth.abi.encodeParameters(['bytes32'], [toHex('test2')]);
      message = {
        messageId,
        sourceChainSelector: destChainSelector,
        sender: web3.eth.abi.encodeParameters(['address'], [srcEndpoint]),
        data,
        destTokenAmounts: [],
      };
      await mockRouter.ccipSend(mockBridgeInstance.address, 0, message);
      bridgedChainAmount = await mockBridgeInstance.getChainBridgedAmount.call(
        destToken.address,
        destChainSelector,
      );
      bridgedTotalAmount = await mockBridgeInstance.getTotalBridgedAmount.call(
        destToken.address,
      );
      assert.equal(
        bridgedChainAmount.toString(),
        toBN(amount).add(toBN(secondAmount)).toString(),
        'Wrong bridge chain amount',
      );
      assert.equal(
        bridgedTotalAmount.toString(),
        toBN(amount).add(toBN(secondAmount)).toString(),
        'Wrong bridge total amount',
      );
      const secondDestChainSelector = bridge[networkId].secondChainSelector;
      await mockBridgeInstance.setEndpoints(
        secondDestChainSelector,
        srcEndpoint,
        destEndpoint,
        { from: maintainer },
      );
      const srcToken = accounts[9];
      await mockBridgeInstance.setMappedTokens(
        secondDestChainSelector,
        [destToken.address],
        [srcToken],
        {
          from: maintainer,
        },
      );
      const thirdAmount = toWei('15000');
      data = web3.eth.abi.encodeParameters(
        ['address', 'address', 'uint256', 'address'],
        [srcToken, destToken.address, thirdAmount, recipient],
      );
      messageId = web3.eth.abi.encodeParameters(['bytes32'], [toHex('test3')]);
      message = {
        messageId,
        sourceChainSelector: secondDestChainSelector,
        sender: web3.eth.abi.encodeParameters(['address'], [srcEndpoint]),
        data,
        destTokenAmounts: [],
      };
      await mockRouter.ccipSend(mockBridgeInstance.address, 0, message);
      bridgedChainAmount = await mockBridgeInstance.getChainBridgedAmount.call(
        destToken.address,
        destChainSelector,
      );
      let secondBridgeChainAmount =
        await mockBridgeInstance.getChainBridgedAmount.call(
          destToken.address,
          secondDestChainSelector,
        );
      bridgedTotalAmount = await mockBridgeInstance.getTotalBridgedAmount.call(
        destToken.address,
      );
      assert.equal(
        bridgedChainAmount.toString(),
        toBN(amount).add(toBN(secondAmount)).toString(),
        'Wrong bridge chain amount',
      );
      assert.equal(
        secondBridgeChainAmount.toString(),
        toBN(thirdAmount).toString(),
        'Wrong second bridge chain amount',
      );
      assert.equal(
        bridgedTotalAmount.toString(),
        toBN(amount).add(toBN(secondAmount)).add(toBN(thirdAmount)).toString(),
        'Wrong bridge total amount',
      );
      await mockBridgeInstance.removeEndpoints(secondDestChainSelector, {
        from: maintainer,
      });
      await mockBridgeInstance.removeMappedTokens(
        secondDestChainSelector,
        [destToken.address],
        {
          from: maintainer,
        },
      );
    });
    it('Can revert is source endpoint not supported', async () => {
      const data = web3.eth.abi.encodeParameters(
        ['address', 'address', 'uint256', 'address'],
        [bridgeToken, destToken.address, amount, recipient],
      );

      const messageId = web3.eth.abi.encodeParameters(
        ['bytes32'],
        [toHex('test')],
      );
      const message = {
        messageId,
        sourceChainSelector: destChainSelector,
        sender: web3.eth.abi.encodeParameters(['address'], [accounts[10]]),
        data,
        destTokenAmounts: [],
      };

      await truffleAssert.reverts(
        mockRouter.ccipSend(mockBridgeInstance.address, 0, message),
        'Wrong src endpoint',
      );
    });
    it('Can revert if source token not supported', async () => {
      const data = web3.eth.abi.encodeParameters(
        ['address', 'address', 'uint256', 'address'],
        [accounts[4], destToken.address, amount, recipient],
      );

      const messageId = web3.eth.abi.encodeParameters(
        ['bytes32'],
        [toHex('test')],
      );
      const message = {
        messageId,
        sourceChainSelector: destChainSelector,
        sender: web3.eth.abi.encodeParameters(['address'], [srcEndpoint]),
        data,
        destTokenAmounts: [],
      };

      await truffleAssert.reverts(
        mockRouter.ccipSend(mockBridgeInstance.address, 0, message),
        'Wrong src token',
      );
    });
    it('Can revert if sender is not the router', async () => {
      const data = web3.eth.abi.encodeParameters(
        ['address', 'address', 'uint256', 'address'],
        [accounts[4], destToken.address, amount, recipient],
      );

      const messageId = web3.eth.abi.encodeParameters(
        ['bytes32'],
        [toHex('test')],
      );
      const message = {
        messageId,
        sourceChainSelector: destChainSelector,
        sender: web3.eth.abi.encodeParameters(['address'], [accounts[10]]),
        data,
        destTokenAmounts: [],
      };

      await truffleAssert.reverts(
        mockBridgeInstance.ccipReceive(message),
        'Invalid router',
      );
    });
  });

  describe('Should withdraw deposited tokens', async () => {
    let mockBridgeInstance;
    before(async () => {
      mockRouter = await MockRouter.new();
      mockBridgeInstance = await SynthereumCCIPBridge.new(
        finderInstance.address,
        mockRouter.address,
        { admin: admin, maintainer: maintainer },
      );
      amount = toWei('10000');
      destToken = await MintableBurnableSyntheticTokenPermit.new(
        'Jarvis Synthetic Euro',
        'jEUR',
        18,
        { from: admin },
      );
      await destToken.addMinter(mockBridgeInstance.address, {
        from: admin,
      });
      bridgeToken = accounts[8];
      await mockBridgeInstance.setEndpoints(
        destChainSelector,
        srcEndpoint,
        destEndpoint,
        { from: maintainer },
      );
      await mockBridgeInstance.setMappedTokens(
        destChainSelector,
        [destToken.address],
        [bridgeToken],
        {
          from: maintainer,
        },
      );
    });
    after(async () => {
      await mockBridgeInstance.removeEndpoints(destChainSelector, {
        from: maintainer,
      });
      await mockBridgeInstance.removeMappedTokens(
        destChainSelector,
        [destToken.address],
        {
          from: maintainer,
        },
      );
    });
    it('Can withdraw native tokens', async () => {
      const value = toWei('1', 'ether');
      let receiver = accounts[9];

      const balanceBefore = await web3.eth.getBalance(
        mockBridgeInstance.address,
      );
      const balanceReceiverBefore = await web3.eth.getBalance(receiver);

      await web3.eth.sendTransaction({
        from: accounts[0],
        to: mockBridgeInstance.address,
        value,
      });
      let balanceAfter = await web3.eth.getBalance(mockBridgeInstance.address);
      assert.equal(
        balanceAfter.toString(),
        toBN(balanceBefore).add(toBN(value)).toString(),
      );

      await mockBridgeInstance.withdraw(receiver, { from: maintainer });

      const balanceReceiverAfter = await web3.eth.getBalance(receiver);
      assert.equal(
        balanceReceiverAfter.toString(),
        toBN(balanceReceiverBefore).add(toBN(value)).toString(),
      );

      balanceAfter = await web3.eth.getBalance(mockBridgeInstance.address);
      assert.equal(balanceAfter.toString(), '0');
    });
    it('Can revert if no native tokens deposited', async () => {
      await truffleAssert.reverts(
        mockBridgeInstance.withdraw(maintainer, { from: maintainer }),
        'Nothing to withdraw',
      );
    });
    it('Can revert if withdraw native is not called by maintainer', async () => {
      await truffleAssert.reverts(
        mockBridgeInstance.withdraw(maintainer, { from: accounts[0] }),
        'Sender must be the maintainer',
      );
    });
    it('Can withdraw ERC20 tokens', async () => {
      const value = '100000000';
      let receiver = accounts[9];
      const balanceReceiverBefore = await linkToken.balanceOf.call(receiver);
      await setTokenBalance(
        linkToken.address,
        mockBridgeInstance.address,
        value,
        linkTokenStorage,
      );

      await mockBridgeInstance.withdrawToken(linkToken.address, receiver, {
        from: maintainer,
      });

      const balanceReceiverAfter = await linkToken.balanceOf.call(receiver);
      assert.equal(
        balanceReceiverAfter.toString(),
        toBN(balanceReceiverBefore)
          .add(toBN(toWei(value)))
          .toString(),
      );

      let balanceAfter = await linkToken.balanceOf.call(
        mockBridgeInstance.address,
      );
      assert.equal(balanceAfter.toString(), '0');
    });
    it('Can revert if no ERC20 tokens deposited', async () => {
      await truffleAssert.reverts(
        mockBridgeInstance.withdrawToken(linkToken.address, maintainer, {
          from: maintainer,
        }),
        'Nothing to withdraw',
      );
    });

    it('Can revert if withdraw ERC20 is not called by maintainer', async () => {
      await truffleAssert.reverts(
        mockBridgeInstance.withdrawToken(linkToken.address, maintainer, {
          from: accounts[0],
        }),
        'Sender must be the maintainer',
      );
    });
  });
});

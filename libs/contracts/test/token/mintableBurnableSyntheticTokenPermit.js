const {
  didContractThrow,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');

const SynthereumFinder = artifacts.require('SynthereumFinder');

// Tested Contract
const TokenFactory = artifacts.require('SynthereumSyntheticTokenPermitFactory');

// Helper contracts
const Token = artifacts.require('MintableBurnableSyntheticTokenPermit');

const { toWei, toBN } = web3.utils;

contract('MintableBurnableSyntheticTokenPermit', function (accounts) {
  const contractDeployer = accounts[0];
  const tokenCreator = accounts[1];
  const random = accounts[2];

  let tokenFactory;

  const tokenDetails = {
    name: 'UMA Token',
    symbol: 'UMA',
    decimals: '18',
  };

  it('Can transfer roles successfully', async () => {
    const token = await Token.new(
      tokenDetails.name,
      tokenDetails.symbol,
      tokenDetails.decimals,
      { from: tokenCreator },
    );

    // Creator should be only minter
    assert.isFalse(await token.isMinter(contractDeployer));
    assert.isFalse(await token.isMinter(tokenCreator));

    // Creator should be only burner
    assert.isFalse(await token.isBurner(contractDeployer));
    assert.isFalse(await token.isBurner(tokenCreator));

    // Contract deployer should no longer be capable of adding new roles
    assert(
      await didContractThrow(
        token.addMinter(random, { from: contractDeployer }),
      ),
    );
    assert(
      await didContractThrow(
        token.addBurner(random, { from: contractDeployer }),
      ),
    );

    // Creator should be able to add and a new minter that can renounce to its role
    await token.addMinter(tokenCreator, { from: tokenCreator });
    await token.addMinter(random, { from: tokenCreator });
    assert.isTrue(await token.isMinter(random));
    let minters = await token.getMinterMembers();
    assert.equal(minters.length, 2);
    assert.equal(minters[0], tokenCreator);
    assert.equal(minters[1], random);
    await token.renounceMinter({ from: random });
    minters = await token.getMinterMembers();
    assert.isFalse(await token.isMinter(random));
    assert.equal(minters.length, 1);
    assert.equal(minters[0], tokenCreator);

    // Creator should be able to add a new burner that can renoune to its role
    await token.addBurner(tokenCreator, { from: tokenCreator });
    await token.addBurner(random, { from: tokenCreator });
    assert.isTrue(await token.isBurner(random));
    let burners = await token.getBurnerMembers();
    assert.equal(burners.length, 2);
    assert.equal(burners[0], tokenCreator);
    assert.equal(burners[1], random);
    await token.renounceBurner({ from: random });
    burners = await token.getBurnerMembers();
    assert.isFalse(await token.isBurner(random));
    assert.equal(burners.length, 1);
    assert.equal(burners[0], tokenCreator);

    // Creator should be able to add a new admin that can renoune to its role
    await token.addAdmin(random, { from: tokenCreator });
    assert.isTrue(await token.isAdmin(random));
    let admins = await token.getAdminMembers();
    assert.equal(admins.length, 2);
    assert.equal(admins[0], tokenCreator);
    assert.equal(admins[1], random);
    await token.addBurner(random, { from: random });
    assert.isTrue(await token.isBurner(random));
    await token.renounceBurner({ from: random });
    await token.renounceAdmin({ from: random });
    admins = await token.getAdminMembers();
    assert.isFalse(await token.isAdmin(random));
    assert.equal(admins.length, 1);
    assert.equal(admins[0], tokenCreator);
    assert(await didContractThrow(token.addBurner(random, { from: random })));

    // Creator should be able to add a new admin that can renoune to its role
    await token.addAdminAndMinterAndBurner(random, { from: tokenCreator });
    assert.isTrue(await token.isAdmin(random));
    assert.isTrue(await token.isMinter(random));
    assert.isTrue(await token.isBurner(random));
    await token.renounceAdminAndMinterAndBurner({ from: random });
    assert.isFalse(await token.isAdmin(random));
    assert.isFalse(await token.isMinter(random));
    assert.isFalse(await token.isBurner(random));
  });
  it('Can token execute expected methods', async () => {
    const token = await Token.new(
      tokenDetails.name,
      tokenDetails.symbol,
      tokenDetails.decimals,
      { from: tokenCreator },
    );

    // Check ERC20Detailed methods
    assert.equal(await token.name(), tokenDetails.name);
    assert.equal(await token.symbol(), tokenDetails.symbol);
    assert.equal((await token.decimals()).toString(), tokenDetails.decimals);

    // Mint random some tokens
    const amountToMint = toWei('10.5').toString();
    await token.addMinter(tokenCreator, { from: tokenCreator });
    await token.mint(random, amountToMint, { from: tokenCreator });
    assert.equal((await token.balanceOf(random)).toString(), amountToMint);
    assert.equal((await token.totalSupply()).toString(), amountToMint);

    // Other account cannot burn any tokens because they are not a minter
    assert(
      await didContractThrow(
        token.mint(random, amountToMint, { from: contractDeployer }),
      ),
    );

    // Transfer some tokens to another account
    const amountToTransfer = toWei('1').toString();
    await token.transfer(contractDeployer, amountToTransfer, { from: random });
    assert.equal(
      (await token.balanceOf(random)).toString(),
      toBN(amountToMint).sub(toBN(amountToTransfer)).toString(),
    );
    assert.equal(
      (await token.balanceOf(contractDeployer)).toString(),
      amountToTransfer,
    );

    // Other account cannot burn any tokens because they are not a burner
    assert(
      await didContractThrow(
        token.burn(amountToTransfer, { from: contractDeployer }),
      ),
    );

    // Token creator grants burning privileges to recipient of tokens
    await token.addBurner(contractDeployer, { from: tokenCreator });
    await token.burn(amountToTransfer, { from: contractDeployer });
    assert.equal((await token.balanceOf(contractDeployer)).toString(), '0');

    // Increase allowance for a spender, have spender transferFrom tokens away, and decrease allowance
    await token.increaseAllowance(tokenCreator, amountToTransfer, {
      from: random,
    });
    await token.increaseAllowance(tokenCreator, amountToTransfer, {
      from: random,
    });
    await token.transferFrom(random, tokenCreator, amountToTransfer, {
      from: tokenCreator,
    });
    await token.decreaseAllowance(tokenCreator, amountToTransfer, {
      from: random,
    });
    assert.equal((await token.allowance(random, tokenCreator)).toString(), '0');

    // Burn remaining tokens
    await token.addBurner(tokenCreator, { from: tokenCreator });
    await token.burn(amountToTransfer, { from: tokenCreator });
    await token.addBurner(random, { from: tokenCreator });
    await token.burn(toWei('8.5'.toString()), { from: random });
    assert.equal((await token.balanceOf(random)).toString(), '0');
    assert.equal((await token.totalSupply()).toString(), '0');
  });
});

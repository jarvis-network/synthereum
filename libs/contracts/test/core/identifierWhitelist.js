const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const SynthereumIdentifierWhitelist = artifacts.require(
  'SynthereumIdentifierWhitelist',
);

contract('IdentifierWhitelist', function (accounts) {
  const maintainer = accounts[1];
  const identifierToAdd = web3Utils.padRight(web3Utils.utf8ToHex('EURUSD'), 64);
  const secondIdentifierToAdd = web3Utils.padRight(
    web3Utils.utf8ToHex('GBPUSD'),
    64,
  );
  const sender = accounts[4];
  let identifierWhitelistInstance;

  before(async () => {
    identifierWhitelistInstance = await SynthereumIdentifierWhitelist.deployed();
  });

  it('Can add identifier to the whitelist', async () => {
    assert.equal(
      await identifierWhitelistInstance.isOnWhitelist.call(identifierToAdd),
      false,
      'Wrong status before adding',
    );
    const addIdentifierTx = await identifierWhitelistInstance.addToWhitelist(
      identifierToAdd,
      { from: maintainer },
    );
    truffleAssert.eventEmitted(addIdentifierTx, 'AddedToWhitelist', ev => {
      return ev.addedIdentifier == identifierToAdd;
    });
    assert.equal(
      await identifierWhitelistInstance.isOnWhitelist.call(identifierToAdd),
      true,
      'Wrong adding',
    );
  });
  it('Can revert if trying to add collateral already on the whitelist', async () => {
    assert.equal(
      await identifierWhitelistInstance.isOnWhitelist.call(identifierToAdd),
      true,
      'Wrong status before revert adding',
    );
    await truffleAssert.reverts(
      identifierWhitelistInstance.addToWhitelist(identifierToAdd, {
        from: maintainer,
      }),
      'Identifier already supported',
    );
  });
  it('Can revert if sender in adding collateral is not the maintainer', async () => {
    await truffleAssert.reverts(
      identifierWhitelistInstance.addToWhitelist(secondIdentifierToAdd, {
        from: sender,
      }),
      'Sender must be the maintainer',
    );
  });
  it('Can remove collateral to the whitelist', async () => {
    assert.equal(
      await identifierWhitelistInstance.isOnWhitelist.call(identifierToAdd),
      true,
      'Wrong status before removing',
    );
    const removeCollateralTx = await identifierWhitelistInstance.removeFromWhitelist(
      identifierToAdd,
      { from: maintainer },
    );
    truffleAssert.eventEmitted(
      removeCollateralTx,
      'RemovedFromWhitelist',
      ev => {
        return ev.removedIdentifier == identifierToAdd;
      },
    );
    assert.equal(
      await identifierWhitelistInstance.isOnWhitelist.call(identifierToAdd),
      false,
      'Wrong removing',
    );
  });
  it('Can revert if trying to remove collateral already on the whitelist', async () => {
    assert.equal(
      await identifierWhitelistInstance.isOnWhitelist.call(identifierToAdd),
      false,
      'Wrong status before revert removing',
    );
    await truffleAssert.reverts(
      identifierWhitelistInstance.removeFromWhitelist(identifierToAdd, {
        from: maintainer,
      }),
      'Identifier not supported',
    );
  });
  it('Can revert if sender in removing collateral is not the maintainer', async () => {
    await truffleAssert.reverts(
      identifierWhitelistInstance.removeFromWhitelist(identifierToAdd, {
        from: sender,
      }),
      'Sender must be the maintainer',
    );
  });
  it('Can get the correct list of identifiers', async () => {
    await identifierWhitelistInstance.addToWhitelist(secondIdentifierToAdd, {
      from: maintainer,
    });
    let listResult = await identifierWhitelistInstance.getWhitelist.call();
    assert.equal(listResult.length, 1, 'Wrong number of identifiers');
    assert.equal(
      listResult[0],
      secondIdentifierToAdd,
      'Wrong collateral in the withelist',
    );
    await identifierWhitelistInstance.removeFromWhitelist(
      secondIdentifierToAdd,
      {
        from: maintainer,
      },
    );
    listResult = await identifierWhitelistInstance.getWhitelist.call();
    assert.equal(listResult.length, 0, 'Wrong number of identifiers');
    await identifierWhitelistInstance.addToWhitelist(identifierToAdd, {
      from: maintainer,
    });
    listResult = await identifierWhitelistInstance.getWhitelist.call();
    assert.equal(listResult.length, 1, 'Wrong number of identifiers');
    assert.equal(
      listResult[0],
      identifierToAdd,
      'Wrong collateral in the withelist',
    );
    await identifierWhitelistInstance.addToWhitelist(secondIdentifierToAdd, {
      from: maintainer,
    });
    listResult = await identifierWhitelistInstance.getWhitelist.call();
    assert.equal(listResult.length, 2, 'Wrong number of identifiers');
    assert.equal(
      listResult[1],
      secondIdentifierToAdd,
      'Wrong collateral in the withelist',
    );
  });
});

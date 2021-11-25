const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const SynthereumCollateralWhitelist = artifacts.require(
  'SynthereumCollateralWhitelist',
);

contract('CollateralWhitelist', function (accounts) {
  const maintainer = accounts[1];
  const collateralToAdd = accounts[2];
  const secondCollateralToAdd = accounts[3];
  const sender = accounts[4];
  let collateralWhitelistInstance;
  let collateralWhitelistAddress;

  before(async () => {
    collateralWhitelistInstance = await SynthereumCollateralWhitelist.deployed();
  });

  it('Can add collateral to the whitelist', async () => {
    assert.equal(
      await collateralWhitelistInstance.isOnWhitelist.call(collateralToAdd),
      false,
      'Wrong status before adding',
    );
    const addCollateralTx = await collateralWhitelistInstance.addToWhitelist(
      collateralToAdd,
      { from: maintainer },
    );
    truffleAssert.eventEmitted(addCollateralTx, 'AddedToWhitelist', ev => {
      return ev.addedCollateral == collateralToAdd;
    });
    assert.equal(
      await collateralWhitelistInstance.isOnWhitelist.call(collateralToAdd),
      true,
      'Wrong adding',
    );
  });
  it('Can revert if trying to add collateral already on the whitelist', async () => {
    assert.equal(
      await collateralWhitelistInstance.isOnWhitelist.call(collateralToAdd),
      true,
      'Wrong status before revert adding',
    );
    await truffleAssert.reverts(
      collateralWhitelistInstance.addToWhitelist(collateralToAdd, {
        from: maintainer,
      }),
      'Collateral already supported',
    );
  });
  it('Can revert if sender in adding collateral is not the maintainer', async () => {
    await truffleAssert.reverts(
      collateralWhitelistInstance.addToWhitelist(secondCollateralToAdd, {
        from: sender,
      }),
      'Sender must be the maintainer',
    );
  });
  it('Can remove collateral to the whitelist', async () => {
    assert.equal(
      await collateralWhitelistInstance.isOnWhitelist.call(collateralToAdd),
      true,
      'Wrong status before removing',
    );
    const removeCollateralTx = await collateralWhitelistInstance.removeFromWhitelist(
      collateralToAdd,
      { from: maintainer },
    );
    truffleAssert.eventEmitted(
      removeCollateralTx,
      'RemovedFromWhitelist',
      ev => {
        return ev.removedCollateral == collateralToAdd;
      },
    );
    assert.equal(
      await collateralWhitelistInstance.isOnWhitelist.call(collateralToAdd),
      false,
      'Wrong removing',
    );
  });
  it('Can revert if trying to remove collateral already on the whitelist', async () => {
    assert.equal(
      await collateralWhitelistInstance.isOnWhitelist.call(collateralToAdd),
      false,
      'Wrong status before revert removing',
    );
    await truffleAssert.reverts(
      collateralWhitelistInstance.removeFromWhitelist(collateralToAdd, {
        from: maintainer,
      }),
      'Collateral not supported',
    );
  });
  it('Can revert if sender in removing collateral is not the maintainer', async () => {
    await truffleAssert.reverts(
      collateralWhitelistInstance.removeFromWhitelist(collateralToAdd, {
        from: sender,
      }),
      'Sender must be the maintainer',
    );
  });
  it('Can get the correct list of collaterals', async () => {
    await collateralWhitelistInstance.addToWhitelist(secondCollateralToAdd, {
      from: maintainer,
    });
    let listResult = await collateralWhitelistInstance.getWhitelist.call();
    assert.equal(listResult.length, 1, 'Wrong number of collaterals');
    assert.equal(
      listResult[0],
      secondCollateralToAdd,
      'Wrong collateral in the withelist',
    );
    await collateralWhitelistInstance.removeFromWhitelist(
      secondCollateralToAdd,
      {
        from: maintainer,
      },
    );
    listResult = await collateralWhitelistInstance.getWhitelist.call();
    assert.equal(listResult.length, 0, 'Wrong number of collaterals');
    await collateralWhitelistInstance.addToWhitelist(collateralToAdd, {
      from: maintainer,
    });
    listResult = await collateralWhitelistInstance.getWhitelist.call();
    assert.equal(listResult.length, 1, 'Wrong number of collaterals');
    assert.equal(
      listResult[0],
      collateralToAdd,
      'Wrong collateral in the withelist',
    );
    await collateralWhitelistInstance.addToWhitelist(secondCollateralToAdd, {
      from: maintainer,
    });
    listResult = await collateralWhitelistInstance.getWhitelist.call();
    assert.equal(listResult.length, 2, 'Wrong number of collaterals');
    assert.equal(
      listResult[1],
      secondCollateralToAdd,
      'Wrong collateral in the withelist',
    );
  });
});

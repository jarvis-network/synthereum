const Finder = artifacts.require('SynthereumFinder');

const web3Utils = require('web3-utils');

const truffleAssert = require('truffle-assertions');

contract('Finder', function (accounts) {
  const maintainer = accounts[1];
  const sender = accounts[5];

  it('General methods', async function () {
    const finder = await Finder.deployed();

    const interfaceName1 = web3Utils.utf8ToHex('interface1');
    const interfaceName2 = web3Utils.utf8ToHex('interface2');
    const implementationAddress1 = web3Utils.toChecksumAddress(
      web3Utils.randomHex(20),
    );
    const implementationAddress2 = web3Utils.toChecksumAddress(
      web3Utils.randomHex(20),
    );
    const implementationAddress3 = web3Utils.toChecksumAddress(
      web3Utils.randomHex(20),
    );
    // Random users cannot change the implementation address.
    await truffleAssert.reverts(
      finder.changeImplementationAddress(
        interfaceName1,
        implementationAddress1,
        { from: sender },
      ),
    );

    // Looking up unknown interfaces fails.
    await truffleAssert.reverts(
      finder.getImplementationAddress(interfaceName1),
    );

    // Can set and then find an interface.
    await finder.changeImplementationAddress(
      interfaceName1,
      implementationAddress1,
      { from: maintainer },
    );
    assert.equal(
      await finder.getImplementationAddress(interfaceName1, {
        from: maintainer,
      }),
      implementationAddress1,
    );

    // Supports multiple interfaces.
    await finder.changeImplementationAddress(
      interfaceName2,
      implementationAddress2,
      { from: maintainer },
    );
    assert.equal(
      await finder.getImplementationAddress(interfaceName1),
      implementationAddress1,
    );
    assert.equal(
      await finder.getImplementationAddress(interfaceName2),
      implementationAddress2,
    );

    // Can reset and then find an interface.
    const result = await finder.changeImplementationAddress(
      interfaceName1,
      implementationAddress3,
      { from: maintainer },
    );
    truffleAssert.eventEmitted(result, 'InterfaceImplementationChanged', ev => {
      return (
        ev.interfaceName === web3Utils.padRight(interfaceName1, 64) &&
        ev.newImplementationAddress === implementationAddress3
      );
    });
    assert.equal(
      await finder.getImplementationAddress(interfaceName1),
      implementationAddress3,
    );
    assert.equal(
      await finder.getImplementationAddress(interfaceName2),
      implementationAddress2,
    );
  });
});

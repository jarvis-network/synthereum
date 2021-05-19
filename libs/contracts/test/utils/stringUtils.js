const truffleAssert = require('truffle-assertions');
const Utils = artifacts.require('UtilsMock');

contract('String utils', accounts => {
  let testString = 'String for test';
  let testBytes = web3.utils.rightPad(web3.utils.stringToHex(testString), 64);
  console.log();
  beforeEach(async () => {
    utilsMock = await Utils.new();
  });
  describe('From string to bytes32', async () => {
    it('Can convert from string to bytes32', async () => {
      const bytesResult = await utilsMock.stringToBytes32.call(testString);
      assert.equal(bytesResult, testBytes, 'Wrong 32bytes output');
    });
    it('Can convert null string to 0x bytes', async () => {
      const bytesResult = await utilsMock.stringToBytes32.call('');
      assert.equal(
        bytesResult,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        'Wrong zero bytes output',
      );
    });
    it('Revert if string is longer than 32 bytes', async () => {
      const overflowString =
        'Overflow string for testing correct revert of stringToBytes32 transaction';
      await truffleAssert.reverts(
        utilsMock.stringToBytes32.call(overflowString),
        'Bytes length bigger than 32',
      );
    });
  });
  describe('From bytes32 to string', async () => {
    it('Can convert from bytes32 to string', async () => {
      const stringResult = await utilsMock.bytes32ToString.call(testBytes);
      assert.equal(stringResult, testString, 'Wrong string output');
    });
  });
});

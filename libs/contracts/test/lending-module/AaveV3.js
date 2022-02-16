const { artifacts, contract } = require('hardhat');
const { assert } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const Web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const LendingModule = artifacts.require('AaveV3Module');
const PoolMock = artifacts.require('PoolLendingMock');

contract('AaveV3 Lending module', accounts => {
  let poolMock;
  let module;

  before(async () => {
    poolMock = await PoolMock.new();
    module = await LendingModule.new();
  });
});

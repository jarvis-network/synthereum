const { constants } = require('@openzeppelin/test-helpers');
const config = require('../truffle-config.js');
const contracts = require('../contract-dependencies.json');
var TICFactory = artifacts.require('TICFactory');
const rolesConfig = require('../roles.json');

module.exports = function (deployer, network) {
  let ExpiringMultiPartyCreatorAddr = constants.ZERO_ADDRESS;

  const networkId = config.networks[network.replace(/-fork$/, '')].network_id;

  ExpiringMultiPartyCreatorAddr =
    contracts[networkId]['expiringMultiPartyCreator'];

  const factoryRoles = {
    admin: rolesConfig[networkId].admin,
    maintainer: rolesConfig[networkId].maintainer,
  };

  deployer.deploy(TICFactory, factoryRoles, ExpiringMultiPartyCreatorAddr);
};

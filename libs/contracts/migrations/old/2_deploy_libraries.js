var TICHelper = artifacts.require('TICHelper');
var TIC = artifacts.require('TIC');
var TICFactory = artifacts.require('TICFactory');

module.exports = function (deployer, network) {
  deployer.deploy(TICHelper);
  deployer.link(TICHelper, [TIC, TICFactory]);
};

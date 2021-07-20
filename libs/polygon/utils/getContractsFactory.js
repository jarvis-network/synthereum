module.exports = function getContractsFactory(migrate, contracts) {
  migrate.getContracts = function getContracts(artifacts) {
    if (artifacts) {
      const map = {};
      for (const contract of contracts) {
        const toRequire = contract.includes(':')
          ? contract.split(':')[1]
          : contract.includes('/')
          ? contract.split('/').reverse()[0]
          : contract;
        map[toRequire] = artifacts.require(toRequire);
      }

      return map;
    }

    return contracts;
  };

  return migrate;
};

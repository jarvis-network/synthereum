module.exports = function getContractsFactory(migrate, contracts) {
  migrate.getContracts = function getContracts(artifacts) {
    if (artifacts) {
      const map = {};
      for (const contract of contracts) {
        map[contract] = artifacts.require(contract);
      }

      return map;
    }

    return contracts;
  };

  return migrate;
};

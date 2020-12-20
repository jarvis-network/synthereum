const result = require('@jarvis-network/uma-common').getTruffleConfig(
  __dirname,
);
result.compilers.solc.settings.optimizer.runs = 200;
module.exports = result;

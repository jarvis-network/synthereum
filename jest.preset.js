const nxPreset = require('@nrwl/jest/preset');

module.exports = {
  ...nxPreset,
  globals: {
    Uint8Array: Uint8Array,
  },
};

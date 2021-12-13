// eslint-disable-next-line @typescript-eslint/no-var-requires
const withNx = require('@nrwl/next/plugins/with-nx');

module.exports = withNx({
  nx: {
    // SVGR is disabled (https://github.com/nrwl/nx/pull/6634)
    // in favor of next/image (https://nextjs.org/docs/basic-features/image-optimization)
    svgr: false,
  },
});

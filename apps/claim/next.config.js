const withPWA = require('next-pwa');

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(
  withPWA({
    pwa: {
      disable: process.env.NODE_ENV === 'development',
      register: true,
      dest: 'public',
      scope: '/',
    },
    webpack: (config, { webpack }) => {
      config.module.rules.push({
        test: /\.md$/,
        use: 'raw-loader',
      });
      // TODO: Upgrade to Next.js 10 / Webpack 5 to use this PR:
      // https://github.com/webpack/webpack/pull/11316
      config.plugins.push(new webpack.IgnorePlugin(/dotenv/));

      return config;
    },
  }),
);

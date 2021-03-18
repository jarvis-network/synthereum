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
    webpack: config => {
      config.module.rules.push({
        test: /\.md$/,
        use: 'raw-loader',
      });

      return config;
    },
  }),
);

const withPWA = require('next-pwa');

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(withPWA({
  pwa: {
    disable: false,
    register: true,
    dest: "public",
    scope: "/"
  }
}));

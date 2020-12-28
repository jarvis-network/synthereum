module.exports = {
  branches: ['meta-tx-lib'],
  tagFormat: 'v${version}-wu',
  debug: true,
  preset: 'angular',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',

    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'libs/web3-utils/CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['libs/web3-utils/**', 'package.json'],

        message:
          'chore(release): @jarvis-network/web3-utils ${nextRelease.version} [skip ci]  release notes\n\n${nextRelease.notes}',
      },
    ],
  ],
  extends: ['semantic-release-commit-filter'],
};

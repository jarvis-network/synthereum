module.exports = {
  branches: ['dev', 'meta-tx-lib'],
  tagFormat: 'v${version}-validator',
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
        changelogFile: 'CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: './release.sh --prepare ${nextRelease.version}',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],

        message:
          'chore(release): @jarvis-network/validator ${nextRelease.version} [skip ci] release notes\n\n${nextRelease.notes}',
      },
    ],
  ],
  extends: ['semantic-release-commit-filter'],
};

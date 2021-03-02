module.exports = {
  stories: ['../src/**/*.stories.tsx'],
  addons: [
    '@storybook/preset-create-react-app',
    '@storybook/addon-actions',
    '@storybook/addon-links',
    '@storybook/addon-storysource',
    '@storybook/addon-knobs',
    '@storybook/addon-backgrounds/register',
    '@storybook/addon-viewport/register',
  ],
  webpackFinal: config => ({
    ...config,
    performance: {
      hints: false,
    },
  }),
};

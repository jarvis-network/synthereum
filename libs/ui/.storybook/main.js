const path = require('path');
const ROOT = path.resolve(__dirname, '../');
const SRC = `${ROOT}/src`;

module.exports = {
  stories: ['../src/**/*.stories.[tj]sx'],
  addons: [
    '@storybook/preset-create-react-app',
    '@storybook/addon-actions',
    '@storybook/addon-links',
    '@storybook/addon-storysource',
    '@storybook/addon-knobs',
    '@storybook/addon-backgrounds/register',
    '@storybook/addon-viewport/register',
  ],
  webpackFinal: async config => {
    config.module.rules.push(...config.module.rules);
    config.module.rules.push(
      {
        test: /\.tsx?$/,
        loader: require.resolve('babel-loader'),
      },
      {
        test: /\.stories\.tsx?$/,
        loaders: [
          {
            loader: require.resolve('@storybook/source-loader'),
            options: { parser: 'typescript' },
          },
        ],
        enforce: 'pre',
      },
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'source-map-loader',
      },
      {
        test: /\.css$/i,
        use: ['css-loader'],
      },
      {
        test: /\.jpe?g$|\.gif$|\.png$|\.svg$|\.woff$|\.ttf$|\.eot$/,
        loader: 'file-loader',
        options: {
          outputPath: 'assets',
          publicPath: 'assets',
        },
      },
    );

    config.resolve.extensions.push('.tsx', '.ts', '.js');
    config.resolve.modules.push(SRC, 'node_modules');

    return config;
  },
};

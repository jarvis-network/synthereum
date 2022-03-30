module.exports = {
  stories: ['../src/**/*.stories.@(tsx|jsx)'],
  features: { emotionAlias: false },
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
    config.module.rules.push(
      {
        test: /\.css$/i,
        use: ['css-loader'],
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
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
    return config;
  },
};

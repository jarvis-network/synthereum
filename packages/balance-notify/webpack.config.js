const { resolve } = require('path');

module.exports = {
  target: 'node',
  mode: 'development',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    enforceExtension: false
  },
  optimization: {
    minimize: false,
  },
  context: resolve(__dirname, '.'),
  output: {
    libraryTarget: 'commonjs2',
    filename: 'index.js',
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)?$/,
        loader: 'babel-loader',
      },
    ],
  },
  externals: {
    electron: 'electron',
  },
};

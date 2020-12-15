const { resolve } = require('path');

module.exports = {
  target: 'node',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
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

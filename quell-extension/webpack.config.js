const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {    
    background: './src/pages/Background/index.js',
    devtools: './src/pages/Devtools/index.js',
    panel: '/src/pages/Panel/index.jsx',
  },
  output: {
    path: path.join(__dirname, '/dist'),
    filename: '[name].bundle.js',
    clean: true,
  },
  devServer: {
    port: 3000,
    static: {
      directory: path.join(__dirname, 'src', 'pages', 'Panel'),
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        }
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ]
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: path.join(__dirname, './dist'),
          force: true,
          transform: function (content, path) {
            // generates the manifest file using the package.json informations
            return Buffer.from(
              JSON.stringify({
                description: process.env.npm_package_description,
                version: process.env.npm_package_version,
                ...JSON.parse(content.toString()),
              })
            );
          },
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: './src/pages/Devtools/index.html',
      filename: 'devtools.html',
      chunks: ['devtools'],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: './src/pages/Panel/index.html',
      filename: 'panel.html',
      chunks: ['panel'],
      cache: false,
    }),
  ],
};
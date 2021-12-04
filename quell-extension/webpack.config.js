const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    background: './src/pages/Background/index.tsx',
    devtools: './src/pages/Devtools/index.tsx',
    panel: '/src/pages/Panel/index.tsx',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.scss'],
  },
  output: {
    path: path.join(__dirname, '/dist'),
    filename: '[name].bundle.js',
    clean: true,
  },
  devServer: {
    port: 3030,
    static: {
      directory: path.join(__dirname, 'src', 'pages', 'Panel'),
    },
    proxy: {
      '/graphql': {
        target: 'http://localhost:3000',
        secure: false,
      },
      '/clearCache': {
        target: 'http://localhost:3000',
        secure: false,
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      },
      {
        test: /\.(js|ts)x?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.(css|scss)$/,
        use: [
          'style-loader',
          'css-modules-typescript-loader',
          'css-loader',
          'sass-loader',
        ],
      },
      {
        test: /\.(jpg|png)$/,
        use: {
          loader: 'url-loader',
        }
      }
    ],
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
        {
          from: 'src/pages/Panel/assets',
          to: path.join(__dirname, './dist/assets'),
          force: true
        }
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

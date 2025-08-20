const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  target: "node",
  mode: "none",
  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
  },
  externals: {
    vscode: "commonjs vscode",
    "heic-convert": "commonjs heic-convert",
    sharp: "commonjs sharp",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  devtool: "nosources-source-map",
  infrastructureLogging: {
    level: "log",
  },
  plugins: [
    // Copy node_modules to dist
    new CopyPlugin({
      patterns: [
        {
          from: "node_modules/heic-convert",
          to: "node_modules/heic-convert",
        },
        {
          from: "node_modules/sharp",
          to: "node_modules/sharp",
        },
        // Include sharp's binary dependencies
        {
          from: "node_modules/@img",
          to: "node_modules/@img",
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
};

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
    // vscode is always external
    vscode: "commonjs vscode",
    // sharp is a native module, so it's best to keep it external
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
    // Copy only the node_modules that need to be external
    new CopyPlugin({
      patterns: [
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

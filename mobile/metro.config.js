const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force packages that ship Node.js code to use their browser builds
const browserOverrides = {
  jose: path.dirname(require.resolve("jose/package.json")) + "/dist/browser/index.js",
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (browserOverrides[moduleName]) {
    return {
      filePath: browserOverrides[moduleName],
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

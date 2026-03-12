module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@shared": "./shared",
            "@": "./",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};

module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated debe ir de último. expo-router ya está cubierto por babel-preset-expo.
    plugins: ['react-native-reanimated/plugin'],
  }
}

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch the parent directory (the library source)
config.watchFolders = [path.resolve(__dirname, '..')];

// Resolve modules from both example and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '..', 'node_modules'),
];

module.exports = config;

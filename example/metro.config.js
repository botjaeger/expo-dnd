const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const libraryRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch ../src so Metro can resolve imports from the library source
config.watchFolders = [path.resolve(libraryRoot, 'src')];

// ONLY resolve from example/node_modules — never touch root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = config;

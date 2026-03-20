const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the library source for changes
config.watchFolders = [monorepoRoot];

// Resolve node_modules from both locations (hoisted root takes priority)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Prevent duplicate React/Reanimated instances
config.resolver.disableHierarchicalLookup = true;

module.exports = config;

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the parent directory for library source changes
config.watchFolders = [monorepoRoot];

// Block docs and docs/node_modules to avoid conflicts (but NOT root node_modules)
config.resolver.blockList = [
  new RegExp(path.resolve(monorepoRoot, 'docs') + '/.*'),
];

// Resolve all modules from example/node_modules first.
// This ensures react, react-native, reanimated, gesture-handler
// all come from one place — no duplicates.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// For packages that the library source imports (peer deps),
// force them to resolve from example/node_modules even when
// Metro follows the symlink into the root directory.
const exampleNodeModules = path.resolve(projectRoot, 'node_modules');
const peerDeps = fs.readdirSync(exampleNodeModules)
  .filter(name => !name.startsWith('.'))
  .reduce((acc, name) => {
    if (name.startsWith('@')) {
      // Scoped packages
      const scopeDir = path.join(exampleNodeModules, name);
      fs.readdirSync(scopeDir).forEach(pkg => {
        acc[`${name}/${pkg}`] = path.join(scopeDir, pkg);
      });
    } else {
      acc[name] = path.join(exampleNodeModules, name);
    }
    return acc;
  }, {});

config.resolver.extraNodeModules = peerDeps;

module.exports = config;

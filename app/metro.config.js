// Metro config monorepo-aware para pnpm.
// Permite que Metro resuelva @vaulto/shared (y cualquier dependencia hoisted)
// desde la raíz del workspace, no solo desde app/node_modules.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// 1. Vigilar toda la raíz del monorepo (para hot-reload de packages/*).
config.watchFolders = [workspaceRoot]

// 2. Resolver módulos desde app/ y desde la raíz del workspace.
//    Con node-linker=hoisted (ver .npmrc raíz) las deps quedan en node_modules
//    de la raíz; estas rutas cubren ambos niveles. Se mantiene la búsqueda
//    jerárquica por defecto, coherente con el layout hoisted.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// 3. Web: @powersync/react-native arrastra op-sqlite (solo nativo). Se cambia
//    por un shim sobre @powersync/web, forzando su build para React Native Web,
//    que acepta la URL del worker copiado a public/ en vez de import.meta.url.
const webAliases = {
  '@powersync/react-native': path.resolve(projectRoot, 'src/lib/powersync/web.ts'),
  '@powersync/web': path.resolve(workspaceRoot, 'node_modules/@powersync/web/dist/index.react_native_web.js'),
}
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webAliases[moduleName]) {
    return { type: 'sourceFile', filePath: webAliases[moduleName] }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config

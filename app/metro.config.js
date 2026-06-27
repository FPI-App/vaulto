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

module.exports = config

import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { Redirect } from 'expo-router'
import { PowerSyncDatabase } from '@powersync/react-native'
import { AppSchema } from '@vaulto/shared/powersync'
import { CATEGORIAS_POR_DEFECTO, COLORES_CATEGORIA } from '@vaulto/shared/domain'
import * as Crypto from 'expo-crypto'
import { Directory, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'

import { DatabaseKeys } from '@/lib/db/databaseKeys'
import { crearCategoria, actualizarCategoria, eliminarCategoria, sembrarCategoriasPorDefecto } from '@/features/categorias/data/categoriasRepo'
import { SELECT_CATEGORIAS, SELECT_CATEGORIA_HISTORICA } from '@/features/categorias/data/categoriasQueries'

/** Fixture local aislado: usa el mismo repositorio y driver nativo que la app. */
export default function CategoriesQA() {
  const started = useRef(false)
  const [report, setReport] = useState<Record<string, unknown>>({ status: 'waiting' })
  useEffect(() => {
    if (!__DEV__ || started.current) return
    started.current = true
    let stage = 'fixture'
    const run = async () => {
      const user = Crypto.randomUUID()
      const space = Crypto.randomUUID()
      const foreign = Crypto.randomUUID()
      const options = { keychainService: 'vaulto.qa.categories' }
      const keys = new DatabaseKeys({ get: (key) => SecureStore.getItemAsync(key, options), set: (key, value) => SecureStore.setItemAsync(key, value, options) }, () => Crypto.getRandomBytesAsync(32))
      const encryptionKey = await keys.getOrCreate(user, false)
      const directory = new Directory(Paths.document, `qa-categories-${user}`)
      directory.create({ intermediates: true })
      const db = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: 'categories.sqlite', dbLocation: decodeURIComponent(new URL(directory.uri).pathname), sqliteOptions: { encryptionKey } } })
      await db.init()
      try {
        stage = 'seed'
        const seeded = await sembrarCategoriasPorDefecto(db, space)
        if (seeded !== CATEGORIAS_POR_DEFECTO.length || await sembrarCategoriasPorDefecto(db, space) !== 0) throw Error()
        stage = 'crud'
        const id = await crearCategoria(db, space, 'egreso', { nombre: 'QA nativa', icono: 'house', color: COLORES_CATEGORIA[0] })
        await actualizarCategoria(db, space, id, { nombre: 'QA editada', icono: 'house', color: COLORES_CATEGORIA[1] })
        const active = await db.getAll<{ id: string; nombre: string }>(SELECT_CATEGORIAS, [space, 'egreso'])
        if (!active.some((row) => row.id === id && row.nombre === 'QA editada')) throw Error()
        stage = 'space-isolation'
        let rejected = false
        try { await eliminarCategoria(db, foreign, id) } catch { rejected = true }
        if (!rejected || (await db.getAll(SELECT_CATEGORIAS, [foreign, 'egreso'])).length !== 0) throw Error()
        stage = 'soft-delete'
        await eliminarCategoria(db, space, id)
        if ((await db.getAll<{ id: string }>(SELECT_CATEGORIAS, [space, 'egreso'])).some((row) => row.id === id)) throw Error()
        const history = await db.getOptional<{ nombre: string }>(SELECT_CATEGORIA_HISTORICA, [id, space])
        if (history?.nombre !== 'QA editada') throw Error()
        const queue = await db.getOptional<{ n: number }>('SELECT count(*) AS n FROM ps_crud')
        if (!queue || queue.n < seeded + 3) throw Error()
        return { status: 'passed', native: 'Android SQLCipher + PowerSync', seedCount: seeded, seedIdempotent: true, crud: true, spaceIsolation: true, softDelete: true, historicalCategory: true, pendingCrud: queue.n }
      } finally { await db.close() }
    }
    void run().then(setReport).catch(() => setReport({ status: 'failed', stage }))
  }, [])
  if (!__DEV__) return <Redirect href="/(auth)/login" />
  return <View style={{ flex: 1, padding: 32, justifyContent: 'center' }}><Text>{JSON.stringify(report)}</Text></View>
}

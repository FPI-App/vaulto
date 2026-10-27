// Lista de movimientos con filtros (issue #10). Dueño: lmilo (Track A).
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native'
import {
  formatCOP,
  rangoDeMes,
  resumenMovimientos,
  signoMovimiento,
  type TipoMovimiento,
} from '@vaulto/shared'

import { Button } from '@/components/Button'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Chips } from '@/components/Chips'
import { EmptyState } from '@/components/EmptyState'
import { Screen } from '@/components/Screen'
import { useCategorias } from '@/features/categorias/data/useCategorias'
import { useCuentas } from '@/features/cuentas/data/useCuentas'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

import { useMovimientos, type MovimientoListado } from './data/useMovimientos'
import { claveDia, etiquetaDia, parseFecha } from './fechas'

type Periodo = 'mes' | 'mes_anterior' | 'todo'
type FiltroTipo = 'todos' | TipoMovimiento
const TODAS = '__todas__'

export function MovimientosScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { espacioId } = useEspacioActual()
  const { cuentas } = useCuentas(espacioId)

  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [cuentaId, setCuentaId] = useState<string>(TODAS)
  const [categoriaId, setCategoriaId] = useState<string>(TODAS)
  // El filtro de categoría solo aplica a gastos o ingresos (las transferencias no tienen).
  const tipoConCategoria = tipo === 'ingreso' || tipo === 'egreso' ? tipo : null
  const { categorias } = useCategorias(espacioId, tipoConCategoria ?? 'egreso')

  const rango = useMemo(() => {
    if (periodo === 'todo') return { desde: null, hasta: null }
    return rangoDeMes(new Date(), periodo === 'mes' ? 0 : -1)
  }, [periodo])

  const cuentaFiltro = cuentaId === TODAS ? null : cuentaId
  const categoriaFiltro = tipoConCategoria && categoriaId !== TODAS ? categoriaId : null
  const { movimientos, cargando } = useMovimientos(espacioId, {
    tipo: tipo === 'todos' ? null : tipo,
    cuentaId: cuentaFiltro,
    categoriaId: categoriaFiltro,
    ...rango,
  })

  const resumen = useMemo(() => resumenMovimientos(movimientos, cuentaFiltro), [movimientos, cuentaFiltro])
  const secciones = useMemo(() => agruparPorDia(movimientos), [movimientos])

  const hayFiltros = periodo !== 'todo' || tipo !== 'todos' || cuentaFiltro !== null || categoriaFiltro !== null

  return (
    <Screen>
      <View style={styles.header}>
        <Text
          style={{
            ...theme.typography.scale.h1,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.text,
          }}
        >
          Movimientos
        </Text>
        <View style={styles.headerAcciones}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/categorias')}
            hitSlop={8}
            style={{ minHeight: theme.layout.minTouchTarget, justifyContent: 'center' }}
          >
            <Text style={{ ...theme.typography.scale.label, fontFamily: theme.typography.fontFamily, color: theme.colors.textMuted }}>Categorías</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/movimientos/nuevo')}
            hitSlop={8}
            style={{ minHeight: theme.layout.minTouchTarget, justifyContent: 'center' }}
          >
            <Text style={{ ...theme.typography.scale.label, fontFamily: theme.typography.fontFamily, color: theme.colors.brand[600] }}>+ Nuevo</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: theme.space.sm, marginBottom: theme.space.md }}>
        <Chips<Periodo>
          accessibilityLabel="Periodo"
          value={periodo}
          onChange={setPeriodo}
          options={[
            { value: 'mes', label: 'Este mes' },
            { value: 'mes_anterior', label: 'Mes pasado' },
            { value: 'todo', label: 'Todo' },
          ]}
        />
        <Chips<FiltroTipo>
          accessibilityLabel="Tipo de movimiento"
          value={tipo}
          onChange={(nuevo) => {
            setTipo(nuevo)
            setCategoriaId(TODAS)
          }}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'egreso', label: 'Gastos' },
            { value: 'ingreso', label: 'Ingresos' },
            { value: 'transferencia', label: 'Transferencias' },
          ]}
        />
        {cuentas.length > 1 ? (
          <Chips
            accessibilityLabel="Cuenta"
            value={cuentaId}
            onChange={setCuentaId}
            options={[{ value: TODAS, label: 'Todas las cuentas' }, ...cuentas.map((c) => ({ value: c.id, label: c.nombre }))]}
          />
        ) : null}
        {tipoConCategoria && categorias.length > 0 ? (
          <Chips
            accessibilityLabel="Categoría"
            value={categoriaId}
            onChange={setCategoriaId}
            options={[{ value: TODAS, label: 'Todas las categorías' }, ...categorias.map((c) => ({ value: c.id, label: c.nombre }))]}
          />
        ) : null}
      </View>

      <SectionList
        sections={secciones}
        keyExtractor={(m) => m.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: theme.space['4xl'] }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          movimientos.length > 0 ? (
            <View
              style={[
                styles.resumen,
                { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderColor: theme.colors.border },
              ]}
            >
              <Total etiqueta="Entradas" valor={resumen.entradas} color={theme.colors.financial.income} />
              <Total etiqueta="Salidas" valor={resumen.salidas} color={theme.colors.financial.expense} />
              <Total etiqueta="Neto" valor={resumen.neto} color={theme.colors.text} />
            </View>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <Text
            style={{
              ...theme.typography.scale.label,
              fontFamily: theme.typography.fontFamily,
              color: theme.colors.textMuted,
              marginTop: theme.space.md,
              marginBottom: theme.space.xs,
            }}
          >
            {section.titulo}
          </Text>
        )}
        renderItem={({ item }) => (
          <FilaMovimiento
            mov={item}
            cuentaFiltro={cuentaFiltro}
            onPress={() => router.push(`/movimientos/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          cargando ? undefined : (
            <View style={styles.emptyWrap}>
              <EmptyState
                title={hayFiltros ? 'Nada con estos filtros' : 'Sin movimientos todavía'}
                hint={
                  hayFiltros
                    ? 'Prueba con otro periodo o quita el filtro de cuenta o tipo.'
                    : 'Registra tu primer gasto, ingreso o transferencia.'
                }
                action={<Button label="Registrar movimiento" onPress={() => router.push('/movimientos/nuevo')} />}
              />
            </View>
          )
        }
      />
    </Screen>
  )
}

function Total({ etiqueta, valor, color }: { etiqueta: string; valor: string; color: string }) {
  const theme = useTheme()
  return (
    <View style={styles.total}>
      <Text style={{ ...theme.typography.scale.caption, color: theme.colors.textMuted }}>{etiqueta}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          ...theme.typography.scale.bodyLg,
          fontWeight: theme.typography.weights.semibold,
          fontFamily: theme.typography.fontFamily,
          color,
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatCOP(valor)}
      </Text>
    </View>
  )
}

function FilaMovimiento({
  mov,
  cuentaFiltro,
  onPress,
}: {
  mov: MovimientoListado
  cuentaFiltro: string | null
  onPress: () => void
}) {
  const theme = useTheme()
  const signo = signoMovimiento(mov, cuentaFiltro)
  const esTransferencia = mov.tipo === 'transferencia'

  const titulo = esTransferencia
    ? 'Transferencia'
    : (mov.categoria_nombre ?? (mov.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'))
  const detalle = esTransferencia
    ? `${mov.cuenta_nombre ?? 'Cuenta eliminada'} → ${mov.cuenta_destino_nombre ?? 'Cuenta eliminada'}`
    : [mov.cuenta_nombre ?? 'Cuenta eliminada', mov.nota].filter(Boolean).join(' · ')
  const color =
    signo === 1 ? theme.colors.financial.income : signo === -1 ? theme.colors.financial.expense : theme.colors.text
  const prefijo = signo === 1 ? '+' : signo === -1 ? '−' : ''

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={mov.pago_id ? 'Abono de deuda, solo lectura' : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fila,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <CategoriaIcon
        icono={esTransferencia ? 'banknote' : mov.categoria_icono}
        color={esTransferencia ? theme.colors.textMuted : mov.categoria_color}
      />
      <View style={styles.filaTexto}>
        <Text
          numberOfLines={1}
          style={{
            ...theme.typography.scale.bodyLg,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.text,
          }}
        >
          {titulo}
        </Text>
        <Text numberOfLines={1} style={{ ...theme.typography.scale.caption, color: theme.colors.textMuted }}>
          {detalle}
        </Text>
      </View>
      <Text
        style={{
          ...theme.typography.scale.bodyLg,
          fontWeight: theme.typography.weights.semibold,
          fontFamily: theme.typography.fontFamily,
          color,
          fontVariant: ['tabular-nums'],
        }}
      >
        {prefijo}
        {formatCOP(mov.monto, mov.currency)}
      </Text>
    </Pressable>
  )
}

interface SeccionDia {
  titulo: string
  data: MovimientoListado[]
}

/** La lista ya viene ordenada por fecha desc: basta cortar cuando cambia el día local. */
function agruparPorDia(movs: MovimientoListado[]): SeccionDia[] {
  const secciones: SeccionDia[] = []
  let claveActual = ''
  for (const m of movs) {
    const fecha = parseFecha(m.fecha)
    const clave = claveDia(fecha)
    if (clave !== claveActual) {
      secciones.push({ titulo: etiquetaDia(fecha), data: [] })
      claveActual = clave
    }
    secciones[secciones.length - 1]!.data.push(m)
  }
  return secciones
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  headerAcciones: { flexDirection: 'row', gap: 20 },
  resumen: { flexDirection: 'row', padding: 16, gap: 12, borderWidth: 1, marginBottom: 4 },
  total: { flex: 1, gap: 2 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  filaTexto: { flex: 1, gap: 2 },
  emptyWrap: { minHeight: 320 },
})

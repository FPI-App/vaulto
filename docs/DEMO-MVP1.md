# Guion de demostración del MVP1 (Android)

Duración aproximada: 12 minutos. Solo datos sintéticos. Evidencia del recorrido ejecutado: `validaciones/2026-10-29/e2e-android-autenticado.json`.

## Preparación

- **Backend:** Supabase `pqxvttkyevbkfdhmcmxu` con migraciones 0001–0016 y PowerSync configurado con `supabase/sync_rules.yaml`.
- **APK:** perfil EAS `preview` (`app/eas.json`), APK standalone sin Metro que usa las variables públicas del entorno EAS `preview`. Instalar en **dos teléfonos Android reales**. En el PC de QA, Avast Web/Mail Shield intercepta TLS y el emulador rechaza esos certificados; ahí se usa el APK de desarrollo con la pasarela QA (ver `VALIDACION-PRIORIDADES-2026-10-29.md`).
- **Cuentas:** usuarios sintéticos confirmados. Sus credenciales se guardan en `.cache/qa/cuentas-qa.json` y nunca se proyectan ni se comparten por chat. Para una demo limpia, crear usuarios nuevos (Supabase → Authentication → Add user → Auto Confirm).
- Llamaremos T1 y T2 a los dos teléfonos.

## 1. Login y onboarding (T1)

1. Abrir Vaulto, introducir el correo y la contraseña del usuario A y tocar **Entrar**.
2. Configuración inicial: Nombre `Ana`, Apellido `Demo`, usuario `anademo`, y tocar **Comenzar**.
3. Se muestra Inicio con los 4 KPIs en cero: Disponible, Me deben, Debo y Próximos vencimientos.

## 2. Cuentas y categorías (T1)

1. **Cuentas → Crear tu primera cuenta:** tipo Banco, `Ahorros Demo`, banco `Banco Demo`, saldo inicial `1000000`.
2. **+ Nueva:** tipo Efectivo, `Billetera`, saldo inicial `200000`. El total disponible es $1.200.000.
3. **Movimientos → Categorías:** se muestran las 15 categorías sugeridas. Abrir `Mercado`, renombrarla a `Supermercado` y tocar **Guardar cambios**.

## 3. Movimientos (T1)

Desde **Inicio → Registrar movimiento**:

| Tipo | Monto | Cuenta | Categoría / destino |
|---|---|---|---|
| Ingreso | 500000 | Ahorros Demo | Salario |
| Gasto | 80000 | Billetera | Supermercado |
| Transferencia | 150000 | Ahorros Demo | → Billetera |

Saldos esperados: Ahorros Demo $1.350.000, Billetera $270.000 y Disponible $1.620.000.

## 4. Segundo dispositivo (T2)

1. Iniciar sesión con el mismo usuario A. **No** aparece el onboarding: la app espera el primer sync y muestra Disponible $1.620.000 en 2 cuentas.
2. En **Movimientos → Categorías**, `Supermercado` ya aparece renombrada.

## 5. Deudas y abonos offline, con rechazo (T1 + T2)

1. En T1: **Deudas → + Nueva**, Yo debo, `Laura QA`, monto `100`, fecha límite dentro de 2–3 semanas, y tocar **Crear deuda**. En T2, Inicio muestra Debo $100 y el vencimiento.
2. Activar el **modo avión** en T1 y en T2.
3. En cada teléfono, abrir la deuda, introducir `60` en Registrar abono y tocar **Aplicar abono**. Los dos muestran saldo $40.
4. Cerrar Vaulto por completo en T1 y volver a abrirla sin conexión: el abono y el KPI Debo $40 se conservan.
5. Desactivar el modo avión **solo en T1**. Su abono se sincroniza.
6. Desactivar el modo avión en T2. El servidor rechaza el segundo abono porque superaría el principal. Arriba aparece: «Hay cambios que requieren revisión…» → **Revisar abono pendiente**. Si el aviso no aparece en unos segundos, cerrar y reabrir la app (ver observaciones).
7. Tocar **Anular abono**. El aviso desaparece y el historial de T2 muestra solo el abono de T1.
8. En T2, registrar un gasto de `20000` desde Billetera: sincroniza con normalidad y Disponible queda en $1.600.000 en los dos teléfonos.

## 6. Deuda saldada y dashboard (T1 + T2)

1. Dejar T2 en **Inicio**.
2. En T1, abrir `Laura QA`, abonar `40` y tocar **Aplicar abono**. Aparecen «Deuda saldada» y saldo $0.
3. Sin tocar T2, su Inicio se actualiza: Debo $0 y «No tienes deudas por vencer».

## Comprobación opcional en el servidor (operador)

Consulta de solo lectura con `supabase db query --linked`: 1 deuda `0.00/saldada`, pagos 60 + 40 sin duplicados, y en `private.vaulto_sync_lote` lotes `applied` más 1 `cancelled`.

## Límites conocidos

- Solo Android. iOS queda fuera del alcance.
- No hay UI para invitar miembros. El aislamiento y la revocación se demostraron con membresías sintéticas creadas por SQL administrativo autorizado.
- Tras reconectar, el reintento de un lote rechazado puede necesitar reabrir la app; está en investigación.

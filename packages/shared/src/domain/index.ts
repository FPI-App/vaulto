// Reglas de dominio puras de Vaulto.
//
// Sin dependencias de app, red ni base de datos: funciones testeables en aislamiento.
// Aquí viven los cálculos que NO deben divergir entre cliente y servidor
// (saldos, dirección de deuda, puente Pago<->Movimiento).

/** Dirección de una deuda. */
export type DireccionDeuda = 'yo_debo' | 'me_deben'

/** Tipo de un movimiento. */
export type TipoMovimiento = 'ingreso' | 'egreso' | 'transferencia' | 'ajuste'

// TODO: implementar al modelar el esquema definitivo (tras el spike de sync).
// export const saldoPendienteDeuda = (valorInicial: number, abonos: number[]): number => ...

// Reglas de dominio puras de Vaulto.
//
// Sin dependencias de app, red ni base de datos: funciones testeables en
// aislamiento. Aquí viven el contrato de integración entre tracks (selectors)
// y los cálculos que NO deben divergir entre cliente y servidor (dinero).
//
// Los enums del dominio (TipoMovimiento, DireccionDeuda, ...) viven en `../types`
// junto a las entidades, porque son parte del esquema, no de la lógica.

export * from './selectors'
export * from './money'
export * from './saldo'

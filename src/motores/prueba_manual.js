const { aplicarFEFO } = require('./motor_fefo');

const misLotes = [
    { id: 1, codigo_lote: 'LOTE-A', cantidad_actual: 5, fecha_caducidad: '2026-02-24', estado_bd: 'ACTIVO' },
    { id: 2, codigo_lote: 'LOTE-B', cantidad_actual: 5, fecha_caducidad: '2026-02-25', estado_bd: 'ACTIVO' },
    { id: 3, codigo_lote: 'LOTE-C', cantidad_actual: 5, fecha_caducidad: '2026-03-01', estado_bd: 'ACTIVO' },
    { id: 4, codigo_lote: 'LOTE-D', cantidad_actual: 5, fecha_caducidad: '2026-03-21', estado_bd: 'ACTIVO' }
];

console.log("--- PRUEBA MANUAL ---");

try {
    console.log("Solicitando 20 unidades...");
    const resultado = aplicarFEFO(misLotes, 20);

    console.log("RESULTADO:");
    console.log("Stock suficiente:", resultado.stockSuficiente);
    console.log("Solicitado:", resultado.cantidadSolicitada);
    console.log("Asignado:", resultado.cantidadAsignada);
    console.log("Faltante:", resultado.cantidadFaltante);

    console.log("Alertas:", resultado.alertas.length > 0 ? resultado.alertas : "Ninguna");
    console.log("Asignaciones:");
    console.log(JSON.stringify(resultado.asignaciones, null, 2));

} catch (error) {
    console.error("ERROR:", error.message);
}
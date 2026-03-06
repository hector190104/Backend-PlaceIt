class MotorEOQ {
    constructor(dbPool) {
        this.dbPool = dbPool;
    }

    async calcularOptimoAutomatico(insumoId, diasAnalisis = 90) {
        const queryInsumo = `
        SELECT nombre, costo_promedio, stock_actual, stock_minimo
        FROM insumos
        WHERE id = $1;`;

        const resInsumo = await this.dbPool.query(queryInsumo, [insumoId]);

        if (resInsumo.rows.length === 0) {
            throw new Error(`Insumo ID ${insumoId} no encontrado.`);
        }
        const insumo = resInsumo.rows[0];

        const queryDemanda =`
        SELECT COALESCE(SUM(cantidad), 0) AS demanda_total
        FROM movimientos
        WHERE insumo_id = $1
        AND tipo_movimiento = 'SALIDA_CONSUMO'
        AND fecha_movimiento >= CURRENT_DATE - $2::INTEGER;`;

        const resDemanda = await this.dbPool.query(queryDemanda, [insumoId, diasAnalisis]);

        const demandaPeriodo = Math.abs(parseFloat(resDemanda.rows[0].demanda_total));
        const demandaDiaria = demandaPeriodo / diasAnalisis;
        const demandaAnual = demandaDiaria * 365;

        //datos a verificar
        const costoPorPedido = 150.00; //reemplazar
        const costoMantenimientoAnual = parseFloat(insumo.costo_promedio) * 0.20;
        const diasEntregaProveedor = 3;

        return this._ejecutarAlgoritmo(
            insumo.nombre,
            demandaAnual,
            demandaDiaria,
            costoPorPedido,
            costoMantenimientoAnual,
            diasEntregaProveedor,
            parseFloat(insumo.stock_minimo),
            parseFloat(insumo.stock_actual)
        );
    }
}
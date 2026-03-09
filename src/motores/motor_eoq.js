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

    simularCostos(parametros) {
        const {
            nombreInsumo = "Insumo Simulado",
            demandaAnualEstimada,
            diasOperacionAnual = 365,
            costoPorPedido,
            costoMantenimientoAnual,
            diasEntregaProveedor,
            stockSeguridad,
            stockActual = 0
        } = parametros;

        const demandaDiaria = demandaAnualEstimada / diasOperacionAnual;

        return this._ejecutarAlgoritmo(
            nombreInsumo,
            demandaAnualEstimada,
            demandaDiaria,
            costoPorPedido,
            costoMantenimientoAnual,
            diasEntregaProveedor,
            stockSeguridad,
            stockActual,
            true
        );
    }

    _ejecutarAlgoritmo(nombre, demandaAnual, demandaDiaria, costoPedido, costoMantenimiento, loadTime, stockSeguridad, stockActual, esSimulacion = false) {
        if (costoMantenimiento <= 0) costoMantenimiento = 1;

        const eoq = Math.sqrt((2 * demandaAnual * costoPedido) / costoMantenimiento);

        const rop = (demandaDiaria * loadTime) + stockSeguridad;

        const requiereCompra = stockActual <= rop;
        let estadoInventario = "OPTIMO";
        if (stockActual <= stockSeguridad) estadoInventario = "CRITICO";
        else if (requiereCompra) estadoInventario = "REABASTECER";

        return {
            tipo_analisis: esSimulacion ? "SIMULACION MANUAL" : "HISTORICO AUTOMATICO",
            insumo: nombre,
            metricas_base: {
                demanda_diaria_estimada: this.redondear(demandaDiaria),
                demanda_anual_estimada: this.redondear(demandaAnual),
                stock_actual: stockActual
            },
            resultados_matematicos: {
                cantidad_optima_pedir_eoq: Math.ceil(eoq),
                punto_reorden_rop: Math.ceil(rop),
            },
            recomendacion_sistema: {
                estado: estadoInventario,
                comprar_ahora: requiereCompra,
                mensaje: requiereCompra
                    ? `Tu stock (${stockActual}) está por debajo del punto de reorden (${Math.ceil(rop)}). Pide ${Math.ceil(eoq)} unidades.`
                    : `Inventario sano. No necesitas comprar por ahora.`
            }
        };
    }

    redondear(num) {
        return Math.round(num * 100) / 100;
    }
}

module.exports = MotorEOQ;
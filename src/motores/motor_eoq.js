class MotorEOQ {
    constructor(dbPool) {
        this.dbPool = dbPool;
    }

    async calcularOptimoAutomatico(insumoId, diasAnalizados = 90) {
        const queryInsumo = `
        SELECT nombre, costo_promedio, stock_actual. stock_minimo
        FROM insumos
        WHERE id = $1;`;

        const resInsumo = await this.dbPool.query(queryInsumo, [insumoId]);

        if (resInsumo.rows.length === 0) {
            throw new Error(`Insumo ID ${insumoId} no encontrado.`);
        }

        const insumo = resInsumo.rows[0];
    }
}
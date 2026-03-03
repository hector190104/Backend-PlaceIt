class MotorCosteo {

    constructor(dbPool) {
        this.db = dbPool;
    }

    async calcularCosteoReceta(recetaId, memoiza = {}, path = new Set()) {
        if (path.has(recetaId)) {
            throw new Error(`Dependencia circular detectada en la Receta ID: ${recetaId}. Revisa la base de datos`);
        }

        if (memoiza[recetaId]) {
            return memoiza[recetaId];
        }

        path.add(recetaId);

        let costoTotalCalculado = 0;
        const desglose = [];

        const query = `
        SELECT
        rd.cantidad_necesaria, rd.insumo_id, rd.sub_receta,
        i.nombre AS insumo_nombre, i.costo_promedio,
        sr.nombre AS subreceta_nombre, sr.porciones_rinde
        FROM receta_detalles rd
        LEFT JOIN insumos i ON rd.insumo_id = i.id
        LEFT JOIN recetas sr ON rd.sub_receta_id = sr.id
        WHERE rd.receta_padre_id = $1;`;

        const resultado = await this.db.query(query, [recetaId]);
        const detalles = resultado.rows;

        const queryPadre = `SELECT porciones_rinde, nombre FROM recetas WHERE id = $1`;
        const resPadre = await this.db.query(queryPadre, [recetaId]);
        const rendimientoPadre = resPadre.rows[0]?.porciones_rinde || 1;
        const nombrePadre = resPadre.rows[0]?.nombre || 'Receta Desconocida';
    }
}
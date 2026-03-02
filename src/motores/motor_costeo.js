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
    }
}
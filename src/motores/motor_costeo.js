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

        for (const item of detalles) {

            if (item.insumo_id) {
                const costoItem = parseFloat(item.cantidad_necesaria) * parseFloat(item.costo_promedio || 0);
                costoTotalCalculado += costoItem;

                desglose.push({
                    tipo: 'INSUMO',
                    nombre: item.insumo_nombre,
                    cantidad_usada: Number(item.cantidad_necesaria),
                    costo_unitario_bd: Number(item.costo_promedio),
                    subtotal: this.redondear(costoItem)
                });
            }
            else if (item.sub_receta_id) {
                const resultadoSubReceta = await this.calcularCostoReceta(
                    item.sub_receta_id,
                    memo,
                    new Set(path)
                );

                const costoPorPorcionSub = resultadoSubReceta.costoPorPorcion;
                const costoItem = parseFloat(item.cantidad_necesaria) * costoPorPorcionSub;

                costoTotalCalculado += costoItem;

                desglose.push({
                    tipo: 'SUB_RECETA',
                    nombre: item.subreceta_nombre,
                    cantidad_usada: Number(item.cantidad_necesaria),
                    subtotal: this.redondear(costoItem),
                    detalle_interno: resultadoSubReceta.desglose
                });
            }
        }

        path.delete(recetaId);

        const costoUnitarioFinal = costoTotalCalculado / rendimientoPadre;

        const respuesta = {
            receta_id: recetaId,
            nombre_receta: nombrePadre,
            rinde_porciones: rendimientoPadre,
            costoTotalReceta: this.redondear(costoTotalCalculado),
            costoPorPorcion: this.redondear(costoUnitarioFinal),
            desglose: desglose
        };

        memoiza[recetaId] = respuesta;
        return respuesta;
    }

    async calcularCostoMenu(menuId, cantidadPersonas = 1) {
        let costoTotalMenuUnitario = 0;
        const desgloseMenu = [];

        const queryMenu = `
        SELECT md.receta_id, md.cantidad_porciones, r.nombre
        FROM menu_detalles md
        JOIN recetas r ON md.receta_id = r.id
        WHERE md.menu_id = $1;`;

        const resultadoMenu = await this.db.query(queryMenu, [menuId]);

        for (const item of resultadoMenu.rows) {
            const analisisReceta = await this.calcularCosteoReceta(item.receta_id);
            const costoPlatilloEnMenu = analisisReceta.costoPorPorcion * parseFloat(item.cantidad_porciones);

            costoTotalMenuUnitario +- costoPlatilloEnMenu;

            desgloseMenu.push({
                platillo: item.nombre,
                porciones_incluidas_en_menu: Number(item.cantidad_porciones),
                costo_platillo_unitario: this.redondear(costoPlatilloEnMenu),
                arbol_de_costos: analisisReceta.desglose
            });
        }

        const costoTotalFinal = costoTotalMenuUnitario * cantidadPersonas;

        return {
            menu_id: menuId,
            personas_a_cotizar: cantidadPersonas,
            costo_por_persona: this.redondear(costoTotalMenuUnitario),
            costo_total_estimado: this.redondear(costoTotalFinal),
            platillos: desgloseMenu
        };
    }

    redondear(num) {
        return Math.round(num * 100) / 100;
    }
}
const db = require('../../config/db');
const { aplicarFEFO } = require('../../motores/motor_fefo');

class OrdenesRepository {
    async getLotesActivos(insumoId) {
        const query = `
        SELECT 
            id,
            codigo_lote, 
            cantidad_actual, 
            fecha_caducidad,
            estado AS estado_bd
        FROM lotes
        WHERE insumo_id = $1 AND estado = 'ACTIVO' AND cantidad_actual > 0
        ORDER BY fecha_caducidad ASC;`;

        const result = await db.query(query, [insumoId]);
        return result.rows;
    }

    async insertarOrdenPendiente(datos, detalles) {
        const cliente = await db.connect();
        try {
            await cliente.query('BEGIN');
            const resOrden = await cliente.query(`
                INSERT INTO ordenes (tipo_orden, estado, destino, persona_entrega, persona_recibe)
                VALUES ('SALIDA', 'PENDIENTE', $1, $2, $3) RETURNING id;
            `, [datos.destino, datos.persona_entrega, datos.persona_recibe]);

            const ordenId = resOrden.rows[0].id;

            for (const item of detalles) {
                await cliente.query(`
                    INSERT INTO ordenes_detalles (orden_id, insumo_id, cantidad_solicitada)
                    VALUES ($1, $2, $3)
                `, [ordenId, item.insumoId, item.cantidadSolicitada]);
            }
            await cliente.query('COMMIT');
            return ordenId;
        } catch (error) {
            await cliente.query('ROLLBACK'); throw error;
        } finally { cliente.release(); }
    }

    async marcarComoCancelada(ordenId, motivo) {
        await db.query(`
            UPDATE ordenes SET estado = 'CANCELADA', motivo_cancelacion = $1 WHERE id = $2
        `, [motivo, ordenId]);
    }

    async ejecutarSalidaFisica(ordenId, insumosEntregados, estadoFinal) {
        const cliente = await db.connect();
        try {
            await cliente.query('BEGIN');

            await cliente.query('UPDATE ordenes SET estado = $1 WHERE id = $2', [estadoFinal, ordenId]);

            for (const item of insumosEntregados) {
                await cliente.query(`
                    UPDATE ordenes_detalles SET cantidad_entregada = $1 WHERE orden_id = $2 AND insumo_id = $3
                `, [item.cantidadEntregada, ordenId, item.insumoId]);

                const resLotes = await cliente.query(`
                    SELECT id, codigo_lote, cantidad_actual, fecha_caducidad, estado AS estado_bd 
                    FROM lotes 
                    WHERE insumo_id = $1 AND estado = 'ACTIVO' AND cantidad_actual > 0
                    ORDER BY fecha_caducidad ASC`, [item.insumoId]);
                const resultadoFEFO = aplicarFEFO(resLotes.rows, Number(item.cantidadEntregada));

                for (const lote of resultadoFEFO.asignaciones) {
                    await cliente.query('UPDATE lotes SET cantidad_actual = cantidad_actual - $1 WHERE id = $2', [lote.cantidad, lote.loteId]);
                    await cliente.query('INSERT INTO movimientos (tipo_movimiento, insumo_id, lote_id, orden_id, cantidad) VALUES (\'SALIDA_CONSUMO\', $1, $2, $3, $4)', [item.insumoId, lote.loteId, ordenId, -(lote.cantidad)]);
                }
            }
            await cliente.query('COMMIT');
        } catch (error) {
            await cliente.query('ROLLBACK'); throw error;
        } finally { cliente.release(); }
    }

    async obtenerDetallesOrden(ordenId) {
        const query = `
            SELECT insumo_id, cantidad_solicitada 
            FROM ordenes_detalles 
            WHERE orden_id = $1;
        `;
        const result = await db.query(query, [ordenId]);
        return result.rows;
    }

    // ==========================================
    // REPOSITORIOS DE ENTRADA (TRANSACCIONES DB)
    // ==========================================

    async ejecutarTransaccionEntrada(datosCabecera, insumos) {
        const cliente = await db.connect();
        try {
            await cliente.query('BEGIN'); // INICIA TRANSACCIÓN

            // 1. Crear Cabecera de la Orden (COMPLETADA)
            const queryOrden = `
                INSERT INTO ordenes (tipo_orden, estado, proveedor_id, persona_entrega, persona_recibe, usuario_creador_id)
                VALUES ('ENTRADA', 'COMPLETADA', $1, $2, $3, $4) RETURNING id;
            `;
            const resOrden = await cliente.query(queryOrden, [
                datosCabecera.proveedor_id, datosCabecera.persona_entrega,
                datosCabecera.persona_recibe, datosCabecera.usuario_creador_id
            ]);
            const ordenId = resOrden.rows[0].id;

            // 2. Iterar sobre el "Carrito de compras" que mandó Angular
            for (const item of insumos) {

                // A) Guardar el detalle de la orden
                const queryDetalle = `
                    INSERT INTO ordenes_detalles (orden_id, insumo_id, cantidad_solicitada, cantidad_entregada)
                    VALUES ($1, $2, $3, $4) RETURNING id;
                `;
                const resDetalle = await cliente.query(queryDetalle, [
                    ordenId, item.insumoId, item.cantidadRecibida, item.cantidadRecibida
                ]);
                const detalleId = resDetalle.rows[0].id;

                // B) CREAR EL LOTE NUEVO
                const queryLote = `
                    INSERT INTO lotes (
                        insumo_id, proveedor_id, codigo_lote, fecha_caducidad, 
                        cantidad_inicial, cantidad_actual, costo_unitario_compra, 
                        ubicacion_pasillo, ubicacion_estante, estado
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVO') RETURNING id;
                `;
                const resLote = await cliente.query(queryLote, [
                    item.insumoId, datosCabecera.proveedor_id,
                    item.codigoLote || `LOTE-${Date.now()}`, // Si el prov no da lote, creamos uno interno
                    item.fechaCaducidad, item.cantidadRecibida, item.cantidadRecibida,
                    item.costoUnitarioCompra, item.pasillo, item.estante
                ]);
                const loteId = resLote.rows[0].id;

                // C) Registrar trazabilidad exacta (ordenes_lotes)
                await cliente.query(`
                    INSERT INTO ordenes_lotes (orden_detalle_id, lote_id, cantidad_asignada, precio_unitario)
                    VALUES ($1, $2, $3, $4)
                `, [detalleId, loteId, item.cantidadRecibida, item.costoUnitarioCompra]);

                // D) Kardex (Movimientos)
                await cliente.query(`
                    INSERT INTO movimientos (tipo_movimiento, insumo_id, lote_id, orden_id, cantidad, costo_unitario, usuario_id) 
                    VALUES ('ENTRADA_COMPRA', $1, $2, $3, $4, $5, $6)
                `, [item.insumoId, loteId, ordenId, item.cantidadRecibida, item.costoUnitarioCompra, datosCabecera.usuario_creador_id]);
            }

            await cliente.query('COMMIT'); //CONFIRMA TODO
            return ordenId;

        } catch (error) {
            await cliente.query('ROLLBACK'); // CANCELA SI HAY ERROR
            throw error;
        } finally {
            cliente.release();
        }
    }

    // Registra una orden de entrada cancelada (El camión llegó pero se rechazó)
    async registrarEntradaCancelada(datosCabecera, motivo) {
        const queryOrden = `
            INSERT INTO ordenes (tipo_orden, estado, proveedor_id, persona_entrega, persona_recibe, usuario_creador_id, motivo_cancelacion)
            VALUES ('ENTRADA', 'CANCELADA', $1, $2, $3, $4, $5) RETURNING id;
        `;
        const resOrden = await db.query(queryOrden, [
            datosCabecera.proveedor_id, datosCabecera.persona_entrega,
            datosCabecera.persona_recibe, datosCabecera.usuario_creador_id, motivo
        ]);
        return resOrden.rows[0].id;
    }
}

module.exports = new OrdenesRepository();
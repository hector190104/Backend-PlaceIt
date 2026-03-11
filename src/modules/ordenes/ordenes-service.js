const ordenesRepository = require('./ordenes-repository');
const { aplicarFEFO } = require('../../motores/motor_fefo');
// const emailService = require('../../services/email.service');

class OrdenesService {

    async crearOrdenPendiente(datosOrden, detalles) {
        const ordenId = await ordenesRepository.insertarOrdenPendiente(datosOrden, detalles);

        // AQUÍ: Mandar correo al Almacenista
        // await emailService.notificarNuevaOrden(ordenId, 'almacen@place-it.com');

        return { ordenId, mensaje: "Orden creada. Notificación enviada al almacén." };
    }

    async simularOrden(ordenId) {
        // Obtenemos qué pidió el admin y buscamos lotes disponibles
        const detalles = await ordenesRepository.obtenerDetallesOrden(ordenId);

        let sugerenciaFEFO = [];
        for (const item of detalles) {
            const lotes = await ordenesRepository.getLotesActivos(item.insumo_id);
            // Simulamos con lo SOLICITADO originalmente
            const resultadoFefo = aplicarFEFO(lotes, Number(item.cantidad_solicitada));
            sugerenciaFEFO.push({ 
                insumoId: item.insumo_id, 
                planDeExtraccion: resultadoFefo.asignaciones,
                alertas: resultadoFefo.alertas
            });
        }
        return sugerenciaFEFO;
    }

    async procesarConfirmacion(ordenId, insumosEntregados) {
        // 1. Verificamos si es COMPLETADA o PARCIAL comparando cantidades
        let estadoFinal = 'COMPLETADA';
        for (const item of insumosEntregados) {
            if (item.cantidadEntregada < item.cantidadSolicitada) {
                estadoFinal = 'PARCIAL';
                break; // Con uno que sea menor, toda la orden es parcial
            }
        }

        // 2. Ejecutamos el FEFO real con las cantidades ENTREGADAS y descontamos en DB
        await ordenesRepository.ejecutarSalidaFisica(ordenId, insumosEntregados, estadoFinal);

        // AQUÍ: Mandar correo al Admin avisando que ya se surtió
        // await emailService.notificarOrdenSurtida(ordenId, estadoFinal);

        return { ordenId, estado: estadoFinal, mensaje: "Stock descontado exitosamente." };
    }

    async cancelarOrden(ordenId, motivo) {
        await ordenesRepository.marcarComoCancelada(ordenId, motivo);
        return { ordenId, estado: 'CANCELADA', mensaje: "Orden cancelada sin afectar inventario." };
    }

    // ==========================================
    // SERVICIOS DE ENTRADA
    // ==========================================

    async procesarEntradaCompleta(datosCabecera, insumosRecibidos) {
        /* Todo viene correcto del controlador, mandamos a ejecutar la transacción ACID*/
        const ordenId = await ordenesRepository.ejecutarTransaccionEntrada(datosCabecera, insumosRecibidos);

        return {
            ordenId: ordenId,
            estado: 'COMPLETADA',
            mensaje: "Mercancía ingresada y lotes creados exitosamente."
        };
    }

    async procesarCancelacionEntrada(datosCabecera, motivo) {
        // Registramos la orden pero directo a CANCELADA, sin afectar inventario
        const ordenId = await ordenesRepository.registrarEntradaCancelada(datosCabecera, motivo);

        return {
            ordenId: ordenId,
            estado: 'CANCELADA',
            mensaje: "Entrada rechazada y registrada en la bitácora."
        };
    }
}

module.exports = new OrdenesService();
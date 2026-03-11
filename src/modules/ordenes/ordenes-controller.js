const ordenesService = require('./ordenes.service');

class OrdenesController {

    async crearOrdenAdmin(req, res) {
        try {
            const { datosOrden, detallesInsumos } = req.body;
            const resultado = await ordenesService.crearOrdenPendiente(datosOrden, detallesInsumos);
            res.status(201).json({ success: true, data: resultado });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async simularOrdenAlmacenista(req, res) {
        try {
            const ordenId = req.params.id;
            const simulacion = await ordenesService.simularOrden(ordenId);
            res.status(200).json({ success: true, data: simulacion });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async confirmarOrden(req, res) {
        try {
            const ordenId = req.params.id;
            const { insumosEntregados } = req.body;
            const resultado = await ordenesService.procesarConfirmacion(ordenId, insumosEntregados);
            res.status(200).json({ success: true, data: resultado });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async cancelarOrden(req, res) {
        try {
            const ordenId = req.params.id;
            const { motivo_cancelacion } = req.body;

            if (!motivo_cancelacion) {
                return res.status(400).json({ success: false, message: 'El motivo es obligatorio.' });
            }

            const resultado = await ordenesService.cancelarOrden(ordenId, motivo_cancelacion);
            res.status(200).json({ success: true, data: resultado });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // ==========================================
    // CONTROLADORES DE ENTRADA
    // ==========================================

    async registrarEntrada(req, res) {
        try {
            // Extraemos los datos generales y el arreglo de insumos
            const { datosCabecera, insumosRecibidos } = req.body;

            // Validación rápida de seguridad
            if (!insumosRecibidos || insumosRecibidos.length === 0) {
                return res.status(400).json({ success: false, message: 'La orden no tiene insumos.' });
            }

            // Validamos que los datos críticos del lote vengan en cada insumo
            for (const item of insumosRecibidos) {
                if (!item.fechaCaducidad || !item.costoUnitarioCompra || !item.cantidadRecibida) {
                    return res.status(400).json({
                        success: false,
                        message: `Faltan datos obligatorios (caducidad, costo o cantidad) en el insumo ID: ${item.insumoId}`
                    });
                }
            }

            const resultado = await ordenesService.procesarEntradaCompleta(datosCabecera, insumosRecibidos);
            res.status(201).json({ success: true, data: resultado });

        } catch (error) {
            console.error('Error al registrar entrada:', error);
            res.status(500).json({ success: false, message: 'Error procesando la entrada en la base de datos.' });
        }
    }

    async cancelarEntrada(req, res) {
        try {
            const { datosCabecera, motivo_cancelacion } = req.body;

            if (!motivo_cancelacion) {
                return res.status(400).json({ success: false, message: 'El motivo de cancelación es obligatorio.' });
            }

            const resultado = await ordenesService.procesarCancelacionEntrada(datosCabecera, motivo_cancelacion);
            res.status(201).json({ success: true, data: resultado });

        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new OrdenesController();
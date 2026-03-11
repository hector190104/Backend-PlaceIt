const express = require('express');
const router = express.Router();
const ordenesController = require('./ordenes-controller');

router.post('/salidas/crear', ordenesController.crearOrdenAdmin);
router.get('/salidas/:id/simular', ordenesController.simularOrdenAlmacenista);
router.post('/salidas/:id/confirmar', ordenesController.confirmarOrden);
router.post('/salidas/:id/cancelar', ordenesController.cancelarOrden);

router.post('/entradas/completar', ordenesController.registrarEntrada);
router.post('/entradas/cancelar', ordenesController.cancelarEntrada);

module.exports = router;
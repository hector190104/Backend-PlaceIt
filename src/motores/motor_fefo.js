function aplicarFEFO(lotes, cantidadSolicitada, opciones = {}) {

    const {
        modoEstricto = false, 
        configuracionAlertas = {
            diasCritico: 0, 
            diasAlto: 3,
            diasMedio: 7 
        }
    } = opciones;

    validarEntrada(lotes, cantidadSolicitada);

    const hoy = normalizarFecha(new Date());

    const lotesDisponibles = [];
    
    for (const lote of lotes) {
        if (
            lote.estado_bd !== 'ACTIVO' ||
            lote.cantidad_actual <= 0
        ) continue;

        const fechaCad = normalizarFecha(new Date(lote.fecha_caducidad));
        const diasFaltantes = calcularDiasHastaFecha(hoy, fechaCad);

        if (diasFaltantes < 0) continue; 

        const nivelAlerta = determinarNivelAlerta(
            diasFaltantes,
            configuracionAlertas
        );

        lotesDisponibles.push({
            id: lote.id,
            codigo_lote: lote.codigo_lote,
            cantidad_actual: Number(lote.cantidad_actual),
            fechaCaducidadObj: fechaCad,
            fecha_caducidad: lote.fecha_caducidad,
            diasFaltantes,
            nivelAlerta
        });
    }

    if (lotesDisponibles.length === 0) {
        return resultadoVacio(
            cantidadSolicitada, "No hay lotes disponibles."
        );
    }

    let stockTotalDisponible = 0;
    for (const lote of lotesDisponibles) {
        stockTotalDisponible += lote.cantidad_actual;
    }

    const stockSuficiente = stockTotalDisponible >= cantidadSolicitada;

    if (modoEstricto && !stockSuficiente) {
        throw new Error(
            `Stock insuficiente. Disponible: ${stockTotalDisponible}, ` + 
            `Solicitado: ${cantidadSolicitada}`
        );
    }

    const prioridadEstado = {
        'CRITICO': 0,
        'ALTO': 1,
        'MEDIO': 2,
        'NORMAL': 3
    };

    lotesDisponibles.sort((a, b) => {
        const prioridadA = prioridadEstado[a.nivelAlerta];
        const prioridadB = prioridadEstado[b.nivelAlerta];

        if (prioridadA !== prioridadB) {
            return prioridadA - prioridadB;
        }

        return a.fechaCaducidadObj - b.fechaCaducidadObj;
    });

    let cantidadPendiente = cantidadSolicitada;
    const asignaciones = [];
    const alertas = [];

    for (const lote of lotesDisponibles) {
        if (cantidadPendiente <= 0) break;

        const cantidadUsada = Math.min(
            lote.cantidad_actual,
            cantidadPendiente
        );

        asignaciones.push({
            loteId: lote.id,
            codigoLote: lote.codigo_lote,
            cantidad: cantidadUsada,
            fechaCaducidad: lote.fecha_caducidad,
            diasFaltantes: lote.diasFaltantes,
            nivelAlerta: lote.nivelAlerta
        });

        if (lote.nivelAlerta !== 'NORMAL') {
            alertas.push({
                lote: lote.codigo_lote,
                nivel: lote.nivelAlerta,
                diasFaltantes: lote.diasFaltantes
            });
        }

        cantidadPendiente -= cantidadUsada;
    }

    const cantidadAsignada = cantidadSolicitada - cantidadPendiente;

    let tipoResultado;

    if (cantidadAsignada === 0) {
        tipoResultado = 'SIN_STOCK';
    } else if (!stockSuficiente) {
        tipoResultado = 'PARCIAL';
    } else {
        tipoResultado = 'COMPLETO';
    }

    return {
        exitoso: tipoResultado !== 'SIN_STOCK',
        tipoResultado,
        requiereConfirmacion: tipoResultado === 'PARCIAL',
        stockSuficiente,
        cantidadSolicitada,
        cantidadAsignada,
        cantidadFaltante: cantidadPendiente,
        asignaciones,
        alertas,
        resumen: {
            lotesUsados: asignaciones.length,
            tieneRiesgo: alertas.length > 0,
            timestamp: new Date().toISOString()
        }
    };
}

function redondear(num) {
    return Math.round(num * 100) / 100;
}

function validarEntrada(lotes, cantidadSolicitada) {
    if (!Array.isArray(lotes))
        throw new Error("lotes debe ser un arreglo.");

    if (typeof cantidadSolicitada !== 'number' || cantidadSolicitada <= 0) 
        throw new Error(
            "La cantidad solicitada debe ser un número mayor a 0.");

    for (const lote of lotes) {
        if (typeof lote.id !== 'number')
            throw new Error("Lote sin id válido.");

        if (typeof lote.cantidad_actual !== 'number')
            throw new Error("Cantidad actual inválida.");
        if (!lote.fecha_caducidad)
            throw new Error("Fecha de caducidad requerida.");

        if (!['ACTIVO', 'AGOTADO', 'CADUCADO'].includes(lote.estado_bd))
            throw new Error("Estado invalido");
    }
}

function calcularDiasHastaFecha(fechaInicio, fechaFin) {
    const ms_por_dia = 1000 * 60 * 60 * 24;
    return Math.floor((fechaFin - fechaInicio) / ms_por_dia);
}

function determinarNivelAlerta(diasFaltantes, config) {
    const {
        diasCritico,
        diasAlto,
        diasMedio
    } = config;
    
    if (diasFaltantes <= diasCritico) return 'CRITICO';
    if (diasFaltantes <= diasAlto) return 'ALTO';
    if (diasFaltantes <= diasMedio) return 'MEDIO';

    return 'NORMAL'
}

function normalizarFecha(fecha) {
    fecha.setHours(0, 0, 0, 0);
    return fecha;
}

function resultadoVacio(cantidadSolicitada, mensaje) {
    return {
        exitoso: false,
        tipoResultado: 'SIN_STOCK',
        requiereConfirmacion: false,
        stockSuficiente: false,
        cantidadSolicitada,
        cantidadAsignada: 0,
        cantidadFaltante: cantidadSolicitada,
        asignaciones: [],
        alertas: [],
        mensaje
    };
}

module.exports = { aplicarFEFO };
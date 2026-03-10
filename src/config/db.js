const { pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'place_it',
    password: 'xocua2004',
    port: 5432
});

pool.query('SELECT NOW()', (err, res) => {
    if(err) {
        console.error('Error de conexión a la base de datos', err.stack);
    } else {
        console.log('Conexión a la base de datos exitosa', res.rows[0]);
    }
});

module.exports = pool;
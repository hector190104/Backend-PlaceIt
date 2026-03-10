const express = require('express');
const cors = requier('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        mensaje: 'Backend corriendo correctamente'
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
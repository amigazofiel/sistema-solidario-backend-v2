const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const pool = require("./db/pool");

// ✅ Log para ver si Railway realmente está pasando la variable
console.log("DATABASE_URL en runtime:", process.env.DATABASE_URL);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =======================
// Endpoint raíz
// =======================
app.get("/", (req, res) => {
  res.send("Backend Sistema Solidario V2 activo.");
});

// =======================
// Endpoint para crear tablas automáticamente
// =======================
app.get("/init-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100),
        email VARCHAR(200) UNIQUE,
        password VARCHAR(200),
        referido_por INTEGER,
        fecha_registro TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS referidos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        referido_id INTEGER,
        fecha TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS suscripciones (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        estado VARCHAR(50),
        fecha_inicio TIMESTAMP DEFAULT NOW(),
        fecha_fin TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pagos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        monto NUMERIC,
        fecha TIMESTAMP DEFAULT NOW(),
        tipo VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS comisiones (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        referido_id INTEGER,
        monto NUMERIC,
        fecha TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS actividad (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        descripcion TEXT,
        fecha TIMESTAMP DEFAULT NOW()
      );
    `);

    res.send("✅ Tablas creadas correctamente.");
  } catch (error) {
    console.error(error);
    res.status(500).send("❌ Error creando tablas.");
  }
});

// =======================
// Servidor
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend V2 corriendo en puerto ${PORT}`);
});

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fetch = require("node-fetch"); // npm install node-fetch
const pool = require("./db/pool");

// ✅ Log para verificar conexión a Railway
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
// ✅ Endpoint para registrar usuarios
// =======================
app.post("/api/registro", async (req, res) => {
  const { nombre, email, referido_por } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ error: "Nombre y email son obligatorios." });
  }

  try {
    // ✅ 1. Crear usuario en la base de datos
    const nuevoUsuario = await pool.query(
      `INSERT INTO usuarios (nombre, email, referido_por)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [nombre, email, referido_por || null]
    );

    const usuarioId = nuevoUsuario.rows[0].id;

    // ✅ 2. Registrar referido si corresponde
    if (referido_por) {
      await pool.query(
        `INSERT INTO referidos (usuario_id, referido_id)
         VALUES ($1, $2)`,
        [referido_por, usuarioId]
      );
    }

    // ✅ 3. Enviar usuario a MailerLite
    const apiKey = process.env.MAILERLITE_API_KEY;
    const groupId = process.env.MAILERLITE_GROUP_ID;

    try {
      const mlResponse = await fetch(`https://connect.mailerlite.com/api/groups/${groupId}/subscribers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          email: email,
          name: nombre
        })
      });

      if (!mlResponse.ok) {
        const errorData = await mlResponse.json();
        console.error("Error en MailerLite:", errorData);
      } else {
        const mlData = await mlResponse.json();
        console.log("Usuario agregado a MailerLite:", mlData);
      }
    } catch (mlError) {
      console.error("❌ Error conectando con MailerLite:", mlError);
    }

    res.json({
      mensaje: "✅ Usuario registrado correctamente y enviado a MailerLite.",
      usuario_id: usuarioId,
    });

  } catch (error) {
    console.error("Error registrando usuario:", error);

    if (error.code === "23505") {
      return res.status(400).json({ error: "El email ya está registrado." });
    }

    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// =======================
// Servidor
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend V2 corriendo en puerto ${PORT}`);
});

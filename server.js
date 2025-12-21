// server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Endpoint raíz
app.get("/", (req, res) => {
  res.send("Backend Sistema Solidario V2 activo.");
});

// Endpoint de registro
app.post("/api/registro", async (req, res) => {
  const { nombre, email, referido_por, wallet_address } = req.body;

  try {
    // Guardar usuario en la base de datos con wallet_address
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, referido_por, fecha_registro, wallet_address)
       VALUES ($1, $2, $3, NOW(), $4)
       RETURNING id`,
      [nombre, email, referido_por, wallet_address]
    );
    const usuarioId = result.rows[0].id;

    // Si tiene referido, guardar relación
    if (referido_por) {
      await pool.query(
        "INSERT INTO referidos (usuario_id, referido_id, fecha) VALUES ($1, $2, NOW())",
        [usuarioId, referido_por]
      );
    }

    // Enviar a MailerLite
    const groupId = process.env.MAILERLITE_GROUP_ID;
    const apiKey = process.env.MAILERLITE_API_KEY;

    const response = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        email,
        fields: { name: nombre },
        groups: [groupId]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error en MailerLite:", errorData);
    } else {
      const data = await response.json();
      console.log("Usuario agregado a MailerLite:", data);
    }

    res.json({
      mensaje: "✅ Usuario registrado correctamente y enviado a MailerLite.",
      usuario_id: usuarioId
    });
  } catch (error) {
    console.error("Error en /api/registro:", error);
    res.status(500).json({ mensaje: "❌ Error al registrar usuario." });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Backend V2 corriendo en puerto ${PORT}`);
});

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

    // Si tiene patrocinador, guardar relación y acreditar bonos
    if (referido_por) {
      // Relación patrocinador → referido
      await pool.query(
        "INSERT INTO referidos (usuario_id, referido_id, fecha) VALUES ($1, $2, NOW())",
        [referido_por, usuarioId]
      );

      // Bono directo 10 USDT al patrocinador
      await pool.query(
        `INSERT INTO pagos (usuario_id, monto, concepto, fecha)
         VALUES ($1, 10, 'Bono directo por referido', NOW())`,
        [referido_por]
      );
      console.log(`💰 Bono directo acreditado: 10 USDT al usuario ${referido_por}`);

      // Bono fijo 5 USDT al sistema (usuario 12)
      await pool.query(
        `INSERT INTO pagos (usuario_id, monto, concepto, fecha)
         VALUES ($1, 5, 'Bono fijo del sistema', NOW())`,
        [12] // tu usuario oficial "Sistema Solidario"
      );
      console.log("💰 Bono fijo acreditado: 5 USDT al sistema (usuario 12)");
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
      mensaje: "✅ Usuario registrado correctamente, bonos acreditados y enviado a MailerLite.",
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

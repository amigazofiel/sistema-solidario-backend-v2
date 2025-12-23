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
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, referido_por, fecha_registro, wallet_address)
       VALUES ($1, $2, $3, NOW(), $4)
       RETURNING id`,
      [nombre, email, referido_por, wallet_address]
    );
    const usuarioId = result.rows[0].id;

    if (referido_por) {
      await pool.query(
        "INSERT INTO referidos (usuario_id, referido_id, fecha) VALUES ($1, $2, NOW())",
        [referido_por, usuarioId]
      );

      await pool.query(
        `INSERT INTO pagos (usuario_id, monto, fecha, tipo)
         VALUES ($1, 10, NOW(), 'Bono directo por referido')`,
        [referido_por]
      );
      console.log(`💰 Bono directo acreditado: 10 USDT al usuario ${referido_por}`);

      await pool.query(
        `INSERT INTO pagos (usuario_id, monto, fecha, tipo)
         VALUES ($1, 5, NOW(), 'Bono fijo del sistema')`,
        [12]
      );
      console.log("💰 Bono fijo acreditado: 5 USDT al sistema (usuario 12)");
    }

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
    if (error.code === '23505') {
      res.status(400).json({ mensaje: "❌ El email ya está registrado. Usa otro correo." });
    } else {
      console.error("Error en /api/registro:", error);
      res.status(500).json({ mensaje: "❌ Error al registrar usuario." });
    }
  }
});

// Endpoint suscripciones: activar
app.post("/api/suscripciones/activar", async (req, res) => {
  const { usuario_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO suscripciones (usuario_id, estado, fecha_inicio, fecha_fin)
       VALUES ($1, 'active', NOW(), NOW() + interval '30 days')`,
      [usuario_id]
    );
    res.json({ mensaje: "✅ Suscripción activada." });
  } catch (error) {
    console.error("Error en /api/suscripciones/activar:", error);
    res.status(500).json({ mensaje: "❌ Error al activar suscripción." });
  }
});

// Endpoint suscripciones: renovar
app.post("/api/suscripciones/renovar", async (req, res) => {
  const { usuario_id } = req.body;
  try {
    await pool.query(
      `UPDATE suscripciones
       SET fecha_fin = fecha_fin + interval '30 days', estado = 'active'
       WHERE usuario_id = $1 AND estado = 'active'`,
      [usuario_id]
    );
    res.json({ mensaje: "✅ Suscripción renovada." });
  } catch (error) {
    console.error("Error en /api/suscripciones/renovar:", error);
    res.status(500).json({ mensaje: "❌ Error al renovar suscripción." });
  }
});

// Endpoint suscripciones: vencer
app.post("/api/suscripciones/vencer", async (req, res) => {
  const { usuario_id } = req.body;
  try {
    await pool.query(
      `UPDATE suscripciones
       SET estado = 'expired'
       WHERE usuario_id = $1 AND fecha_fin < NOW()`,
      [usuario_id]
    );
    res.json({ mensaje: "✅ Suscripción marcada como vencida." });
  } catch (error) {
    console.error("Error en /api/suscripciones/vencer:", error);
    res.status(500).json({ mensaje: "❌ Error al vencer suscripción." });
  }
});

// Endpoint pagos: registrar con verificación blockchain (API V2 multichain)
app.post("/api/pagos/registrar", async (req, res) => {
  const { usuario_id, monto, tx_hash } = req.body;

  try {
    if (monto !== 10 && monto !== 5) {
      return res.status(400).json({ mensaje: "❌ Monto inválido. Solo se permiten 10 o 5 USDT." });
    }

    const apiKey = process.env.BSCSCAN_API_KEY;
    const response = await fetch(
      `https://api.etherscan.io/v2/api?chain=bsc&module=transaction&action=gettxinfo&txhash=${tx_hash}&apikey=${apiKey}`
    );
    const data = await response.json();

    console.log("Respuesta Etherscan V2:", data);

    let estado = "rechazado";
    if (data.result && data.result.status === "1") {
      estado = "confirmado";
    }

    await pool.query(
      `INSERT INTO pagos (usuario_id, monto, fecha, tipo, tx_hash, estado)
       VALUES ($1, $2, NOW(), 'Transacción blockchain', $3, $4)`,
      [usuario_id, monto, tx_hash, estado]
    );

    res.json({ mensaje: "✅ Pago registrado.", estado });
  } catch (error) {
    console.error("Error en /api/pagos/registrar:", error);
    res.status(500).json({ mensaje: "❌ Error al registrar pago." });
  }
});

// Endpoint pagos: consultar historial por usuario
app.get("/api/pagos/:usuario_id", async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM pagos WHERE usuario_id = $1 ORDER BY fecha DESC",
      [usuario_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error en /api/pagos:", error);
    res.status(500).json({ mensaje: "❌ Error al obtener pagos." });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Backend V2 corriendo en puerto ${PORT}`);
});

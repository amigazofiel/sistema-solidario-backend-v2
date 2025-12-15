const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const pool = require("./db/pool");

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
// Servidor
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend V2 corriendo en puerto ${PORT}`);
});

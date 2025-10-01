// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Routes API
const routes = require("./routes");
app.use("/api", routes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Serveur lancé sur port ${PORT}`));

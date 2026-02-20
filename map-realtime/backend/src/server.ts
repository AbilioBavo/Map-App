import 'dotenv/config';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { createSocketServer } from './sockets.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: '50kb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

const server = http.createServer(app);
createSocketServer(server);

server.listen(port, () => {
  console.info(`backend listening on :${port}`);
});

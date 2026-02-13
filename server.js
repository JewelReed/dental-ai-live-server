import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Twilio connected");

  const openai = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  );

  openai.on("open", () => {
    console.log("Connected to OpenAI");
  });

  ws.on("message", (msg) => {
    if (openai.readyState === WebSocket.OPEN) {
      openai.send(msg);
    }
  });

  openai.on("message", (msg) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });

  ws.on("close", () => {
    openai.close();
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


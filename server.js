import express from "express";
import http from "http";
import dotenv from "dotenv";
import WebSocket, { WebSocketServer } from "ws";

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Dental AI Live Server Running");
});

/*
  Correct WebSocket server initialization
*/
const wss = new WebSocketServer({ server });

wss.on("connection", (twilioSocket) => {
  console.log("Twilio connected");

  const openaiSocket = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  openaiSocket.on("open", () => {
    console.log("Connected to OpenAI");
  });

  openaiSocket.on("message", (message) => {
    if (twilioSocket.readyState === WebSocket.OPEN) {
      twilioSocket.send(message);
    }
  });

  twilioSocket.on("message", (message) => {
    if (openaiSocket.readyState === WebSocket.OPEN) {
      openaiSocket.send(message);
    }
  });

  twilioSocket.on("close", () => {
    console.log("Twilio disconnected");
    openaiSocket.close();
  });

  openaiSocket.on("close", () => {
    console.log("OpenAI disconnected");
    twilioSocket.close();
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

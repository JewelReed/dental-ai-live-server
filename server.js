import express from "express";
import http from "http";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

/**
 * Basic health check route
 * (So Railway & browser don't show errors)
 */
app.get("/", (req, res) => {
  res.send("Dental AI Live Server Running");
});

/**
 * WebSocket Server for Twilio Media Streams
 */
const wss = new WebSocket.Server({ server });

wss.on("connection", (twilioSocket) => {
  console.log("Twilio connected");

  /**
   * Connect to OpenAI Realtime API
   */
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
    console.log("Connected to OpenAI Realtime");
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


import express from "express";
import http from "http";
import dotenv from "dotenv";
import WebSocket, { WebSocketServer } from "ws";

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

/*
  Required for Twilio POST requests
*/
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/*
  Health check (browser test)
*/
app.get("/", (req, res) => {
  res.send("Dental AI Live Server Running");
});

/*
  REQUIRED: Twilio webhook endpoint
  Twilio will POST here first
*/
app.post("/", (req, res) => {
  res.set("Content-Type", "text/xml");
  res.send(`
    <Response>
      <Connect>
        <Stream url="wss://${req.headers.host}" />
      </Connect>
    </Response>
  `);
});

/*
  WebSocket server for Twilio Media Streams
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

  openaiSocket.send(JSON.stringify({
    type: "session.update",
    session: {
      instructions: "You are a professional dental office receptionist. Speak clearly, politely, and help patients schedule appointments.",
      voice: "alloy",
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw"
    }
  }));
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

  openaiSocket.on("error", (err) => {
    console.error("OpenAI Error:", err.message);
  });

  twilioSocket.on("error", (err) => {
    console.error("Twilio Socket Error:", err.message);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


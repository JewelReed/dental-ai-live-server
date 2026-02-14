import express from "express";
import http from "http";
import dotenv from "dotenv";
import WebSocket, { WebSocketServer } from "ws";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

/* ================================
   Express Setup
================================ */

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Dental AI Live Server Running");
});

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

/* ================================
   WebSocket Server
================================ */

const wss = new WebSocketServer({ server });

wss.on("connection", (twilioSocket) => {

  twilioSocket.setMaxListeners(0);
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

  let silenceTimer = null;

  /* ================================
     OpenAI Events
  ================================= */

  openaiSocket.on("open", () => {
    console.log("Connected to OpenAI");

    openaiSocket.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions:
          "You are a professional dental office receptionist. Speak clearly and politely.",
        voice: "alloy",
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw"
      }
    }));
  });

  openaiSocket.on("message", (message) => {
    const data = JSON.parse(message.toString());

    // Only forward audio deltas to Twilio
    if (data.type === "response.output_audio.delta") {
      if (twilioSocket.readyState === WebSocket.OPEN) {
        twilioSocket.send(JSON.stringify({
          event: "media",
          media: {
            payload: data.delta
          }
        }));
      }
    }
  });

  openaiSocket.on("close", () => {
    console.log("OpenAI disconnected");
  });

  openaiSocket.on("error", (err) => {
    console.error("OpenAI Error:", err.message);
  });

  /* ================================
     Twilio Events
  ================================= */

  twilioSocket.on("message", (message) => {
    const data = JSON.parse(message.toString());

    if (data.event === "media") {

      if (openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: data.media.payload
        }));
      }

      // Reset silence timer
      if (silenceTimer) clearTimeout(silenceTimer);

      silenceTimer = setTimeout(() => {

        if (openaiSocket.readyState === WebSocket.OPEN) {

          openaiSocket.send(JSON.stringify({
            type: "input_audio_buffer.commit"
          }));

          openaiSocket.send(JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio"],
              instructions:
                "Respond verbally as a dental office receptionist."
            }
          }));

        }

      }, 1000); // 1 second silence detection
    }

    if (data.event === "stop") {
      console.log("Twilio call ended");
      openaiSocket.close();
    }
  });

  twilioSocket.on("close", () => {
    console.log("Twilio disconnected");
    openaiSocket.close();
  });

  twilioSocket.on("error", (err) => {
    console.error("Twilio Socket Error:", err.message);
  });

});

/* ================================
   Start Server
================================ */

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

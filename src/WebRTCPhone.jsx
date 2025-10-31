import React, { useEffect, useRef, useState } from "react";
import JsSIP from "jssip";

let ua = null;
let currentSession = null;

const WSS_URL = "wss://srv762442.hstgr.cloud:8089/ws";
const SIP_DOMAIN = "srv762442.hstgr.cloud";

// Ramal WebRTC (pjsip.conf)
const EXTENSION_USER = "3000";
const EXTENSION_PASS = "senha123";
const DISPLAY_NAME = "WebRTC 3000";

// Converte entradas comuns (com/sem +, com 00/011, com DDD) para E.164.
// Foco Brasil (+55). Se já vier com +, mantém.
function normalizeE164(numberRaw) {
  let n = (numberRaw || "").replace(/[^\d+]/g, "");
  if (!n) return "";
  if (n.startsWith("+")) return n;                   // já E.164
  if (n.startsWith("00")) n = `+${n.slice(2)}`;      // 00 -> +
  else if (n.startsWith("011")) n = `+${n.slice(3)}`;// 011 -> +
  // Brasil: 10 ou 11 dígitos (fixo/celular com DDD) -> presume +55
  if (/^\d{10,11}$/.test(n)) return `+55${n}`;
  // Se vier 12/13 dígitos sem + (ex.: 55119...), adiciona +
  if (/^\d{12,13}$/.test(n)) return `+${n}`;
  return n;
}

const WebRTCPhone = () => {
  const [status, setStatus] = useState("Desconectado");
  const [destino, setDestino] = useState("+5519989751609"); // número exemplo em E.164
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    const socket = new JsSIP.WebSocketInterface(WSS_URL);

    const configuration = {
      sockets: [socket],
      uri: `sip:${EXTENSION_USER}@${SIP_DOMAIN}`,
      password: EXTENSION_PASS,
      authorization_user: EXTENSION_USER,
      display_name: DISPLAY_NAME,
      session_timers: false,
      pcConfig: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          // Recomendado em produção:
          // { urls: "turn:SEU_TURN:3478", username: "user", credential: "pass" },
        ],
      },
    };

    ua = new JsSIP.UA(configuration);

    // Eventos da UA
    ua.on("connected", () => setStatus("Conectado ao WebSocket"));
    ua.on("disconnected", () => setStatus("Desconectado"));

    ua.on("registered", () => setStatus("Registrado no Asterisk"));
    ua.on("unregistered", () => setStatus("Não registrado"));
    ua.on("registrationFailed", (e) => {
      console.error("Registro falhou:", e.cause);
      setStatus(`Falha no registro: ${e.cause || ""}`);
    });

    ua.on("newRTCSession", (e) => {
      const session = e.session;
      currentSession = session;

      bindSessionEvents(session);
      attachRemoteAudio(session);

      if (session.direction === "incoming") {
        setStatus("Recebendo chamada…");
        // Auto-answer para testes. Em produção, apresentar UI de atender/recusar.
        session.answer({
          mediaConstraints: { audio: true, video: false },
          pcConfig: configuration.pcConfig,
        });
      }
    });

    ua.start();

    return () => {
      try {
        if (currentSession && currentSession.isEstablished()) {
          currentSession.terminate();
        }
        if (ua) ua.stop();
      } catch (err) {
        console.warn("Cleanup UA:", err);
      }
    };
  }, []);

  const bindSessionEvents = (session) => {
    session.on("progress", () => setStatus("Chamando…"));
    session.on("accepted", () => setStatus("Conectado!"));
    session.on("confirmed", () => setStatus("Estabelecida"));
    session.on("ended", () => {
      setStatus("Encerrado");
      currentSession = null;
    });
    session.on("failed", (e) => {
      console.error("Chamada falhou:", e.cause);
      setStatus(`Falhou: ${e.cause || ""}`);
      currentSession = null;
    });
  };

  const attachRemoteAudio = (session) => {
    const pc = session.connection;
    if (!pc) return;
    pc.addEventListener("track", (event) => {
      const stream = event.streams && event.streams[0];
      if (stream && remoteAudioRef.current) {
        if (remoteAudioRef.current.srcObject !== stream) {
          remoteAudioRef.current.srcObject = stream;
        }
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current
          .play()
          .catch((err) =>
            console.warn("Autoplay bloqueado. Interaja com a página primeiro.", err)
          );
      }
    });
  };

  const ligar = () => {
    if (!ua) return;

    const e164 = normalizeE164(destino);
    if (!e164) {
      setStatus("Número inválido");
      return;
    }

    // Disca para o Asterisk; o contexto [discagem] envia para Twilio como:
    // Dial(PJSIP/twilio-endpoint/sip:+E164@imersa.pstn.twilio.com)
    const target = `sip:${e164}@${SIP_DOMAIN}`;

    const options = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: ua.configuration.pcConfig,
    };

    currentSession = ua.call(target, options);
    bindSessionEvents(currentSession);
    attachRemoteAudio(currentSession);
  };

  const desligar = () => {
    if (currentSession) {
      currentSession.terminate();
      setStatus("Chamada encerrada");
      currentSession = null;
    }
  };

  const enviarDTMF = (digit) => {
    if (currentSession) {
      currentSession.sendDTMF(digit);
    }
  };

  return (
    <div style={{ fontFamily: "Inter, Arial", padding: 16, maxWidth: 460 }}>
      <h2>WebRTC Phone (JsSIP)</h2>
      <p>
        Status: <b>{status}</b>
      </p>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto" }}>
        <input
          type="text"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          placeholder="Ex.: +5511999999999, 11999999999, 0115511..., 00..."
          style={{ padding: 8 }}
        />
        <button onClick={ligar}>Ligar</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={desligar}>Desligar</button>
        <button onClick={() => enviarDTMF("1")}>DTMF 1</button>
        <button onClick={() => enviarDTMF("2")}>DTMF 2</button>
        <button onClick={() => enviarDTMF("3")}>DTMF 3</button>
      </div>

      {/* áudio remoto oculto */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
    </div>
  );
};

export default WebRTCPhone;

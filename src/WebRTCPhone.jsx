import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import JsSIP from "jssip";
import { SIP_CONFIG } from "./config";

let ua = null;
let currentSession = null;

const SIP_DOMAIN = SIP_CONFIG.domain;

function normalizePBX(numberRaw) {
  const raw = (numberRaw || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/[^\d]/g, "");
    return "+" + digits;
  }
  const n = raw.replace(/[^\d]/g, "");

  if (/^\d{8,9}$/.test(n)) return n;
  if (/^\d{10,11}$/.test(n)) return n;
  if (/^\d{12,13}$/.test(n)) return n;
  return n;
}

const WebRTCPhone = () => {
  const { numero } = useParams();

  const [status, setStatus] = useState("Desconectado");
  const [destino, setDestino] = useState("");
  const [inCall, setInCall] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isDialing, setIsDialing] = useState(false);

  const [sipUser, setSipUser] = useState(null);
  const [sipPass, setSipPass] = useState(null);
  const [wssUrl, setWssUrl] = useState(null);

  const remoteAudioRef = useRef(null);
  const errorTimeoutRef = useRef(null);

  useEffect(() => {
    if (numero) setDestino(decodeURIComponent(numero));
  }, [numero]);

  // ======================================================
  // 🔥  Registro SIP
  // ======================================================
  useEffect(() => {
    function startUA() {
      try {
        // Usa configuração fixa
        const ext = SIP_CONFIG.extensions.find(
          e => e.extension === SIP_CONFIG.defaultExtension
        ) || SIP_CONFIG.extensions[0];
        
        const extData = {
          extension: ext.extension,
          password: ext.password,
          wss: SIP_CONFIG.wssUrl
        };
        
        console.log("🟢 Usando ramal:", extData.extension);
        console.log("🔌 URL WebSocket:", extData.wss);

        setSipUser(extData.extension);
        setSipPass(extData.password);
        setWssUrl(extData.wss);

        const socket = new JsSIP.WebSocketInterface(extData.wss);
        socket.via_transport = "wss";

        const configuration = {
          sockets: [socket],
          uri: `sip:${extData.extension}@${SIP_DOMAIN}`,
          authorization_user: extData.extension,
          password: extData.password,
          display_name: `WebRTC ${extData.extension}`,
          session_timers: false,
          pcConfig: {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          },
        };

        ua = new JsSIP.UA(configuration);

        // UA EVENTS
        ua.on("connected", () => setStatus("Conectado ao WebSocket"));
        ua.on("disconnected", () => setStatus("Desconectado"));

        ua.on("registered", () => {
          console.log("UA registrado:", extData.extension);
          setStatus(`Registrado como ${extData.extension}`);
        });

        ua.on("registrationFailed", (e) =>
          setStatus("Falha no registro: " + (e.cause || ""))
        );
        ua.on("unregistered", () => setStatus("Não registrado"));

        ua.on("newRTCSession", (e) => {
          const session = e.session;

          if (currentSession && currentSession !== session) {
            if (session.direction === "incoming") {
              session.terminate({
                status_code: 486,
                reason_phrase: "Busy Here",
              });
            }
            return;
          }

          currentSession = session;
          bindSessionEvents(session);
          attachRemoteAudio(session);

          if (session.direction === "incoming") {
            setStatus("Recebendo chamada…");
            setInCall(true);
            session.answer({
              mediaConstraints: { audio: true, video: false },
              pcConfig: configuration.pcConfig,
            });
          }
        });

        ua.start();
      } catch (err) {
        console.error("❌ Erro no registro:", err);
      }
    }

    startUA();

    // Cleanup
    return () => {
      if (ua) ua.stop();
    };
  }, []);

  // ======================================================
  // Auto-chamada quando número vier na URL
  // ======================================================
  useEffect(() => {
    if (numero && ua && !currentSession && !isDialing) {
      // Aguarda um pouco para garantir que o UA está registrado
      const timer = setTimeout(() => {
        if (ua && ua.isRegistered() && !currentSession) {
          iniciarChamada();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [numero, ua]);

  // ======================================================
  // Sessão / Audio / Eventos
  // ======================================================

  const bindSessionEvents = (session) => {
    session.on("progress", () => {
      setStatus("Chamando…");
      setShowError(false);
      setIsDialing(false);
    });

    session.on("accepted", () => {
      setStatus("Conectado!");
      setInCall(true);
      setShowError(false);
    });

    session.on("confirmed", () => {
      setStatus("Estabelecida");
      setShowError(false);
    });

    session.on("ended", () => {
      setStatus("Encerrado");
      setInCall(false);
      currentSession = null;
      setShowError(false);
    });

    session.on("failed", (e) => {
      const cause = e.cause || "Falhou";
      console.error("❌ Chamada falhou:", e);
      console.error("Causa:", cause);
      console.error("Originator:", e.originator);
      console.error("Message:", e.message);
      setStatus("Falhou: " + cause);
      setInCall(false);
      setShowError(true);
      currentSession = null;
      setIsDialing(false);

      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        setShowError(false);
        setStatus("Registrado");
      }, 4000);
    });
  };

  const attachRemoteAudio = (session) => {
    const pc = session.connection;
    if (!pc) return;
    pc.addEventListener("track", (event) => {
      const stream = event.streams[0];
      if (stream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    });
  };

  // ======================================================
  // Chamadas
  // ======================================================

  const iniciarChamada = () => {
    if (!ua) {
      console.error("❌ UA não inicializado");
      setStatus("Sistema não inicializado");
      setShowError(true);
      return;
    }

    if (isDialing || currentSession) {
      console.warn("⚠️ Já existe uma chamada em andamento");
      return;
    }

    // Verifica se está conectado
    if (!ua.isConnected()) {
      console.error("❌ WebSocket não conectado");
      setStatus("WebSocket não conectado. Verifique a URL.");
      setShowError(true);
      return;
    }

    // Verifica se está registrado
    if (!ua.isRegistered()) {
      console.error("❌ UA não registrado no servidor SIP");
      setStatus("Não registrado no servidor SIP");
      setShowError(true);
      return;
    }

    const pbxNumber = normalizePBX(destino);
    if (!pbxNumber) {
      setStatus("Número inválido");
      setShowError(true);
      return;
    }

    // Força E.164 com +55 para externos; mantém internos (8-9) inalterados
    let dialNumber = pbxNumber;
    const countryId = (SIP_CONFIG && SIP_CONFIG.countryId) || "55";
    const isInternal = /^\d{8,9}$/.test(pbxNumber);

    if (!isInternal) {
      if (pbxNumber.startsWith("+")) {
        // já está em E.164
        dialNumber = pbxNumber;
      } else if (/^\d{10,11}$/.test(pbxNumber)) {
        // nacional sem DDI -> +55 + DDD+numero
        dialNumber = `+${countryId}${pbxNumber}`;
      } else if (new RegExp(`^${countryId}\\d{10,11}$`).test(pbxNumber)) {
        // começa com 55 sem + -> adiciona +
        dialNumber = `+${pbxNumber}`;
      } else if (/^\d{12,15}$/.test(pbxNumber)) {
        // outro DDI sem + -> adiciona +
        dialNumber = `+${pbxNumber}`;
      }
    }

    console.log("📞 Iniciando chamada para:", dialNumber);
    setIsDialing(true);
    const target = `sip:${dialNumber}@${SIP_DOMAIN}`;

    const options = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: ua.configuration.pcConfig,
    };

    try {
      const newSession = ua.call(target, options);
      currentSession = newSession;
      bindSessionEvents(newSession);
      attachRemoteAudio(newSession);
    } catch (err) {
      console.error("❌ Erro ao iniciar chamada:", err);
      setStatus("Erro ao iniciar chamada");
      setShowError(true);
      setIsDialing(false);
    }
  };

  const desligar = () => {
    if (currentSession) {
      currentSession.terminate();
      setInCall(false);
      currentSession = null;
    }
  };

  const enviarDTMF = (digit) => {
    if (currentSession) currentSession.sendDTMF(digit);
  };

  // ======================================================
  // UI
  // (todo seu layout foi mantido)
  // ======================================================

  return (
    <div style={{ padding: "40px" }}>
      <h2>WebRTC Phone ({sipUser || "..."})</h2>
      <p>Status: {status}</p>

      <input
        value={destino}
        onChange={(e) => setDestino(e.target.value)}
        placeholder="Número"
      />

      <div style={{ marginBottom: "20px" }}>
        <button onClick={iniciarChamada} disabled={inCall || isDialing}>
          Ligar
        </button>
        <button 
          onClick={desligar} 
          disabled={!inCall}
          style={{ marginLeft: "10px", backgroundColor: "red", color: "white" }}
        >
          Desligar
        </button>
      </div>

      {inCall && (
        <>
          <h3>DTMF</h3>
          {["1", "2", "3", "*", "0", "#"].map((d) => (
            <button key={d} onClick={() => enviarDTMF(d)}>
              {d}
            </button>
          ))}
        </>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
};

export default WebRTCPhone;

// Removed duplicate UI and styles to revert to original simpler layout

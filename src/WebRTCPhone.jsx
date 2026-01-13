import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import JsSIP from "jssip";
import { SIP_CONFIG } from "./config";

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
  const [sipRegistered, setSipRegistered] = useState(false);

  const [sipUser, setSipUser] = useState(null);
  const [wssUrl, setWssUrl] = useState(null);

  const uaRef = useRef(null);
  const currentSessionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const callBlockedRef = useRef(false);

  useEffect(() => {
    if (numero) setDestino(decodeURIComponent(numero));
  }, [numero]);

  useEffect(() => {
    callBlockedRef.current = false;
  }, [destino]);

  const attachRemoteAudio = useCallback((session) => {
    const pc = session.connection;
    if (!pc) return;
    pc.addEventListener("track", (event) => {
      const stream = event.streams[0];
      if (stream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    });
  }, []);

  const bindSessionEvents = useCallback((session) => {
    session.on("progress", () => {
      setStatus("Chamando…");
      setShowError(false);
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
      currentSessionRef.current = null;
      setShowError(false);
    });

    session.on("failed", (e) => {
      const cause = e.cause || "Falhou";
      const statusCode = e?.response?.status_code;
      const isRejected =
        cause === JsSIP.C.causes.REJECTED ||
        String(cause).toLowerCase() === "rejected" ||
        statusCode === 603;

      console.error("❌ Chamada falhou:", e);
      console.error("Causa:", cause);
      console.error("Originator:", e.originator);
      console.error("Message:", e.message);

      if (isRejected) {
        callBlockedRef.current = true;
        setStatus("Rejeitado");
        setInCall(false);
        setShowError(true);
        currentSessionRef.current = null;
        setIsDialing(false);
        return;
      }

      setStatus("Falhou: " + cause);
      setInCall(false);
      setShowError(true);
      currentSessionRef.current = null;
      setIsDialing(false);

      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        setShowError(false);
        setStatus("Registrado");
      }, 4000);
    });
  }, []);

  const iniciarChamada = useCallback(() => {
    const ua = uaRef.current;
    const currentSession = currentSessionRef.current;

    if (callBlockedRef.current) {
      setStatus("Chamada rejeitada. Altere o número para tentar novamente.");
      setShowError(true);
      return;
    }

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

    if (!ua.isConnected()) {
      console.error("❌ WebSocket não conectado");
      setStatus("WebSocket não conectado. Verifique a URL.");
      setShowError(true);
      return;
    }

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

    let dialNumber = pbxNumber;
    const countryId = (SIP_CONFIG && SIP_CONFIG.countryId) || "55";
    const isInternal = /^\d{8,9}$/.test(pbxNumber);

    if (!isInternal) {
      if (pbxNumber.startsWith("+")) {
        dialNumber = pbxNumber;
      } else if (/^\d{10,11}$/.test(pbxNumber)) {
        dialNumber = `+${countryId}${pbxNumber}`;
      } else if (new RegExp(`^${countryId}\\d{10,11}$`).test(pbxNumber)) {
        dialNumber = `+${pbxNumber}`;
      } else if (/^\d{12,15}$/.test(pbxNumber)) {
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
      currentSessionRef.current = newSession;
      bindSessionEvents(newSession);
      attachRemoteAudio(newSession);
    } catch (err) {
      console.error("❌ Erro ao iniciar chamada:", err);
      setStatus("Erro ao iniciar chamada");
      setShowError(true);
      setIsDialing(false);
    }
  }, [attachRemoteAudio, bindSessionEvents, destino, isDialing]);

  // ======================================================
  // 🔥  Registro SIP
  // ======================================================
  useEffect(() => {
    let isCancelled = false;

    async function fetchFreeExtension() {
      const base = (SIP_CONFIG && SIP_CONFIG.amiApiBaseUrl) || "";
      if (!base) return null;

      const url = `${base.replace(/\/$/, "")}/extensions/free`;
      const res = await fetch(url, { method: "GET" });

      if (res.status === 404) {
        return { noFreeExtensions: true };
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Falha ao buscar ramal livre: HTTP ${res.status} ${text}`);
      }

      return res.json();
    }

    async function startUA() {
      try {
        setSipRegistered(false);

        let extData = null;

        try {
          const apiData = await fetchFreeExtension();
          if (isCancelled) return;

          if (apiData && apiData.noFreeExtensions) {
            setStatus("Sem ramal livre disponível");
            setShowError(true);
            return;
          }

          if (apiData && apiData.extension && apiData.password && apiData.wss) {
            extData = {
              extension: String(apiData.extension),
              password: String(apiData.password),
              wss: String(apiData.wss),
            };
          }
        } catch (err) {
          console.error("❌ Erro ao obter ramal livre no micro-serviço:", err);
        }

        if (!extData) {
          const ext =
            SIP_CONFIG.extensions.find(
              (e) => e.extension === SIP_CONFIG.defaultExtension
            ) || SIP_CONFIG.extensions[0];

          extData = {
            extension: ext.extension,
            password: ext.password,
            wss: SIP_CONFIG.wssUrl,
          };

          setStatus("Falha ao obter ramal livre; usando ramal fixo");
        }
        
        console.log("🟢 Usando ramal:", extData.extension);
        console.log("🔌 URL WebSocket:", extData.wss);

        setSipUser(extData.extension);
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

        uaRef.current = new JsSIP.UA(configuration);
        const ua = uaRef.current;

        // UA EVENTS
        ua.on("connected", () => setStatus("Conectado ao WebSocket"));
        ua.on("disconnected", () => setStatus("Desconectado"));

        ua.on("registered", () => {
          console.log("UA registrado:", extData.extension);
          setStatus(`Registrado como ${extData.extension}`);
          setSipRegistered(true);
        });

        ua.on("registrationFailed", (e) =>
          setStatus("Falha no registro: " + (e.cause || ""))
        );
        ua.on("unregistered", () => {
          setSipRegistered(false);
          setStatus("Não registrado");
        });

        ua.on("newRTCSession", (e) => {
          const session = e.session;

          if (currentSessionRef.current && currentSessionRef.current !== session) {
            if (session.direction === "incoming") {
              session.terminate({
                status_code: 486,
                reason_phrase: "Busy Here",
              });
            }
            return;
          }

          currentSessionRef.current = session;
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
      isCancelled = true;
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      const ua = uaRef.current;
      if (ua) ua.stop();
      uaRef.current = null;
      currentSessionRef.current = null;
    };
  }, [attachRemoteAudio, bindSessionEvents]);

  const desligar = () => {
    if (currentSessionRef.current) {
      currentSessionRef.current.terminate();
      setInCall(false);
      currentSessionRef.current = null;
    }
  };

  const enviarDTMF = (digit) => {
    if (currentSessionRef.current) currentSessionRef.current.sendDTMF(digit);
  };

  // ======================================================
  // UI
  // (todo seu layout foi mantido)
  // ======================================================

  return (
    <div style={{ padding: "40px" }}>
      <h2>WebRTC Phone ({sipUser || "..."})</h2>
      <p>Status: {status}</p>
      {wssUrl && (
        <p style={{ fontSize: "12px", opacity: 0.8 }}>WSS: {wssUrl}</p>
      )}
      {showError && (
        <p style={{ color: "red" }}>Ocorreu um erro. Verifique o status acima.</p>
      )}

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
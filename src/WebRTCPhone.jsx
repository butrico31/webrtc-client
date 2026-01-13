import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import JsSIP from "jssip";
import { SIP_CONFIG } from "./config";
import "./WebRTCPhone.css";

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

  const logEvent = useCallback((scope, name, payload) => {
    const ts = new Date().toISOString();
    const label = `[${ts}] [${scope}] ${name}`;
    if (payload === undefined) {
      // eslint-disable-next-line no-console
      console.log(label);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(label, payload);
  }, []);

  const logAsteriskEvent = useCallback((label, payload) => {
    const ts = new Date().toISOString();
    if (payload === undefined) {
      // eslint-disable-next-line no-console
      console.log(`[${ts}] [ASTERISK] ${label}`);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`[${ts}] [ASTERISK] ${label}`, payload);
  }, []);

  const [status, setStatus] = useState("Desconectado");
  const [destino, setDestino] = useState("");
  const [inCall, setInCall] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isDialing, setIsDialing] = useState(false);

  const [sipUser, setSipUser] = useState(null);
  const [wssUrl, setWssUrl] = useState(null);

  const uaRef = useRef(null);
  const currentSessionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const callBlockedRef = useRef(false);

  const asteriskWsRef = useRef(null);
  const asteriskSseRef = useRef(null);

  // ======================================================
  // 📡 Eventos do Asterisk (AMI Listener)
  // ======================================================
  useEffect(() => {
    const base =
      (SIP_CONFIG && SIP_CONFIG.amiApiBaseUrl) ||
      process.env.REACT_APP_AMI_API_BASE_URL ||
      "";

    if (!base) return;

    const eventsPath =
      (SIP_CONFIG && SIP_CONFIG.amiEventsPath) ||
      process.env.REACT_APP_AMI_EVENTS_PATH ||
      "/events";

    let isCancelled = false;

    const normalizeJoin = (left, right) => {
      const l = String(left || "").replace(/\/$/, "");
      const r = String(right || "");
      if (!r) return l;
      if (r.startsWith("/")) return `${l}${r}`;
      return `${l}/${r}`;
    };

    const httpUrl = normalizeJoin(base, eventsPath);
    const wsUrl = httpUrl.replace(/^https?:\/\//, (m) =>
      m === "https://" ? "wss://" : "ws://"
    );

    const startTimer = setTimeout(() => {
      if (isCancelled) return;

      // 1) Tenta WebSocket (mais comum p/ streaming)
      try {
        logAsteriskEvent("connect:ws", { wsUrl });
        const ws = new WebSocket(wsUrl);
        asteriskWsRef.current = ws;

        ws.onopen = () => logAsteriskEvent("ws:open");
        ws.onclose = (ev) =>
          logAsteriskEvent("ws:close", {
            code: ev.code,
            reason: ev.reason,
            wasClean: ev.wasClean,
          });
        ws.onerror = () => {
          logAsteriskEvent("ws:error");
        };
        ws.onmessage = (msg) => {
          const text = typeof msg.data === "string" ? msg.data : "";
          if (!text) {
            logAsteriskEvent("event", { dataType: typeof msg.data });
            return;
          }

          try {
            const json = JSON.parse(text);
            logAsteriskEvent("event", json);
          } catch (_) {
            logAsteriskEvent("event", text);
          }
        };

        return;
      } catch (err) {
        logAsteriskEvent("ws:exception", { message: err?.message, name: err?.name });
      }

      // 2) Fallback SSE (EventSource)
      if (typeof EventSource === "undefined") {
        logAsteriskEvent("sse:unsupported");
        return;
      }

      try {
        logAsteriskEvent("connect:sse", { httpUrl });
        const es = new EventSource(httpUrl);
        asteriskSseRef.current = es;

        es.onopen = () => logAsteriskEvent("sse:open");
        es.onerror = () => logAsteriskEvent("sse:error");
        es.onmessage = (ev) => {
          const text = ev.data;
          try {
            const json = JSON.parse(text);
            logAsteriskEvent("event", json);
          } catch (_) {
            logAsteriskEvent("event", text);
          }
        };
      } catch (err) {
        logAsteriskEvent("sse:exception", { message: err?.message, name: err?.name });
      }
    }, 0);

    return () => {
      isCancelled = true;
      clearTimeout(startTimer);

      if (asteriskWsRef.current) {
        try {
          asteriskWsRef.current.close();
        } catch (_) {}
        asteriskWsRef.current = null;
      }

      if (asteriskSseRef.current) {
        try {
          asteriskSseRef.current.close();
        } catch (_) {}
        asteriskSseRef.current = null;
      }
    };
  }, [logAsteriskEvent]);

  useEffect(() => {
    if (numero) {
      const decoded = decodeURIComponent(numero);
      logEvent("ROUTE", "param:numero", { numero, decoded });
      setDestino(decoded);
    }
  }, [logEvent, numero]);

  useEffect(() => {
    callBlockedRef.current = false;
    logEvent("CALL", "block:reset", { destino });
  }, [destino, logEvent]);

  const attachRemoteAudio = useCallback((session) => {
    const pc = session.connection;
    if (!pc) return;
    pc.addEventListener("track", (event) => {
      logEvent("RTC", "pc:track", {
        kind: event?.track?.kind,
        streams: (event?.streams || []).length,
      });
      const stream = event.streams[0];
      if (stream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    });
  }, [logEvent]);

  const bindSessionEvents = useCallback((session) => {
    const sessionId = session?.id;
    logEvent("RTC", "session:bind", {
      sessionId,
      direction: session?.direction,
      remoteUri: session?.remote_identity?.uri?.toString?.(),
    });

    // Eventos extras (só log, sem alterar estado)
    [
      "peerconnection",
      "connecting",
      "sending",
      "newDTMF",
      "newInfo",
      "hold",
      "unhold",
      "muted",
      "unmuted",
      "reinvite",
      "update",
      "refer",
      "replaces",
      "sdp",
    ].forEach((evt) => {
      session.on(evt, (data) => {
        logEvent("RTC", `session:${evt}`, { sessionId, data });
      });
    });

    session.on("progress", () => {
      logEvent("RTC", "session:progress", { sessionId });
      setStatus("Chamando…");
      setShowError(false);
    });

    session.on("accepted", () => {
      logEvent("RTC", "session:accepted", { sessionId });
      setStatus("Conectado!");
      setInCall(true);
      setShowError(false);
      setIsDialing(false);
    });

    session.on("confirmed", () => {
      logEvent("RTC", "session:confirmed", { sessionId });
      setStatus("Estabelecida");
      setShowError(false);
      setIsDialing(false);
    });

    session.on("ended", () => {
      logEvent("RTC", "session:ended", { sessionId });
      setStatus("Encerrado");
      setInCall(false);
      currentSessionRef.current = null;
      setShowError(false);
      setIsDialing(false);

      // Qualquer chamada encerrada não deve redial automaticamente.
      // Bloqueia novas tentativas até o usuário alterar o número (destino).
      callBlockedRef.current = true;
    });

    session.on("failed", (e) => {
      const cause = e.cause || "Falhou";
      const statusCode = e?.response?.status_code;
      const isRejected =
        cause === JsSIP.C.causes.REJECTED ||
        String(cause).toLowerCase() === "rejected" ||
        statusCode === 603;

      logEvent("RTC", "session:failed", {
        sessionId,
        cause,
        statusCode,
        originator: e?.originator,
        isRejected,
      });

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

      // Em qualquer falha, não tentar ligar novamente automaticamente.
      callBlockedRef.current = true;

      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        setShowError(false);
        // Mantém o status de falha visível; não volta para "Registrado" aqui.
      }, 4000);
    });
  }, [logEvent]);

  const iniciarChamada = useCallback(() => {
    const ua = uaRef.current;
    const currentSession = currentSessionRef.current;

    logEvent("CALL", "start", {
      destino,
      blocked: callBlockedRef.current,
      hasSession: Boolean(currentSession),
      isDialing,
      uaExists: Boolean(ua),
      uaConnected: ua?.isConnected?.(),
      uaRegistered: ua?.isRegistered?.(),
    });

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

    logEvent("CALL", "outgoing", { pbxNumber, dialNumber, target });

    const options = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: ua.configuration.pcConfig,
    };

    try {
      const newSession = ua.call(target, options);
      logEvent("CALL", "ua.call:created", { sessionId: newSession?.id, target });
      currentSessionRef.current = newSession;
      bindSessionEvents(newSession);
      attachRemoteAudio(newSession);
    } catch (err) {
      console.error("❌ Erro ao iniciar chamada:", err);
      logEvent("CALL", "start:error", { name: err?.name, message: err?.message });
      setStatus("Erro ao iniciar chamada");
      setShowError(true);
      setIsDialing(false);
    }
  }, [attachRemoteAudio, bindSessionEvents, destino, isDialing, logEvent]);

  // ======================================================
  // 🔥  Registro SIP
  // ======================================================
  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    async function fetchFreeExtension(signal) {
      const base = (SIP_CONFIG && SIP_CONFIG.amiApiBaseUrl) || "";
      if (!base) return null;

      const url = `${base.replace(/\/$/, "")}/extensions/free`;
      logEvent("AMI", "extensions:free:request", { url });
      const res = await fetch(url, { method: "GET", signal });

      logEvent("AMI", "extensions:free:response", { url, status: res.status });

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
        logEvent("UA", "start", {});
        let extData = null;

        try {
          const apiData = await fetchFreeExtension(abortController.signal);
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
          logEvent("AMI", "extensions:free:error", {
            name: err?.name,
            message: err?.message,
          });
        }

        if (!extData) {
          const extensions = (SIP_CONFIG && SIP_CONFIG.extensions) || [];
          if (!extensions.length) {
            setStatus("Nenhum ramal configurado");
            setShowError(true);
            return;
          }

          let chosenIndex = 0;
          try {
            const raw = window.localStorage.getItem("webrtc:fallbackExtIndex");
            const parsed = Number(raw);
            if (Number.isFinite(parsed) && parsed >= 0) chosenIndex = parsed;
          } catch (_) {}

          const ext = extensions[chosenIndex % extensions.length] || extensions[0];

          try {
            window.localStorage.setItem(
              "webrtc:fallbackExtIndex",
              String((chosenIndex + 1) % extensions.length)
            );
          } catch (_) {}

          extData = {
            extension: String(ext.extension),
            password: String(ext.password),
            wss: SIP_CONFIG.wssUrl,
          };

          setStatus(
            `Falha ao obter ramal livre; usando fallback local (${extData.extension})`
          );
        }
        
        console.log("🟢 Usando ramal:", extData.extension);
        console.log("🔌 URL WebSocket:", extData.wss);

        logEvent("UA", "config", { extension: extData.extension, wss: extData.wss });

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
        [
          "connected",
          "disconnected",
          "registered",
          "unregistered",
          "registrationFailed",
          "newRTCSession",
          "newMessage",
          "sipEvent",
        ].forEach((evt) => {
          ua.on(evt, (data) => {
            logEvent("UA", evt, data);
          });
        });

        ua.on("connected", () => setStatus("Conectado ao WebSocket"));
        ua.on("disconnected", () => setStatus("Desconectado"));

        ua.on("registered", () => {
          console.log("UA registrado:", extData.extension);
          setStatus(`Registrado como ${extData.extension}`);
        });

        ua.on("registrationFailed", (e) =>
          setStatus("Falha no registro: " + (e.cause || ""))
        );
        ua.on("unregistered", () => {
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
        logEvent("UA", "start:error", { name: err?.name, message: err?.message });
      }
    }

    // Em React 18 + StrictMode (dev), efeitos de mount são executados 2x
    // (mount -> cleanup -> mount). Ao atrasar um tick e cancelar no cleanup,
    // evitamos consumir 2 ramais no endpoint /extensions/free.
    const startTimer = setTimeout(() => {
      if (!isCancelled) startUA();
    }, 0);

    // Cleanup
    return () => {
      isCancelled = true;
      clearTimeout(startTimer);
      abortController.abort();
      logEvent("UA", "cleanup", {});
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      const ua = uaRef.current;
      if (ua) ua.stop();
      uaRef.current = null;
      currentSessionRef.current = null;
    };
  }, [attachRemoteAudio, bindSessionEvents, logEvent]);

  const desligar = () => {
    if (currentSessionRef.current) {
      logEvent("CALL", "hangup", { sessionId: currentSessionRef.current?.id });
      currentSessionRef.current.terminate();
      setInCall(false);
      currentSessionRef.current = null;
    }
  };

  const enviarDTMF = (digit) => {
    logEvent("CALL", "dtmf", { digit, sessionId: currentSessionRef.current?.id });
    if (currentSessionRef.current) currentSessionRef.current.sendDTMF(digit);
  };

  const statusLower = String(status || "").toLowerCase();
  const statusTone = showError
    ? "danger"
    : inCall
    ? "success"
    : isDialing
    ? "warning"
    : statusLower.includes("registrado")
    ? "success"
    : statusLower.includes("conectado")
    ? "info"
    : "neutral";

  const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

  return (
    <div className="webrtc-page">
      <div className="webrtc-shell">
        <div className="webrtc-header">
          <div>
            <div className="webrtc-title">WebRTC Phone</div>
            <div className="webrtc-subtitle">Ramal: {sipUser || "..."}</div>
          </div>

          <div className={`webrtc-badge webrtc-badge--${statusTone}`}>
            <span className="webrtc-badgeDot" />
            <span>{status || "—"}</span>
          </div>
        </div>

        <div className="webrtc-meta">
          {wssUrl && <div className="webrtc-metaLine">WSS: {wssUrl}</div>}
        </div>

        {showError && (
          <div className="webrtc-alert">Ocorreu um erro. Verifique o status acima.</div>
        )}

        <div className="webrtc-grid">
          <div className="webrtc-panel">
            <div className="webrtc-sectionTitle">
              <h3>Discagem</h3>
              <div className="webrtc-hint">
                {callBlockedRef.current
                  ? "Bloqueado até alterar o número"
                  : inCall
                  ? "Em chamada"
                  : isDialing
                  ? "Discando…"
                  : "Pronto"}
              </div>
            </div>

            <label className="webrtc-label" htmlFor="destino">
              Destino
            </label>
            <input
              id="destino"
              className="webrtc-input"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Ex.: 5511999998888"
              inputMode="tel"
              autoComplete="tel"
            />

            <div className="webrtc-actions">
              <button
                className="webrtc-btn webrtc-btn-primary"
                onClick={iniciarChamada}
                disabled={inCall || isDialing}
              >
                Ligar
              </button>
              <button
                className="webrtc-btn webrtc-btn-danger"
                onClick={desligar}
                disabled={!inCall}
              >
                Desligar
              </button>
            </div>

            <div className="webrtc-footer">
              Dica: se der “Rejeitado/Encerrado/Falhou”, altere o número para liberar nova tentativa.
            </div>
          </div>

          <div className="webrtc-panel">
            <div className="webrtc-sectionTitle">
              <h3>DTMF</h3>
              <div className="webrtc-hint">{inCall ? "Enviar tons" : "Disponível em chamada"}</div>
            </div>

            <div className="webrtc-keypad">
              {keypadDigits.map((d) => (
                <button
                  key={d}
                  className="webrtc-key"
                  onClick={() => enviarDTMF(d)}
                  disabled={!inCall}
                  type="button"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <audio ref={remoteAudioRef} autoPlay playsInline />
      </div>
    </div>
  );
};

export default WebRTCPhone;
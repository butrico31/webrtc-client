// Configuração de ramais SIP
export const SIP_CONFIG = {
  // Mock estático para testes
  domain: "srv762442.hstgr.cloud",
  wssUrl: "wss://srv762442.hstgr.cloud:8089/ws",
  amiApiBaseUrl: "http://localhost:3001",
  // Opcional: endpoint que faz stream dos eventos do Asterisk (AMI Listener)
  // Ex.: "/events" (default), "/events/stream", "/ws" etc.
  // amiEventsPath: "/events",
  countryId: "55",

  // Ramal fixo para testes
  defaultExtension: "3000",

  // Lista fixa de ramais (mock)
  extensions: [
    { extension: "3000", password: "senha123" },
    { extension: "3001", password: "senha123" },
  ],
};

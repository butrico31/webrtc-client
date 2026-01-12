// Configuração de ramais SIP
export const SIP_CONFIG = {
  // Mock estático para testes
  domain: "srv762442.hstgr.cloud",
  wssUrl: "wss://srv762442.hstgr.cloud:8089/ws",
  // Micro-serviço AMI Listener (para buscar ramal livre)
  // Em produção, configure via env: REACT_APP_AMI_API_BASE_URL
  amiApiBaseUrl: process.env.REACT_APP_AMI_API_BASE_URL || "http://localhost:3001",
  countryId: "55",

  // Ramal fixo para testes
  defaultExtension: "3000",

  // Lista fixa de ramais (mock)
  extensions: [
    { extension: "3000", password: "senha123" },
  ],
};

// Configuração de ramais SIP
export const SIP_CONFIG = {
  // Mock estático para testes
  domain: "srv762442.hstgr.cloud",
  wssUrl: "wss://srv762442.hstgr.cloud:8089/ws",
  amiApiBaseUrl: "https://srv762442.hstgr.cloud:3002",
  freeExtensionsPath: "/extensions/free",
  countryId: "55",

  // Senha padrão (caso a API retorne apenas o ramal)
  defaultPassword: "senha123",

  // Ramal fixo para testes
  defaultExtension: "3000",

  // Lista fixa de ramais (mock)
  extensions: [
    { extension: "3000", password: "senha123" },
    { extension: "3001", password: "senha123" },
  ],
};

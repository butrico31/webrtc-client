# 📚 Documentação Técnica - Sistema PJSIP

## Arquitetura

### Fluxo de Conexão

```
1. Inicialização → 2. Conexão WebSocket → 3. Registro SIP → 4. Pronto para chamadas
```

### Componentes Principais

#### 1. User Agent (UA)
- Gerencia conexão com servidor SIP
- Mantém registro do ramal
- Cria e gerencia sessões de chamada

#### 2. Session
- Representa uma chamada ativa
- Controla mídia (áudio)
- Gerencia estados da chamada

#### 3. WebSocket
- Transporte para sinalização SIP
- Requer conexão segura (WSS)

## Estados do Sistema

### Estados de Conexão
- `Inicializando...` - Sistema iniciando
- `Conectado` - WebSocket conectado
- `Desconectado` - Sem conexão
- `Registrado: XXX` - Ramal registrado

### Estados de Chamada
- `Chamando...` - Discando número
- `Em chamada` - Chamada aceita
- `Conectado` - Chamada estabelecida
- `Falha: motivo` - Erro na chamada

## Eventos JsSIP

### User Agent Events

```javascript
userAgent.on("connected", () => {})      // WebSocket conectado
userAgent.on("disconnected", () => {})   // WebSocket desconectado
userAgent.on("registered", () => {})     // Ramal registrado
userAgent.on("registrationFailed", () => {}) // Falha no registro
userAgent.on("newRTCSession", () => {})  // Nova sessão (chamada)
```

### Session Events

```javascript
session.on("progress", () => {})    // Chamada em progresso
session.on("accepted", () => {})    // Chamada aceita
session.on("confirmed", () => {})   // Chamada confirmada
session.on("ended", () => {})       // Chamada encerrada
session.on("failed", () => {})      // Chamada falhou
```

## Funções Principais

### initializeSIP()
Inicializa o User Agent e estabelece conexão com servidor SIP.

**Responsabilidades:**
- Criar WebSocket interface
- Configurar User Agent
- Registrar eventos
- Iniciar conexão

### makeCall()
Inicia uma nova chamada.

**Validações:**
- Verifica se UA está registrado
- Verifica se não há chamada ativa
- Normaliza número para E.164

**Fluxo:**
1. Normaliza número
2. Cria URI SIP: `sip:numero@dominio`
3. Inicia sessão com UA.call()
4. Registra eventos da sessão

### endCall()
Encerra chamada ativa.

**Ação:**
- Chama session.terminate()
- Limpa referência da sessão
- Atualiza estados

### sendDTMF(digit)
Envia tom DTMF durante chamada.

**Parâmetros:**
- `digit`: Caractere do teclado (0-9, *, #)

## Normalização de Números

A função `normalizeNumber()` converte números para formato E.164:

### Regras de Conversão

```javascript
// Nacional BR (10-11 dígitos)
"11999998888" → "+5511999998888"

// Internacional com 00
"001234567890" → "+1234567890"

// Internacional com 011
"0111234567890" → "+1234567890"

// 12-13 dígitos
"5511999998888" → "+5511999998888"

// Já tem +
"+5511999998888" → "+5511999998888"
```

## Configuração de Mídia

### PCConfig (PeerConnection)
```javascript
pcConfig: {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
}
```

**STUN Server:** Usado para descobrir IP público e estabelecer conexão P2P.

### MediaConstraints
```javascript
mediaConstraints: {
  audio: true,
  video: false
}
```

## Tratamento de Áudio

### Anexando Stream Remoto
```javascript
pc.addEventListener("track", (event) => {
  const [stream] = event.streams;
  audioElement.srcObject = stream;
  audioElement.play();
});
```

### Elemento HTML
```jsx
<audio ref={remoteAudioRef} autoPlay playsInline />
```

**Atributos:**
- `autoPlay`: Reproduz automaticamente
- `playsInline`: Necessário para iOS

## Segurança

### Requisitos
- ✅ HTTPS obrigatório para WebRTC
- ✅ WSS (WebSocket seguro) obrigatório
- ✅ Permissão de microfone do navegador

### Boas Práticas
- Não expor senhas no código
- Usar variáveis de ambiente em produção
- Validar entrada de usuário
- Implementar rate limiting

## Performance

### Otimizações Implementadas
- ✅ Uso de refs para elementos DOM
- ✅ Cleanup de eventos em useEffect
- ✅ Variáveis globais para UA e sessão
- ✅ Validações antes de ações custosas

### Memória
- UA é singleton global
- Session é limpa após término
- Refs não causam re-renders

## Debugging

### Console Logs
Mensagens formatadas com emojis para facilitar identificação:
- 📞 Eventos de chamada
- ✅ Sucessos
- ❌ Erros
- 📟 DTMF
- 📴 Desconexões

### Verificações Comuns

```javascript
// Verificar estado do UA
console.log(userAgent.isConnected())
console.log(userAgent.isRegistered())

// Verificar sessão ativa
console.log(activeSession)
console.log(activeSession?.isInProgress())
```

## Extensões Futuras

### Possíveis Melhorias
- [ ] Histórico de chamadas
- [ ] Lista de contatos
- [ ] Transferência de chamadas
- [ ] Conferência (3+ participantes)
- [ ] Gravação de chamadas
- [ ] Estatísticas de qualidade (MOS)
- [ ] Suporte a vídeo
- [ ] Múltiplos ramais simultâneos
- [ ] Modo escuro
- [ ] Internacionalização (i18n)

## Compatibilidade

### Navegadores Suportados
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+ (com limitações)
- ✅ Edge 79+

### Requisitos do Navegador
- WebRTC support
- WebSocket support
- ES6+ support
- Media devices API

## API Reference

### Props do Componente
Nenhum prop obrigatório. Aceita número via URL params.

### Variáveis Globais
```javascript
let userAgent = null      // Instância do JsSIP.UA
let activeSession = null  // Sessão de chamada ativa
```

### Estados React
```javascript
const [status, setStatus] = useState()           // Status da conexão
const [phoneNumber, setPhoneNumber] = useState() // Número a discar
const [inCall, setInCall] = useState()           // Em chamada?
const [registered, setRegistered] = useState()   // Registrado?
```

## Testes

### Teste Manual
1. Abrir console do navegador
2. Verificar logs de conexão
3. Fazer chamada teste
4. Verificar áudio
5. Testar DTMF
6. Testar desligar

### Checklist de Testes
- [ ] Conexão WebSocket
- [ ] Registro SIP
- [ ] Chamada outbound
- [ ] Chamada inbound
- [ ] Áudio bidirecional
- [ ] DTMF funcional
- [ ] Desconexão limpa
- [ ] Reconexão após queda
- [ ] Tratamento de erros
- [ ] Normalização de números

## Referências

- [JsSIP Documentation](https://jssip.net/documentation/)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [SIP Protocol (RFC 3261)](https://tools.ietf.org/html/rfc3261)
- [E.164 Format](https://en.wikipedia.org/wiki/E.164)

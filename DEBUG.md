# 🔍 Guia de Debugging - Sistema PJSIP

## Sistema Refatorado

O sistema foi completamente refatorado para ser mais simples e robusto:

- ✅ Código mais limpo e organizado
- ✅ Melhor gerenciamento de estados
- ✅ Logs detalhados com emojis
- ✅ Interface moderna
- ✅ Tratamento de erros aprimorado

## 1️⃣ Console do Navegador

**Atalho:** `F12` → aba "Console"

### Logs Esperados

#### Inicialização Bem-sucedida
```
📞 Conectando ramal: 100
✅ WebSocket conectado
✅ Registrado no servidor SIP
```

#### Fazendo uma Chamada
```
📞 Ligando para: +5511999998888
📞 Chamando...
✅ Chamada aceita
✅ Chamada confirmada
```

#### Encerrando Chamada
```
📴 Encerrando chamada
📴 Chamada encerrada
```

## 2️⃣ Problemas Comuns

### ❌ Não Conecta ao WebSocket

**Sintoma:** Status permanece "Inicializando..." ou "Desconectado"

**Possíveis Causas:**
1. URL do WebSocket incorreta
2. Servidor offline
3. Firewall bloqueando porta
4. Certificado SSL inválido

**Solução:**
```javascript
// Verifique no config.js
wssUrl: "wss://seu-servidor.com:porta"
```

**Teste no console:**
```javascript
new WebSocket("wss://seu-servidor.com:porta")
```

---

### ❌ Não Registra o Ramal

**Sintoma:** WebSocket conectado mas não registra

**Possíveis Causas:**
1. Credenciais incorretas
2. Ramal não existe no servidor
3. Ramal já em uso

**Solução:**
1. Verifique usuário e senha no `config.js`
2. Confirme ramal no servidor PJSIP
3. Tente outro ramal

**No console procure:**
```
❌ Falha no registro: [motivo]
```

---

### ❌ Chamada Não Completa

**Sintoma:** Status "Chamando..." mas não conecta

**Possíveis Causas:**
1. Número inválido
2. Rota não configurada no servidor
3. Sem permissão para chamadas externas
4. Problema de áudio/mídia

**Solução:**
1. Verifique formato do número (E.164)
2. Teste com ramal interno primeiro
3. Verifique permissões no servidor
4. Autorize acesso ao microfone

---

### ❌ Sem Áudio

**Sintoma:** Chamada conecta mas não há som

**Possíveis Causas:**
1. Microfone não autorizado
2. Dispositivo de áudio incorreto
3. Firewall bloqueando RTP
4. Problema de NAT/STUN

**Solução:**

1. **Permissões do Microfone:**
   - Chrome: Verifique ícone 🎤 na barra de endereço
   - Settings → Privacy → Microphone → Permitir

2. **Teste de Dispositivo:**
   ```javascript
   navigator.mediaDevices.getUserMedia({ audio: true })
     .then(stream => console.log("✅ Microfone OK"))
     .catch(err => console.error("❌ Erro:", err))
   ```

3. **Verifique Firewall:**
   - Libere portas UDP para RTP (geralmente 10000-20000)
   - Teste em rede sem firewall

4. **HTTPS Obrigatório:**
   - WebRTC requer HTTPS em produção
   - Em dev: `localhost` funciona

---

### ❌ "Busy Here" ou "Falha"

**Sintoma:** Chamada falha imediatamente

**Possíveis Causas:**
1. Destino ocupado
2. Destino inválido
3. Sessão anterior não limpa
4. Múltiplas chamadas simultâneas

**Solução:**
1. Recarregue a página (Ctrl+F5)
2. Verifique número de destino
3. Aguarde alguns segundos entre chamadas
4. Verifique logs do servidor

**No console:**
```
❌ Chamada falhou: [causa exata]
```
## 3️⃣ Testes e Validação

### ✅ Checklist de Verificação

1. **[ ] WebSocket Conectado**
   - Status deve mostrar "Conectado"
   - Console: `✅ WebSocket conectado`

2. **[ ] Ramal Registrado**
   - Status: "Registrado: XXX"
   - Indicador verde visível
   - Console: `✅ Registrado no servidor SIP`

3. **[ ] Microfone Autorizado**
   - Ícone de microfone na barra do navegador
   - Sem erros no console sobre getUserMedia

4. **[ ] Botão Ligar Habilitado**
   - Botão verde clicável
   - Não está opaco

5. **[ ] Chamada Inicia**
   - Status muda para "Chamando..."
   - Console: `📞 Ligando para: +...`

6. **[ ] Chamada Conecta**
   - Status: "Em chamada" ou "Conectado"
   - Console: `✅ Chamada aceita`

7. **[ ] Áudio Funciona**
   - Consegue ouvir o outro lado
   - Outro lado consegue ouvir você

8. **[ ] DTMF Funciona**
   - Teclado DTMF aparece durante chamada
   - Tons são enviados
   - Console: `📟 DTMF enviado: X`

9. **[ ] Desligar Funciona**
   - Botão vermelho encerra chamada
   - Status volta para "Registrado"
   - Console: `📴 Chamada encerrada`

### 🔧 Ferramentas de Debug

#### No Console do Navegador

**Verificar estado do sistema:**
```javascript
// Na aba Elements, encontre o componente e inspecione
```

**Testar WebSocket manualmente:**
```javascript
const ws = new WebSocket("wss://seu-servidor:porta")
ws.onopen = () => console.log("✅ Conectado")
ws.onerror = (e) => console.error("❌ Erro:", e)
```

**Testar dispositivos de mídia:**
```javascript
navigator.mediaDevices.enumerateDevices()
  .then(devices => {
    devices.forEach(device => {
      console.log(`${device.kind}: ${device.label}`)
    })
  })
```

#### No Servidor PJSIP

**Logs em tempo real:**
```bash
# Asterisk
asterisk -rvvv

# FreeSWITCH
fs_cli -x "console loglevel debug"
```

**Verificar endpoints:**
```bash
# Asterisk
pjsip show endpoints

# Ver apenas o ramal 100
pjsip show endpoint 100
```

**Ver canais ativos:**
```bash
# Asterisk
core show channels
pjsip show channels

# FreeSWITCH
show channels
```

## 4️⃣ Servidor PJSIP

### Requisitos Mínimos

1. **WebSocket habilitado**
   - Porta configurada (ex: 8089, 52060)
   - Transporte WSS (seguro)

2. **Certificado SSL válido**
   - Necessário para WSS
   - Navegador deve confiar no certificado

3. **Codecs compatíveis**
   - PCMU (G.711μ)
   - PCMA (G.711a)
   - Opus (recomendado)

4. **NAT configurado**
   - STUN/TURN se necessário
   - Portas RTP liberadas

### Exemplo de Configuração (Asterisk)

**pjsip.conf:**
```ini
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
external_media_address=SEU_IP_PUBLICO
external_signaling_address=SEU_IP_PUBLICO

[100]
type=endpoint
context=from-webrtc
disallow=all
allow=opus,ulaw,alaw
webrtc=yes
auth=100
aors=100

[100]
type=auth
auth_type=userpass
password=imersa@100
username=100

[100]
type=aor
max_contacts=5
```

## 5️⃣ Casos de Uso

### Teste com Ramal Interno
```
1. Configure defaultExtension: "100"
2. Digite: 101 (outro ramal)
3. Clique em Ligar
4. Teste bilateral de áudio
```

### Teste com Número Externo
```
1. Digite: +5511999998888
2. Ou apenas: 11999998888
3. Sistema normaliza automaticamente
4. Clique em Ligar
```

### Auto-chamada via URL
```
http://localhost:3000/5511999998888
```
Sistema irá:
- Conectar
- Registrar
- Ligar automaticamente

## 6️⃣ Dicas Avançadas

### Depuração de WebRTC

**Chrome DevTools:**
1. Abra: `chrome://webrtc-internals`
2. Faça uma chamada
3. Veja estatísticas em tempo real:
   - Packets sent/received
   - Bytes transferidos
   - Codec usado
   - ICE candidates
   - Qualidade de áudio (MOS)

### Análise de Tráfego

**Wireshark:**
```
Filtro: sip or rtp
```
- SIP: Sinalização (INVITE, ACK, BYE)
- RTP: Fluxo de áudio

### Teste de Latência

**No console durante chamada:**
```javascript
// Verifica estatísticas da conexão
const pc = activeSession.connection
pc.getStats().then(stats => {
  stats.forEach(report => {
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      console.log('RTT:', report.currentRoundTripTime * 1000, 'ms')
    }
  })
})
```

## 7️⃣ Problemas Conhecidos

### Safari iOS
- Requer gesto do usuário para iniciar áudio
- Atributo `playsInline` obrigatório
- Pode não funcionar em modo de navegação privada

### Firefox
- Pode pedir permissão de microfone toda vez
- Configuração em `about:config`

### Edge
- Mesmas limitações do Chrome
- Melhor compatibilidade em versões recentes

## 8️⃣ Suporte

### Logs para Suporte

Se precisar de ajuda, colete:

1. **Console do navegador** (F12 → Console → Copy all)
2. **Versão do navegador** (chrome://version)
3. **Configuração usada** (esconda senhas!)
4. **Logs do servidor PJSIP**

### Informações Úteis

```javascript
// No console, execute:
navigator.userAgent
navigator.mediaDevices.getSupportedConstraints()
```

## 9️⃣ Otimizações

### Performance
- Sistema usa refs (não causa re-renders)
- UA é singleton global
- Sessions são limpas após uso
- Eventos são removidos no cleanup

### Segurança em Produção
- Use HTTPS obrigatoriamente
- Não exponha senhas no código
- Use variáveis de ambiente
- Implemente rate limiting
- Adicione autenticação

### Melhorias Futuras
- [ ] Reconexão automática
- [ ] Retry logic para chamadas
- [ ] Qualidade de áudio adaptativa
- [ ] Histórico de chamadas
- [ ] Múltiplos ramais
- [ ] Modo offline

```
Conectado ao WebSocket
Registrado no Asterisk
Iniciando chamada para: +5519999999999
Sessão criada: RTCSession {...}
Nova sessão RTC: outgoing RTCSession {...}
Session progress (180/183)
ICE connection state: checking
ICE connection state: connected
Connection state: connected
Session accepted (200 OK)
Session confirmed (ACK)
```

**Se der erro:**
```
Chamada falhou: Busy Here Object { cause: "Busy Here", ... }
🔴 Ocupado
```

---

### 6️⃣ Checklist de Verificação

- [ ] Console do navegador aberto e sem erros vermelhos
- [ ] Microfone autorizado (ícone 🎤 visível)
- [ ] Status mostra "Registrado no Asterisk"
- [ ] Apenas uma aba/janela com o app aberto
- [ ] Nenhum outro softphone registrado no ramal 3000
- [ ] Asterisk CLI mostra INVITE chegando
- [ ] Dialplan válido para o número discado
- [ ] Trunk conectado (se for chamada externa)

---

### 7️⃣ Código Aplicado para Resolver

✅ **Sessões duplicadas:** Agora termina sessão anterior antes de criar nova.  
✅ **Logs detalhados:** Console mostra cada etapa (progress, accepted, failed).  
✅ **Cleanup melhorado:** Ao desmontar componente, encerra UA corretamente.  
✅ **Rejeição de sessões conflitantes:** Se chegar nova sessão enquanto há uma ativa, rejeita com 486 Busy.  
✅ **Mensagens específicas:** Mostra causa exata (Busy, Rejected, No Answer, etc).

---

### 8️⃣ Próximos Passos

1. Rode a aplicação: `npm start`
2. Abra o console do navegador (F12)
3. Tente fazer uma chamada
4. **Cole aqui os logs do console** (tudo que aparecer) para eu identificar o problema exato.

Exemplo do que colar:
```
Conectado ao WebSocket
Registrado no Asterisk
Iniciando chamada para: +5519989751609
Sessão criada: RTCSession {...}
Nova sessão RTC: outgoing ...
Session progress (180/183)
Chamada falhou: Busy Here Object { cause: "Busy Here", originator: "remote", ... }
🔴 Ocupado
```

---

### 9️⃣ Atalho: Forçar Limpeza Total

Se mesmo assim der ocupado, force reset completo:

```javascript
// Cole no console do navegador:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

Isso limpa qualquer estado persistente e recarrega a página.

---

**Dúvidas?** Cole os logs do console aqui que eu analiso! 🚀

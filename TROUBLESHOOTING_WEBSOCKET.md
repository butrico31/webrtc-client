# 🔧 Solucionando Problema de Conexão WebSocket

## Erro Atual
```
WebSocket connection to 'wss://flux-imersa.leucotron.io:52060/' failed
```

## ✅ Passos para Resolver

### 1. Testar URLs Alternativas

No arquivo `src/config.js`, teste cada URL uma por vez:

```javascript
// Opção 1 - Porta 8089 com /ws (COMUM EM ASTERISK)
wssUrl: "wss://flux-imersa.leucotron.io:8089/ws"

// Opção 2 - Porta 8089 sem path
wssUrl: "wss://flux-imersa.leucotron.io:8089"

// Opção 3 - Porta 443 (HTTPS padrão)
wssUrl: "wss://flux-imersa.leucotron.io:443"

// Opção 4 - Porta 52060 (atual)
wssUrl: "wss://flux-imersa.leucotron.io:52060"
```

Após cada mudança:
1. Salve o arquivo
2. Aguarde o reload automático
3. Verifique o console do navegador

---

### 2. Verificar Certificado SSL

Abra no navegador:
```
https://flux-imersa.leucotron.io:8089
```

**Resultado esperado:**
- ✅ Conexão segura (mesmo que retorne 404 ou erro)
- ❌ Erro de certificado = PROBLEMA

**Se houver erro de certificado:**
- Servidor precisa ter SSL válido para WSS
- Tente com administrador do servidor

---

### 3. Testar WebSocket no Console

Abra o console do navegador (F12) e execute:

```javascript
// Teste conexão WebSocket
const testWs = new WebSocket("wss://flux-imersa.leucotron.io:8089/ws");

testWs.onopen = () => {
  console.log("✅ CONECTOU! Use esta URL");
  testWs.close();
};

testWs.onerror = (e) => {
  console.error("❌ ERRO:", e);
};
```

Se conectar, copie a URL que funcionou para o `config.js`.

---

### 4. Verificar Portas no Firewall

Portas comuns para WebSocket SIP:
- **8089** - Asterisk padrão
- **8088** - Asterisk alternativo
- **443** - HTTPS padrão
- **52060** - Porta customizada

**Verificar se está aberta:**
```bash
# PowerShell
Test-NetConnection -ComputerName flux-imersa.leucotron.io -Port 8089
```

---

### 5. Verificar Configuração do Servidor

O servidor PJSIP precisa ter:

**Asterisk (pjsip.conf):**
```ini
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
```

**Asterisk (http.conf):**
```ini
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8089
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/asterisk/keys/cert.pem
tlsprivatekey=/etc/asterisk/keys/key.pem
```

---

### 6. Logs Detalhados

Com as mudanças que fiz, agora você verá no console:

```
🟢 Usando ramal: 100
🔌 URL WebSocket: wss://...
🔄 WebSocket conectando...
✅ WebSocket conectado!
✅ UA conectado ao servidor
✅ UA registrado: 100
```

**Se parar em alguma etapa, identifique onde:**
- Para em "conectando" = problema de rede/porta
- Conecta mas não registra = problema de credenciais
- Não aparece nada = erro no código

---

### 7. Informações de Debug na Interface

Clique em "🔧 Debug Info" na interface para ver:
- WebSocket URL em uso
- Status da conexão UA
- Status do registro

---

## 📞 Contato com Administrador

Se nenhuma solução funcionar, peça ao administrador do servidor:

1. **Qual é a URL correta do WebSocket?**
   - Porta e path exatos

2. **O certificado SSL está válido?**
   - Deve ser reconhecido por navegadores

3. **As portas estão abertas no firewall?**
   - Para conexões externas

4. **O transporte WSS está habilitado?**
   - Verificar configuração PJSIP

---

## 🔍 Ferramentas Úteis

### Verificar DNS
```powershell
nslookup flux-imersa.leucotron.io
```

### Verificar Porta TCP
```powershell
Test-NetConnection -ComputerName flux-imersa.leucotron.io -Port 8089
```

### Ver Tráfego de Rede
- Chrome DevTools → Network → WS (WebSocket)
- Verá tentativas de conexão e erros

---

## ✅ Checklist

- [ ] Testei URLs alternativas
- [ ] Certificado SSL está válido
- [ ] Porta está acessível
- [ ] Servidor está configurado para WSS
- [ ] Firewall permite conexão
- [ ] Credenciais do ramal estão corretas
- [ ] Vi logs detalhados no console

---

## 🎯 Solução Rápida Mais Comum

**90% dos casos é a porta/path errado.**

Tente:
```javascript
wssUrl: "wss://flux-imersa.leucotron.io:8089/ws"
```

Esta é a configuração padrão do Asterisk com WebRTC.

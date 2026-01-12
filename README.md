# 📞 Sistema PJSIP - Cliente WebRTC

Sistema simples para realizar chamadas VoIP usando PJSIP através do JsSIP.

## 🚀 Recursos

- ✅ Conexão automática com servidor SIP
- ✅ Registro automático de ramal
- ✅ Fazer chamadas externas
- ✅ Receber chamadas
- ✅ Envio de tons DTMF
- ✅ Interface moderna e responsiva
- ✅ Suporte a formato E.164 para números internacionais

## 📋 Pré-requisitos

- Node.js 20+
- Servidor PJSIP configurado

## 🔧 Instalação

```bash
npm install
```

Obs.: em produção/CI, mantenha o `package-lock.json` em sincronia com o `package.json`.

## ⚙️ Configuração

Edite o arquivo `src/config.js` para configurar seu servidor:

```javascript
export const SIP_CONFIG = {
  domain: "seu-servidor.com",
  wssUrl: "wss://seu-servidor.com:porta",
  defaultExtension: "100",
  extensions: [
    { extension: "100", password: "senha100" },
    // ... mais ramais
  ],
};
```

### Ramal livre (opcional)

Para buscar um ramal livre automaticamente, o cliente chama o endpoint `GET /extensions/free` de um micro-serviço (AMI Listener).

- Em produção, **não use** `localhost` (no navegador, `localhost` é o computador do usuário).
- Configure `REACT_APP_AMI_API_BASE_URL` e faça rebuild da imagem.

## 🏃 Executar

```bash
npm start
```

O sistema estará disponível em `http://localhost:3000`

## 📱 Uso

### Fazer uma chamada

1. Digite o número de telefone no campo
2. Clique em "Ligar"
3. Use o teclado DTMF durante a chamada se necessário
4. Clique em "Desligar" para encerrar

### Chamada via URL

Você pode passar o número diretamente na URL:

```
http://localhost:3000/5511999998888
```

O sistema irá:
- Conectar automaticamente
- Registrar o ramal
- Iniciar a chamada para o número especificado

## 🔢 Formato de Números

O sistema normaliza automaticamente números para formato E.164:

- **Nacional**: `11999998888` → `+5511999998888`
- **Internacional**: `1234567890` → `+1234567890`
- **Já formatado**: `+5511999998888` → mantém o formato

## 🏗️ Estrutura do Código

```
src/
├── config.js          # Configurações do servidor SIP
├── WebRTCPhone.jsx    # Componente principal
└── index.js           # Entrada da aplicação
```

## 🛠️ Tecnologias

- **React** - Interface do usuário
- **JsSIP** - Biblioteca SIP para JavaScript
- **WebRTC** - Comunicação em tempo real

## 📝 Logs

O sistema fornece logs detalhados no console do navegador:

- `✅` Eventos de sucesso
- `❌` Erros
- `📞` Chamadas
- `📟` DTMF
- `📴` Desconexões

## 🐛 Troubleshooting

### Não conecta ao servidor
- Verifique a URL do WebSocket no `config.js`
- Certifique-se que o servidor aceita conexões WSS
- Verifique certificados SSL

### Não registra o ramal
- Confirme usuário e senha no `config.js`
- Verifique se o ramal está disponível no servidor
- Veja logs do servidor PJSIP

### Não há áudio
- Permita acesso ao microfone no navegador
- Verifique configurações de firewall
- Teste em HTTPS (necessário para WebRTC)

## 📄 Licença

MIT

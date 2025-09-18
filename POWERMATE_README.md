# PowerMate Automation - Sistema de Automação B4 Trade

## 🚀 Visão Geral

O **PowerMate Automation** é uma solução completa de automação desenvolvida para a B4 Trade que resolve os seguintes problemas:

1. **Validação automática de arquivos ZIP** - Verifica integridade, estrutura e segurança
2. **Monitoramento de pasta OneDrive** - Detecta automaticamente novos arquivos
3. **Integração com Kommo CRM** - Envia arquivos e cria leads automaticamente
4. **Interface web de monitoramento** - Dashboard em tempo real para controle

## 🎯 Funcionalidades Principais

### ✅ Validador de ZIP
- Verifica integridade dos arquivos ZIP/RAR/7Z
- Detecta arquivos corrompidos
- Valida estrutura interna esperada
- Identifica nomes de arquivos suspeitos
- Relatórios detalhados de validação

### 📁 Monitor de Pasta OneDrive
- Monitora pasta do OneDrive em tempo real
- Processa automaticamente novos arquivos
- Suporte a múltiplas extensões (.zip, .rar, .7z, .pdf, .doc, .xlsx)
- Controle de tamanho máximo de arquivo
- Evita processamento de arquivos em transferência

### 🔗 Integração Kommo CRM
- Cria leads automaticamente para cada arquivo
- Anexa arquivos aos leads
- Adiciona notas sobre validação
- API completa para gestão de leads e contatos
- Suporte a campos personalizados

### 🖥️ Interface Web
- Dashboard em tempo real com Socket.IO
- Upload manual de arquivos para validação
- Controle do sistema (iniciar/parar monitor)
- Logs em tempo real
- Estatísticas de uso

## 📋 Pré-requisitos

- **Node.js** 14.0.0 ou superior
- **Windows 10/11** com OneDrive (ou macOS/Linux com adaptações)
- **Conta Kommo CRM** (opcional, mas recomendado)
- **PowerShell** ou **Terminal** para executar comandos

## 🛠️ Instalação

### 1. Clonar ou baixar o projeto
```bash
git clone https://github.com/RigolizzoB4/site-integrado-.git
cd site-integrado-
```

### 2. Instalar dependências Node.js
```bash
npm install
```

### 3. Configurar ambiente
```bash
# Copiar arquivo de exemplo
copy .env.example .env

# Editar configurações no arquivo .env
notepad .env
```

### 4. Configurar pasta de monitoramento
Por padrão, o sistema monitora: `C:\Users\%USERNAME%\OneDrive\PowerMate`

Você pode alterar no arquivo `.env`:
```env
WATCH_PATH=C:\Users\SeuUsuario\OneDrive\SuaPasta
```

## ⚙️ Configuração do Kommo CRM

### 1. Criar aplicação no Kommo
1. Acesse o painel administrativo do Kommo
2. Vá em **Configurações** → **API e Webhooks**
3. Crie uma nova integração
4. Anote o `Client ID` e `Client Secret`

### 2. Configurar credenciais
Edite o arquivo `.env`:
```env
KOMMO_CLIENT_ID=seu_client_id
KOMMO_CLIENT_SECRET=seu_client_secret
KOMMO_ACCESS_TOKEN=seu_token_de_acesso
KOMMO_REFRESH_TOKEN=seu_refresh_token
```

### 3. Obter tokens de acesso
Execute o sistema uma vez para iniciar o processo OAuth:
```bash
npm start
```

## 🚀 Como Usar

### Iniciar o Sistema Completo
```bash
npm start
```

### Executar Apenas o Monitor
```bash
npm run monitor
```

### Executar Apenas Interface Web
```bash
npm run web
```

### Validar um ZIP específico
```bash
npm run validate caminho/para/arquivo.zip
```

### Testar Sistema
```bash
npm start -- --test
```

## 🌐 Interface Web

Após iniciar o sistema, acesse: **http://localhost:3000/powermate**

### Funcionalidades do Dashboard:
- **Status em tempo real** dos componentes
- **Controles** para iniciar/parar monitor
- **Validador de ZIP** com drag & drop
- **Logs em tempo real** com filtros
- **Estatísticas** de uso e performance

## 📊 Monitoramento e Logs

### Logs do Sistema
Os logs são salvos em: `automation/logs/powermate.log`

### Tipos de Log:
- **INFO**: Operações normais
- **WARN**: Avisos (arquivo muito grande, etc.)
- **ERROR**: Erros que impedem processamento
- **ACTIVITY**: Ações específicas (arquivo processado, lead criado)

### Visualizar Logs em Tempo Real:
```bash
# Windows
Get-Content automation\logs\powermate.log -Wait

# Linux/macOS
tail -f automation/logs/powermate.log
```

## 🔧 Configurações Avançadas

### Extensões de Arquivo Permitidas
Edite `automation/config.js`:
```javascript
allowedExtensions: ['.zip', '.rar', '.7z', '.pdf', '.doc', '.docx', '.xlsx']
```

### Estrutura ZIP Esperada
Configure a estrutura de pastas esperada nos ZIPs:
```javascript
expectedStructure: [
  'documentos/',
  'imagens/',
  'planilhas/'
]
```

### Tamanho Máximo de Arquivo
No arquivo `.env`:
```env
MAX_FILE_SIZE=52428800  # 50MB em bytes
```

## 🛡️ Segurança

### Validações Implementadas:
- ✅ Verificação de integridade ZIP
- ✅ Detecção de nomes suspeitos
- ✅ Controle de tamanho máximo
- ✅ Filtro por extensões permitidas
- ✅ Sanitização de paths (evita path traversal)

### Arquivos Bloqueados:
- Executáveis (.exe, .bat, .cmd, .scr)
- Nomes reservados do Windows
- Caracteres especiais perigosos

## 🔄 Fluxo de Automação

1. **Detecção**: Arquivo adicionado na pasta OneDrive
2. **Validação**: Sistema valida integridade e segurança
3. **Processamento**: Arquivo é processado conforme regras
4. **Kommo**: Lead é criado automaticamente (se configurado)
5. **Anexo**: Arquivo é anexado ao lead
6. **Notificação**: Log e notificações são enviadas

## 📱 Comandos Úteis

### Gerenciamento do Sistema:
```bash
# Iniciar sistema completo
npm start

# Iniciar apenas monitor
npm run monitor

# Iniciar apenas web interface
npm run web

# Executar testes
npm start -- --test

# Modo debug
LOG_LEVEL=debug npm start
```

### Validação Manual:
```bash
# Validar ZIP específico
node automation/zip-validator.js "caminho/arquivo.zip"

# Processar arquivo manualmente
node automation/folder-monitor.js --process-file "caminho/arquivo.zip"
```

## 🆘 Resolução de Problemas

### Problema: "Pasta não encontrada"
**Solução**: Verifique se o caminho no `.env` está correto e existe:
```bash
echo %OneDrive%\PowerMate
```

### Problema: "Kommo não conecta"
**Soluções**:
1. Verifique credenciais no `.env`
2. Teste conexão: `npm run web` → Dashboard → "Testar Kommo"
3. Verifique se tokens não expiraram

### Problema: "Porta já em uso"
**Solução**: Altere a porta no `.env`:
```env
WEB_PORT=3001
```

### Problema: "Arquivo não processado"
**Verificações**:
1. Extensão está permitida?
2. Arquivo não excede tamanho máximo?
3. Aguardou o delay configurado?
4. Verifique logs para erros

## 📞 Suporte

### Logs e Debug:
1. Ative modo debug: `LOG_LEVEL=debug npm start`
2. Verifique logs em: `automation/logs/powermate.log`
3. Teste componentes individualmente

### Contato B4 Trade:
- **Email**: contato@b4.com.br
- **Telefone**: (19) 3751-4300
- **Website**: https://b4trade.com.br

## 🔄 Atualizações

### Verificar Versão:
```bash
node automation/index.js --version
```

### Atualizar Dependências:
```bash
npm update
```

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

**Desenvolvido com ❤️ pela equipe B4 Trade**

*PowerMate Automation v1.0.0 - Automatizando seu fluxo de trabalho desde 2024*
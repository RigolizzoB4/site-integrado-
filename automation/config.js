/**
 * PowerMate Automation - Configuração
 * Sistema de automação para validação de ZIP e integração com Kommo CRM
 */

require('dotenv').config();

const config = {
  // Configurações do Kommo CRM
  kommo: {
    apiUrl: process.env.KOMMO_API_URL || 'https://api.kommo.com/api/v4',
    clientId: process.env.KOMMO_CLIENT_ID,
    clientSecret: process.env.KOMMO_CLIENT_SECRET,
    redirectUri: process.env.KOMMO_REDIRECT_URI || 'http://localhost:3000/callback',
    accessToken: process.env.KOMMO_ACCESS_TOKEN,
    refreshToken: process.env.KOMMO_REFRESH_TOKEN
  },

  // Configurações de monitoramento de pasta
  folderMonitor: {
    // Pasta do OneDrive para monitorar (personalizar conforme necessário)
    watchPath: process.env.WATCH_PATH || process.env.OneDrive || 'C:\\Users\\%USERNAME%\\OneDrive\\PowerMate',
    // Extensões de arquivo permitidas
    allowedExtensions: ['.zip', '.rar', '.7z', '.pdf', '.doc', '.docx', '.xlsx'],
    // Delay em ms antes de processar arquivo (para evitar arquivos em transferência)
    processDelay: process.env.PROCESS_DELAY || 5000,
    // Tamanho máximo de arquivo em bytes (50MB por padrão)
    maxFileSize: process.env.MAX_FILE_SIZE || 50 * 1024 * 1024
  },

  // Configurações de validação de ZIP
  zipValidation: {
    // Verificar integridade do arquivo
    checkIntegrity: true,
    // Verificar se não está corrompido
    checkCorruption: true,
    // Verificar estrutura de pastas esperada
    checkStructure: true,
    // Estrutura esperada (personalizar conforme necessário)
    expectedStructure: [
      'documentos/',
      'imagens/',
      'planilhas/'
    ]
  },

  // Configurações do servidor web
  webInterface: {
    port: process.env.WEB_PORT || 3000,
    host: process.env.WEB_HOST || 'localhost',
    staticPath: '../'
  },

  // Configurações de log
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    logToFile: true,
    logFile: './automation/logs/powermate.log',
    maxLogFiles: 5,
    maxLogSize: '10MB'
  },

  // Configurações de notificação
  notifications: {
    email: {
      enabled: false,
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO
    },
    webhook: {
      enabled: true,
      url: process.env.WEBHOOK_URL
    }
  }
};

module.exports = config;
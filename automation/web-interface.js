/**
 * PowerMate Automation - Interface Web
 * Interface web para monitoramento e configuração da automação
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const http = require('http');

const config = require('./config');
const logger = require('./logger');
const FolderMonitor = require('./folder-monitor');
const ZipValidator = require('./zip-validator');
const KommoIntegration = require('./kommo-integration');

class WebInterface {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, { cors: { origin: "*" } });
    
    this.folderMonitor = new FolderMonitor();
    this.zipValidator = new ZipValidator();
    this.kommoIntegration = new KommoIntegration();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupFileUpload();
  }

  /**
   * Configura middleware do Express
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, config.webInterface.staticPath)));
    
    // Log de requisições
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
      next();
    });
  }

  /**
   * Configura upload de arquivos
   */
  setupFileUpload() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const filename = `${timestamp}_${file.originalname}`;
        cb(null, filename);
      }
    });

    this.upload = multer({ 
      storage,
      limits: { fileSize: config.folderMonitor.maxFileSize },
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (config.folderMonitor.allowedExtensions.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error(`Extensão não permitida: ${ext}`));
        }
      }
    });
  }

  /**
   * Configura rotas da API
   */
  setupRoutes() {
    // Página principal - Dashboard PowerMate
    this.app.get('/powermate', (req, res) => {
      res.sendFile(path.join(__dirname, 'dashboard.html'));
    });

    // API Status
    this.app.get('/api/status', async (req, res) => {
      try {
        const status = {
          powermate: {
            version: '1.0.0',
            status: 'active',
            uptime: process.uptime()
          },
          monitor: this.folderMonitor.getStats(),
          kommo: {
            connected: this.kommoIntegration.authenticated,
            lastSync: new Date().toISOString()
          },
          system: {
            platform: process.platform,
            nodeVersion: process.version,
            memory: process.memoryUsage()
          }
        };
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Validar ZIP via upload
    this.app.post('/api/validate-zip', this.upload.single('zipfile'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const validation = await this.zipValidator.validateZip(req.file.path);
        
        // Limpar arquivo temporário
        fs.unlinkSync(req.file.path);
        
        res.json(validation);
      } catch (error) {
        logger.error('Erro na validação via upload:', error.message);
        res.status(500).json({ error: error.message });
      }
    });

    // Validar ZIP via caminho
    this.app.post('/api/validate-zip-path', async (req, res) => {
      try {
        const { filePath } = req.body;
        if (!filePath) {
          return res.status(400).json({ error: 'Caminho do arquivo obrigatório' });
        }

        const validation = await this.zipValidator.validateZip(filePath);
        res.json(validation);
      } catch (error) {
        logger.error('Erro na validação por caminho:', error.message);
        res.status(500).json({ error: error.message });
      }
    });

    // Controlar monitor
    this.app.post('/api/monitor/:action', async (req, res) => {
      try {
        const { action } = req.params;
        
        switch (action) {
          case 'start':
            await this.folderMonitor.startMonitoring();
            this.broadcastStatus();
            res.json({ success: true, message: 'Monitor iniciado' });
            break;
            
          case 'stop':
            await this.folderMonitor.stopMonitoring();
            this.broadcastStatus();
            res.json({ success: true, message: 'Monitor parado' });
            break;
            
          case 'restart':
            await this.folderMonitor.stopMonitoring();
            await this.folderMonitor.startMonitoring();
            this.broadcastStatus();
            res.json({ success: true, message: 'Monitor reiniciado' });
            break;
            
          default:
            res.status(400).json({ error: 'Ação inválida' });
        }
      } catch (error) {
        logger.error('Erro no controle do monitor:', error.message);
        res.status(500).json({ error: error.message });
      }
    });

    // Forçar processamento de arquivo
    this.app.post('/api/process-file', async (req, res) => {
      try {
        const { filePath } = req.body;
        if (!filePath) {
          return res.status(400).json({ error: 'Caminho do arquivo obrigatório' });
        }

        await this.folderMonitor.forceProcessFile(filePath);
        res.json({ success: true, message: 'Arquivo processado' });
      } catch (error) {
        logger.error('Erro ao forçar processamento:', error.message);
        res.status(500).json({ error: error.message });
      }
    });

    // Logs em tempo real
    this.app.get('/api/logs', (req, res) => {
      try {
        const logFile = path.resolve(config.logging.logFile);
        if (!fs.existsSync(logFile)) {
          return res.json({ logs: [] });
        }

        const logContent = fs.readFileSync(logFile, 'utf8');
        const logs = logContent.split('\n')
          .filter(line => line.trim())
          .slice(-100) // Últimas 100 linhas
          .map(line => this.parseLogLine(line));

        res.json({ logs });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Configurações
    this.app.get('/api/config', (req, res) => {
      const safeConfig = {
        folderMonitor: {
          watchPath: config.folderMonitor.watchPath,
          allowedExtensions: config.folderMonitor.allowedExtensions,
          maxFileSize: config.folderMonitor.maxFileSize,
          processDelay: config.folderMonitor.processDelay
        },
        zipValidation: config.zipValidation,
        webInterface: {
          port: config.webInterface.port,
          host: config.webInterface.host
        }
      };
      res.json(safeConfig);
    });

    // Teste de conexão Kommo
    this.app.post('/api/kommo/test', async (req, res) => {
      try {
        const stats = await this.kommoIntegration.getAccountStats();
        res.json({ success: true, account: stats });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  /**
   * Configura Socket.IO para comunicação em tempo real
   */
  setupSocketIO() {
    this.io.on('connection', (socket) => {
      logger.debug('Cliente conectado ao WebSocket');
      
      // Enviar status inicial
      this.sendStatusToClient(socket);
      
      socket.on('disconnect', () => {
        logger.debug('Cliente desconectado do WebSocket');
      });

      socket.on('request-status', () => {
        this.sendStatusToClient(socket);
      });
    });

    // Interceptar logs para broadcast
    this.setupLogBroadcast();
  }

  /**
   * Configura broadcast de logs
   */
  setupLogBroadcast() {
    const originalInfo = logger.info;
    const originalError = logger.error;
    const originalWarn = logger.warn;

    logger.info = (...args) => {
      originalInfo.apply(logger, args);
      this.io.emit('log', { level: 'info', message: args[0], meta: args[1], timestamp: new Date() });
    };

    logger.error = (...args) => {
      originalError.apply(logger, args);
      this.io.emit('log', { level: 'error', message: args[0], meta: args[1], timestamp: new Date() });
    };

    logger.warn = (...args) => {
      originalWarn.apply(logger, args);
      this.io.emit('log', { level: 'warn', message: args[0], meta: args[1], timestamp: new Date() });
    };
  }

  /**
   * Envia status para cliente específico
   * @param {Socket} socket - Socket do cliente
   */
  async sendStatusToClient(socket) {
    try {
      const status = {
        monitor: this.folderMonitor.getStats(),
        kommo: { connected: this.kommoIntegration.authenticated },
        timestamp: new Date()
      };
      socket.emit('status', status);
    } catch (error) {
      logger.error('Erro ao enviar status:', error.message);
    }
  }

  /**
   * Broadcast status para todos os clientes
   */
  async broadcastStatus() {
    try {
      const status = {
        monitor: this.folderMonitor.getStats(),
        kommo: { connected: this.kommoIntegration.authenticated },
        timestamp: new Date()
      };
      this.io.emit('status', status);
    } catch (error) {
      logger.error('Erro no broadcast de status:', error.message);
    }
  }

  /**
   * Analisa linha de log
   * @param {string} line - Linha do log
   * @returns {Object} Log parseado
   */
  parseLogLine(line) {
    const match = line.match(/\[(.*?)\] \[(.*?)\] (.*)/);
    if (match) {
      return {
        timestamp: match[1],
        level: match[2].toLowerCase(),
        message: match[3]
      };
    }
    return { timestamp: new Date().toISOString(), level: 'info', message: line };
  }

  /**
   * Inicia o servidor web
   * @returns {Promise<void>}
   */
  async start() {
    const port = config.webInterface.port;
    const host = config.webInterface.host;

    // Inicializar componentes
    await this.folderMonitor.initialize();
    await this.kommoIntegration.initialize();

    return new Promise((resolve, reject) => {
      this.server.listen(port, host, (error) => {
        if (error) {
          reject(error);
        } else {
          logger.info(`Interface web PowerMate rodando em http://${host}:${port}`);
          logger.info(`Dashboard disponível em: http://${host}:${port}/powermate`);
          resolve();
        }
      });
    });
  }

  /**
   * Para o servidor web
   * @returns {Promise<void>}
   */
  async stop() {
    await this.folderMonitor.stopMonitoring();
    
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Interface web parada');
        resolve();
      });
    });
  }
}

module.exports = WebInterface;

// CLI para uso direto
if (require.main === module) {
  const webInterface = new WebInterface();
  
  // Manipular sinais para limpeza
  process.on('SIGINT', async () => {
    logger.info('Recebido SIGINT, parando interface web...');
    await webInterface.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Recebido SIGTERM, parando interface web...');
    await webInterface.stop();
    process.exit(0);
  });

  // Iniciar interface web
  webInterface.start()
    .then(() => {
      logger.info('Interface web iniciada com sucesso. Pressione Ctrl+C para parar.');
    })
    .catch(error => {
      logger.error('Erro ao iniciar interface web:', error.message);
      process.exit(1);
    });
}
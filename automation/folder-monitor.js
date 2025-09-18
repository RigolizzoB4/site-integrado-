/**
 * PowerMate Automation - Monitor de Pasta
 * Monitora pasta do OneDrive e processa arquivos automaticamente
 */

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const ZipValidator = require('./zip-validator');
const KommoIntegration = require('./kommo-integration');

class FolderMonitor {
  constructor() {
    this.config = config.folderMonitor;
    this.watchPath = this.resolveWatchPath();
    this.zipValidator = new ZipValidator();
    this.kommoIntegration = new KommoIntegration();
    this.watcher = null;
    this.processing = new Set(); // Evita processamento duplo
    this.isInitialized = false;
  }

  /**
   * Resolve o caminho da pasta a ser monitorada
   * @returns {string} Caminho resolvido
   */
  resolveWatchPath() {
    let watchPath = this.config.watchPath;
    
    // Substituir variáveis de ambiente
    if (process.platform === 'win32') {
      watchPath = watchPath.replace('%USERNAME%', process.env.USERNAME || process.env.USER);
      watchPath = watchPath.replace('%USERPROFILE%', process.env.USERPROFILE);
    } else {
      watchPath = watchPath.replace('~', process.env.HOME);
    }

    return path.resolve(watchPath);
  }

  /**
   * Inicializa o monitor
   * @returns {Promise<boolean>} Sucesso da inicialização
   */
  async initialize() {
    try {
      // Verificar se a pasta existe
      if (!fs.existsSync(this.watchPath)) {
        logger.warn(`Pasta de monitoramento não existe: ${this.watchPath}`);
        logger.info('Criando pasta de monitoramento...');
        fs.mkdirSync(this.watchPath, { recursive: true });
      }

      // Inicializar integração com Kommo
      const kommoReady = await this.kommoIntegration.initialize();
      if (!kommoReady) {
        logger.warn('Kommo não configurado. Arquivos serão processados localmente apenas.');
      }

      this.isInitialized = true;
      logger.info(`Monitor inicializado. Monitorando: ${this.watchPath}`);
      return true;

    } catch (error) {
      logger.error('Erro ao inicializar monitor:', error.message);
      return false;
    }
  }

  /**
   * Inicia o monitoramento
   * @returns {Promise<void>}
   */
  async startMonitoring() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Falha na inicialização do monitor');
      }
    }

    // Configurar o watcher
    this.watcher = chokidar.watch(this.watchPath, {
      ignored: /(^|[\/\\])\../, // Ignorar arquivos ocultos
      persistent: true,
      ignoreInitial: false, // Processar arquivos existentes
      depth: 2, // Monitorar até 2 níveis de profundidade
      awaitWriteFinish: {
        stabilityThreshold: 2000, // Aguardar 2s após última modificação
        pollInterval: 100
      }
    });

    // Configurar eventos
    this.watcher
      .on('add', (filePath) => this.handleFileAdded(filePath))
      .on('change', (filePath) => this.handleFileChanged(filePath))
      .on('unlink', (filePath) => this.handleFileRemoved(filePath))
      .on('error', (error) => this.handleError(error))
      .on('ready', () => {
        logger.info(`Monitor ativo. Observando alterações em: ${this.watchPath}`);
        this.logWatchedFiles();
      });

    return this.watcher;
  }

  /**
   * Para o monitoramento
   * @returns {Promise<void>}
   */
  async stopMonitoring() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      logger.info('Monitoramento interrompido');
    }
  }

  /**
   * Manipula arquivo adicionado
   * @param {string} filePath - Caminho do arquivo
   */
  async handleFileAdded(filePath) {
    logger.activity('MONITOR', `Arquivo detectado: ${path.basename(filePath)}`);
    
    // Aguardar delay configurado para garantir que o arquivo foi completamente copiado
    setTimeout(async () => {
      await this.processFile(filePath, 'added');
    }, this.config.processDelay);
  }

  /**
   * Manipula arquivo modificado
   * @param {string} filePath - Caminho do arquivo
   */
  async handleFileChanged(filePath) {
    logger.activity('MONITOR', `Arquivo modificado: ${path.basename(filePath)}`);
    
    setTimeout(async () => {
      await this.processFile(filePath, 'changed');
    }, this.config.processDelay);
  }

  /**
   * Manipula arquivo removido
   * @param {string} filePath - Caminho do arquivo
   */
  handleFileRemoved(filePath) {
    logger.activity('MONITOR', `Arquivo removido: ${path.basename(filePath)}`);
    this.processing.delete(filePath);
  }

  /**
   * Manipula erros do watcher
   * @param {Error} error - Erro
   */
  handleError(error) {
    logger.error('Erro no monitor de pasta:', error.message);
  }

  /**
   * Processa um arquivo
   * @param {string} filePath - Caminho do arquivo
   * @param {string} action - Ação que disparou o processamento
   */
  async processFile(filePath, action) {
    try {
      // Evitar processamento duplo
      if (this.processing.has(filePath)) {
        logger.debug(`Arquivo já em processamento: ${path.basename(filePath)}`);
        return;
      }

      this.processing.add(filePath);

      // Verificar se o arquivo ainda existe
      if (!fs.existsSync(filePath)) {
        logger.debug(`Arquivo não existe mais: ${path.basename(filePath)}`);
        this.processing.delete(filePath);
        return;
      }

      // Verificar extensão permitida
      const ext = path.extname(filePath).toLowerCase();
      if (!this.config.allowedExtensions.includes(ext)) {
        logger.debug(`Extensão não permitida: ${ext} para arquivo ${path.basename(filePath)}`);
        this.processing.delete(filePath);
        return;
      }

      // Obter informações do arquivo
      const stats = fs.statSync(filePath);
      const fileInfo = {
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        extension: ext,
        modified: stats.mtime,
        action: action
      };

      logger.info(`Processando arquivo: ${fileInfo.name} (${this.formatBytes(fileInfo.size)})`);

      // Verificar tamanho máximo
      if (fileInfo.size > this.config.maxFileSize) {
        logger.warn(`Arquivo muito grande: ${fileInfo.name} (${this.formatBytes(fileInfo.size)})`);
        this.processing.delete(filePath);
        return;
      }

      // Validar arquivo ZIP se aplicável
      if (['.zip', '.rar', '.7z'].includes(ext)) {
        fileInfo.validation = await this.zipValidator.validateZip(filePath);
        logger.info(`Validação ZIP: ${fileInfo.validation.isValid ? 'PASSOU' : 'FALHOU'}`);
        
        if (!fileInfo.validation.isValid) {
          logger.warn(`Problemas encontrados no arquivo ${fileInfo.name}:`, {
            errors: fileInfo.validation.errors,
            warnings: fileInfo.validation.warnings
          });
        }
      }

      // Processar no Kommo se configurado
      if (this.kommoIntegration.authenticated) {
        const result = await this.kommoIntegration.processFileAutomatically(filePath, fileInfo);
        if (result.success) {
          logger.activity('KOMMO', `Arquivo enviado com sucesso: ${fileInfo.name} → Lead ${result.leadId}`);
        } else {
          logger.error(`Erro ao enviar para Kommo: ${result.error}`);
        }
      }

      // Log de processamento completo
      logger.activity('PROCESSED', `Arquivo processado: ${fileInfo.name}`, {
        size: this.formatBytes(fileInfo.size),
        valid: fileInfo.validation?.isValid ?? 'N/A',
        action: action
      });

    } catch (error) {
      logger.error(`Erro ao processar arquivo ${path.basename(filePath)}:`, error.message);
    } finally {
      this.processing.delete(filePath);
    }
  }

  /**
   * Lista arquivos sendo observados
   */
  logWatchedFiles() {
    if (this.watcher) {
      const watchedPaths = this.watcher.getWatched();
      const totalFiles = Object.values(watchedPaths).reduce((total, files) => total + files.length, 0);
      logger.info(`Monitorando ${totalFiles} arquivos em ${Object.keys(watchedPaths).length} pastas`);
    }
  }

  /**
   * Obtém estatísticas do monitor
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      watchPath: this.watchPath,
      isActive: !!this.watcher,
      processingCount: this.processing.size,
      allowedExtensions: this.config.allowedExtensions,
      maxFileSize: this.formatBytes(this.config.maxFileSize),
      processDelay: this.config.processDelay
    };
  }

  /**
   * Força processamento de um arquivo específico
   * @param {string} filePath - Caminho do arquivo
   * @returns {Promise<void>}
   */
  async forceProcessFile(filePath) {
    logger.info(`Forçando processamento: ${path.basename(filePath)}`);
    await this.processFile(filePath, 'manual');
  }

  /**
   * Processa todos os arquivos existentes na pasta
   * @returns {Promise<void>}
   */
  async processExistingFiles() {
    try {
      const files = this.findAllowedFiles(this.watchPath);
      logger.info(`Processando ${files.length} arquivos existentes...`);
      
      for (const filePath of files) {
        await this.processFile(filePath, 'existing');
        // Pequeno delay entre processamentos
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      logger.info('Processamento de arquivos existentes concluído');
    } catch (error) {
      logger.error('Erro ao processar arquivos existentes:', error.message);
    }
  }

  /**
   * Encontra todos os arquivos permitidos na pasta
   * @param {string} dirPath - Caminho da pasta
   * @returns {string[]} Lista de arquivos
   */
  findAllowedFiles(dirPath) {
    const files = [];
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (this.config.allowedExtensions.includes(ext)) {
            files.push(itemPath);
          }
        } else if (stats.isDirectory() && !item.startsWith('.')) {
          // Recursivo até profundidade 2
          const subFiles = this.findAllowedFiles(itemPath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      logger.error(`Erro ao listar arquivos em ${dirPath}:`, error.message);
    }
    
    return files;
  }

  /**
   * Formata bytes em formato legível
   * @param {number} bytes - Número de bytes
   * @returns {string} Formato legível
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Exportar classe
module.exports = FolderMonitor;

// CLI para uso direto
if (require.main === module) {
  const monitor = new FolderMonitor();
  
  // Manipular sinais para limpeza
  process.on('SIGINT', async () => {
    logger.info('Recebido SIGINT, parando monitor...');
    await monitor.stopMonitoring();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Recebido SIGTERM, parando monitor...');
    await monitor.stopMonitoring();
    process.exit(0);
  });

  // Iniciar monitoramento
  monitor.startMonitoring()
    .then(() => {
      logger.info('Monitor iniciado com sucesso. Pressione Ctrl+C para parar.');
      
      // Processar arquivos existentes se solicitado
      if (process.argv.includes('--process-existing')) {
        setTimeout(() => {
          monitor.processExistingFiles();
        }, 5000);
      }
    })
    .catch(error => {
      logger.error('Erro ao iniciar monitor:', error.message);
      process.exit(1);
    });
}
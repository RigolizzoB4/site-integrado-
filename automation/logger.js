/**
 * PowerMate Automation - Sistema de Logging
 * Sistema de logs para monitoramento e debug
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

class Logger {
  constructor() {
    this.config = config.logging;
    this.logFile = path.resolve(this.config.logFile);
    this.ensureLogDirectory();
  }

  /**
   * Garante que o diretório de logs existe
   */
  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Formata timestamp para logs
   * @returns {string} Timestamp formatado
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Formata mensagem de log
   * @param {string} level - Nível do log
   * @param {string} message - Mensagem
   * @param {Object} meta - Metadados opcionais
   * @returns {string} Mensagem formatada
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  /**
   * Escreve log no arquivo
   * @param {string} formattedMessage - Mensagem formatada
   */
  writeToFile(formattedMessage) {
    if (this.config.logToFile) {
      try {
        fs.appendFileSync(this.logFile, formattedMessage + '\n');
        this.rotateLogIfNeeded();
      } catch (error) {
        console.error('Erro ao escrever no arquivo de log:', error.message);
      }
    }
  }

  /**
   * Rotaciona logs se necessário
   */
  rotateLogIfNeeded() {
    try {
      const stats = fs.statSync(this.logFile);
      const maxSize = this.parseSize(this.config.maxLogSize);
      
      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = this.logFile.replace('.log', `_${timestamp}.log`);
        fs.renameSync(this.logFile, rotatedFile);
        
        // Limpar logs antigos
        this.cleanOldLogs();
      }
    } catch (error) {
      console.error('Erro ao rotacionar log:', error.message);
    }
  }

  /**
   * Remove logs antigos
   */
  cleanOldLogs() {
    try {
      const logDir = path.dirname(this.logFile);
      const baseName = path.basename(this.logFile, '.log');
      const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith(baseName) && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          mtime: fs.statSync(path.join(logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Manter apenas os arquivos mais recentes
      if (files.length > this.config.maxLogFiles) {
        files.slice(this.config.maxLogFiles).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error.message);
    }
  }

  /**
   * Converte string de tamanho para bytes
   * @param {string} sizeStr - String de tamanho (ex: "10MB")
   * @returns {number} Tamanho em bytes
   */
  parseSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+)(B|KB|MB|GB)$/i);
    if (!match) return 10 * 1024 * 1024; // 10MB default
    return parseInt(match[1]) * units[match[2].toUpperCase()];
  }

  /**
   * Verifica se deve logar baseado no nível
   * @param {string} level - Nível do log
   * @returns {boolean} Se deve logar
   */
  shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = levels[this.config.level] || 2;
    const messageLevel = levels[level] || 2;
    return messageLevel <= currentLevel;
  }

  /**
   * Log de erro
   * @param {string} message - Mensagem
   * @param {Object} meta - Metadados opcionais
   */
  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage('error', message, meta);
      console.error(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log de aviso
   * @param {string} message - Mensagem
   * @param {Object} meta - Metadados opcionais
   */
  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message, meta);
      console.warn(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log informativo
   * @param {string} message - Mensagem
   * @param {Object} meta - Metadados opcionais
   */
  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message, meta);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log de debug
   * @param {string} message - Mensagem
   * @param {Object} meta - Metadados opcionais
   */
  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message, meta);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log de atividade específica do PowerMate
   * @param {string} activity - Tipo de atividade
   * @param {string} message - Mensagem
   * @param {Object} meta - Metadados opcionais
   */
  activity(activity, message, meta = {}) {
    this.info(`[${activity}] ${message}`, meta);
  }
}

// Exportar instância única
module.exports = new Logger();
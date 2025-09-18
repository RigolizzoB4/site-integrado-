/**
 * PowerMate Automation - Validador de ZIP
 * Valida integridade e estrutura de arquivos ZIP
 */

const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const config = require('./config');
const logger = require('./logger');

class ZipValidator {
  constructor() {
    this.config = config.zipValidation;
  }

  /**
   * Valida um arquivo ZIP
   * @param {string} filePath - Caminho para o arquivo ZIP
   * @returns {Promise<Object>} Resultado da validação
   */
  async validateZip(filePath) {
    const result = {
      isValid: false,
      errors: [],
      warnings: [],
      info: {
        fileName: path.basename(filePath),
        fileSize: 0,
        entryCount: 0,
        structure: []
      }
    };

    try {
      // Verificar se o arquivo existe
      if (!fs.existsSync(filePath)) {
        result.errors.push('Arquivo não encontrado');
        return result;
      }

      // Verificar tamanho do arquivo
      const stats = fs.statSync(filePath);
      result.info.fileSize = stats.size;

      if (stats.size === 0) {
        result.errors.push('Arquivo está vazio');
        return result;
      }

      if (stats.size > config.folderMonitor.maxFileSize) {
        result.errors.push(`Arquivo muito grande (${this.formatBytes(stats.size)}). Máximo permitido: ${this.formatBytes(config.folderMonitor.maxFileSize)}`);
        return result;
      }

      // Validar estrutura do ZIP
      const zipValidation = await this.validateZipStructure(filePath);
      result.info.entryCount = zipValidation.entryCount;
      result.info.structure = zipValidation.structure;
      result.errors.push(...zipValidation.errors);
      result.warnings.push(...zipValidation.warnings);

      // Determinar se é válido
      result.isValid = result.errors.length === 0;

      logger.info(`Validação ZIP completa para ${result.info.fileName}:`, {
        isValid: result.isValid,
        errors: result.errors.length,
        warnings: result.warnings.length
      });

      return result;

    } catch (error) {
      logger.error('Erro durante validação do ZIP:', error);
      result.errors.push(`Erro interno: ${error.message}`);
      return result;
    }
  }

  /**
   * Valida a estrutura interna do ZIP
   * @param {string} filePath - Caminho para o arquivo ZIP
   * @returns {Promise<Object>} Informações da estrutura
   */
  validateZipStructure(filePath) {
    return new Promise((resolve, reject) => {
      const result = {
        entryCount: 0,
        structure: [],
        errors: [],
        warnings: []
      };

      yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          result.errors.push(`Erro ao abrir ZIP: ${err.message}`);
          resolve(result);
          return;
        }

        zipfile.readEntry();

        zipfile.on('entry', (entry) => {
          result.entryCount++;
          result.structure.push({
            fileName: entry.fileName,
            uncompressedSize: entry.uncompressedSize,
            compressedSize: entry.compressedSize,
            isDirectory: /\/$/.test(entry.fileName)
          });

          // Verificar nomes de arquivos suspeitos
          if (this.hasSuspiciousName(entry.fileName)) {
            result.warnings.push(`Nome de arquivo suspeito: ${entry.fileName}`);
          }

          zipfile.readEntry();
        });

        zipfile.on('end', () => {
          // Verificar estrutura esperada se configurada
          if (this.config.checkStructure && this.config.expectedStructure.length > 0) {
            this.validateExpectedStructure(result);
          }

          resolve(result);
        });

        zipfile.on('error', (err) => {
          result.errors.push(`Erro ao ler ZIP: ${err.message}`);
          resolve(result);
        });
      });
    });
  }

  /**
   * Verifica se a estrutura esperada está presente
   * @param {Object} result - Resultado da validação
   */
  validateExpectedStructure(result) {
    const foundPaths = result.structure.map(item => item.fileName);
    
    this.config.expectedStructure.forEach(expectedPath => {
      const found = foundPaths.some(path => path.startsWith(expectedPath));
      if (!found) {
        result.warnings.push(`Estrutura esperada não encontrada: ${expectedPath}`);
      }
    });
  }

  /**
   * Verifica se o nome do arquivo é suspeito
   * @param {string} fileName - Nome do arquivo
   * @returns {boolean} True se suspeito
   */
  hasSuspiciousName(fileName) {
    const suspiciousPatterns = [
      /\.(exe|bat|cmd|scr|pif|com)$/i,  // Executáveis
      /\.\./,                           // Path traversal
      /[<>:"|?*]/,                     // Caracteres inválidos Windows
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i  // Nomes reservados Windows
    ];

    return suspiciousPatterns.some(pattern => pattern.test(fileName));
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

  /**
   * Valida múltiplos arquivos ZIP
   * @param {string[]} filePaths - Array de caminhos para arquivos ZIP
   * @returns {Promise<Object[]>} Array de resultados
   */
  async validateMultiple(filePaths) {
    const results = [];
    for (const filePath of filePaths) {
      const result = await this.validateZip(filePath);
      results.push(result);
    }
    return results;
  }
}

// Exportar classe e instância
module.exports = ZipValidator;

// CLI para uso direto
if (require.main === module) {
  const validator = new ZipValidator();
  const filePath = process.argv[2];

  if (!filePath) {
    console.log('Uso: node zip-validator.js <caminho-para-arquivo.zip>');
    process.exit(1);
  }

  validator.validateZip(filePath)
    .then(result => {
      console.log('\n=== RESULTADO DA VALIDAÇÃO ===');
      console.log(`Arquivo: ${result.info.fileName}`);
      console.log(`Tamanho: ${validator.formatBytes(result.info.fileSize)}`);
      console.log(`Entradas: ${result.info.entryCount}`);
      console.log(`Válido: ${result.isValid ? '✅ SIM' : '❌ NÃO'}`);
      
      if (result.errors.length > 0) {
        console.log('\n🚨 ERROS:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\n⚠️  AVISOS:');
        result.warnings.forEach(warning => console.log(`  - ${warning}`));
      }

      if (result.info.structure.length > 0) {
        console.log('\n📁 ESTRUTURA:');
        result.info.structure.slice(0, 10).forEach(item => {
          const icon = item.isDirectory ? '📁' : '📄';
          console.log(`  ${icon} ${item.fileName} (${validator.formatBytes(item.uncompressedSize)})`);
        });
        if (result.info.structure.length > 10) {
          console.log(`  ... e mais ${result.info.structure.length - 10} itens`);
        }
      }

      process.exit(result.isValid ? 0 : 1);
    })
    .catch(error => {
      console.error('Erro:', error.message);
      process.exit(1);
    });
}
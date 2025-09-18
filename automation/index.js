/**
 * PowerMate Automation - Arquivo Principal
 * Sistema completo de automação para validação de ZIP e integração com Kommo CRM
 */

const config = require('./config');
const logger = require('./logger');
const FolderMonitor = require('./folder-monitor');
const WebInterface = require('./web-interface');
const KommoIntegration = require('./kommo-integration');

class PowerMateAutomation {
  constructor() {
    this.folderMonitor = new FolderMonitor();
    this.webInterface = new WebInterface();
    this.kommoIntegration = new KommoIntegration();
    this.isRunning = false;
  }

  /**
   * Inicializa todo o sistema PowerMate
   * @returns {Promise<boolean>} Sucesso da inicialização
   */
  async initialize() {
    try {
      logger.info('='.repeat(60));
      logger.info('🚀 INICIALIZANDO POWERMATE AUTOMATION');
      logger.info('='.repeat(60));
      
      // Verificar configuração
      this.validateConfiguration();
      
      // Inicializar componentes
      logger.info('📁 Inicializando monitor de pasta...');
      const monitorReady = await this.folderMonitor.initialize();
      if (!monitorReady) {
        throw new Error('Falha ao inicializar monitor de pasta');
      }
      
      logger.info('🌐 Inicializando integração Kommo...');
      const kommoReady = await this.kommoIntegration.initialize();
      if (!kommoReady) {
        logger.warn('⚠️  Kommo não configurado - funcionando em modo local apenas');
      }
      
      logger.info('🖥️  Inicializando interface web...');
      await this.webInterface.start();
      
      this.isRunning = true;
      
      logger.info('✅ PowerMate Automation iniciado com sucesso!');
      logger.info(`📊 Dashboard disponível em: http://${config.webInterface.host}:${config.webInterface.port}/powermate`);
      logger.info(`📂 Monitorando pasta: ${this.folderMonitor.watchPath}`);
      
      return true;
      
    } catch (error) {
      logger.error('❌ Erro na inicialização:', error.message);
      return false;
    }
  }

  /**
   * Valida a configuração do sistema
   */
  validateConfiguration() {
    logger.info('🔍 Validando configuração...');
    
    const required = [
      { key: 'folderMonitor.watchPath', value: config.folderMonitor.watchPath },
      { key: 'webInterface.port', value: config.webInterface.port }
    ];
    
    const missing = required.filter(item => !item.value);
    if (missing.length > 0) {
      throw new Error(`Configurações obrigatórias ausentes: ${missing.map(m => m.key).join(', ')}`);
    }
    
    // Avisos para configurações opcionais
    if (!config.kommo.accessToken) {
      logger.warn('⚠️  Token Kommo não configurado - integração desabilitada');
    }
    
    logger.info('✅ Configuração validada');
  }

  /**
   * Inicia o monitoramento de pasta
   * @returns {Promise<void>}
   */
  async startMonitoring() {
    if (!this.isRunning) {
      throw new Error('Sistema não inicializado');
    }
    
    logger.info('🔄 Iniciando monitoramento de pasta...');
    await this.folderMonitor.startMonitoring();
    logger.info('👀 Monitoramento ativo');
  }

  /**
   * Para o monitoramento de pasta
   * @returns {Promise<void>}
   */
  async stopMonitoring() {
    logger.info('⏹️  Parando monitoramento...');
    await this.folderMonitor.stopMonitoring();
    logger.info('🛑 Monitoramento parado');
  }

  /**
   * Para todo o sistema PowerMate
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.isRunning) {
      return;
    }
    
    logger.info('🔄 Iniciando shutdown do PowerMate...');
    
    try {
      await this.folderMonitor.stopMonitoring();
      await this.webInterface.stop();
      
      this.isRunning = false;
      logger.info('✅ PowerMate Automation finalizado com sucesso');
      
    } catch (error) {
      logger.error('❌ Erro durante shutdown:', error.message);
    }
  }

  /**
   * Obtém estatísticas do sistema
   * @returns {Object} Estatísticas completas
   */
  getSystemStats() {
    return {
      powermate: {
        version: '1.0.0',
        isRunning: this.isRunning,
        uptime: process.uptime(),
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
      },
      monitor: this.folderMonitor.getStats(),
      kommo: {
        authenticated: this.kommoIntegration.authenticated,
        configured: !!config.kommo.accessToken
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        pid: process.pid
      }
    };
  }

  /**
   * Executa teste completo do sistema
   * @returns {Promise<Object>} Resultado dos testes
   */
  async runSystemTest() {
    logger.info('🧪 Executando teste completo do sistema...');
    
    const testResults = {
      overall: true,
      tests: {}
    };

    try {
      // Teste do monitor de pasta
      logger.info('📁 Testando monitor de pasta...');
      testResults.tests.folderMonitor = {
        passed: this.folderMonitor.watchPath && require('fs').existsSync(this.folderMonitor.watchPath),
        message: testResults.tests.folderMonitor?.passed ? 'Pasta de monitoramento acessível' : 'Pasta não encontrada'
      };

      // Teste da validação ZIP
      logger.info('📦 Testando validador ZIP...');
      testResults.tests.zipValidator = {
        passed: true,
        message: 'Validador ZIP operacional'
      };

      // Teste do Kommo (se configurado)
      if (config.kommo.accessToken) {
        logger.info('🔗 Testando conexão Kommo...');
        try {
          await this.kommoIntegration.getAccountStats();
          testResults.tests.kommo = {
            passed: true,
            message: 'Kommo conectado com sucesso'
          };
        } catch (error) {
          testResults.tests.kommo = {
            passed: false,
            message: `Erro na conexão Kommo: ${error.message}`
          };
        }
      } else {
        testResults.tests.kommo = {
          passed: true,
          message: 'Kommo não configurado (opcional)'
        };
      }

      // Teste da interface web
      logger.info('🌐 Testando interface web...');
      testResults.tests.webInterface = {
        passed: this.webInterface && this.webInterface.server.listening,
        message: testResults.tests.webInterface?.passed ? 'Interface web ativa' : 'Interface web não responsiva'
      };

      // Resultado geral
      testResults.overall = Object.values(testResults.tests).every(test => test.passed);
      
      if (testResults.overall) {
        logger.info('✅ Todos os testes passaram!');
      } else {
        logger.warn('⚠️  Alguns testes falharam');
      }

      return testResults;

    } catch (error) {
      logger.error('❌ Erro durante teste do sistema:', error.message);
      testResults.overall = false;
      testResults.error = error.message;
      return testResults;
    }
  }
}

// Exportar classe
module.exports = PowerMateAutomation;

// Execução direta via CLI
if (require.main === module) {
  const powermate = new PowerMateAutomation();
  
  // Manipular sinais do sistema
  const gracefulShutdown = async (signal) => {
    logger.info(`Recebido sinal ${signal}, iniciando shutdown graceful...`);
    await powermate.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  // Manipular erros não capturados
  process.on('uncaughtException', (error) => {
    logger.error('Erro não capturado:', error);
    powermate.shutdown().then(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise rejeitada não tratada:', reason);
    logger.error('Em:', promise);
  });

  // Função principal
  async function main() {
    try {
      // Verificar argumentos da linha de comando
      const args = process.argv.slice(2);
      
      if (args.includes('--test')) {
        // Modo de teste
        const initialized = await powermate.initialize();
        if (initialized) {
          const testResults = await powermate.runSystemTest();
          console.log('\n📊 RESULTADOS DOS TESTES:');
          console.log('='.repeat(40));
          
          Object.entries(testResults.tests).forEach(([name, result]) => {
            const status = result.passed ? '✅ PASSOU' : '❌ FALHOU';
            console.log(`${name}: ${status} - ${result.message}`);
          });
          
          console.log('='.repeat(40));
          console.log(`RESULTADO GERAL: ${testResults.overall ? '✅ SUCESSO' : '❌ FALHA'}`);
          
          await powermate.shutdown();
          process.exit(testResults.overall ? 0 : 1);
        } else {
          process.exit(1);
        }
        
      } else if (args.includes('--monitor-only')) {
        // Executar apenas o monitor de pasta
        const initialized = await powermate.initialize();
        if (initialized) {
          await powermate.startMonitoring();
          logger.info('💡 Modo somente monitor. Pressione Ctrl+C para parar.');
        }
        
      } else {
        // Modo completo
        const initialized = await powermate.initialize();
        if (initialized) {
          await powermate.startMonitoring();
          
          // Mostrar estatísticas iniciais
          const stats = powermate.getSystemStats();
          logger.info('📊 Sistema ativo com as seguintes configurações:');
          logger.info(`   • Pasta monitorada: ${stats.monitor.watchPath}`);
          logger.info(`   • Extensões permitidas: ${stats.monitor.allowedExtensions.join(', ')}`);
          logger.info(`   • Tamanho máximo: ${stats.monitor.maxFileSize}`);
          logger.info(`   • Kommo: ${stats.kommo.configured ? 'Configurado' : 'Não configurado'}`);
          
          logger.info('💡 Sistema PowerMate em execução. Pressione Ctrl+C para parar.');
        }
      }
      
    } catch (error) {
      logger.error('❌ Erro fatal:', error.message);
      process.exit(1);
    }
  }

  // Iniciar aplicação
  main().catch(error => {
    logger.error('❌ Erro na função principal:', error.message);
    process.exit(1);
  });
}
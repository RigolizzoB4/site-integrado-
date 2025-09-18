/**
 * PowerMate Automation - Integração com Kommo CRM
 * Integração completa com API do Kommo para automação de leads e arquivos
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const config = require('./config');
const logger = require('./logger');

class KommoIntegration {
  constructor() {
    this.config = config.kommo;
    this.baseURL = this.config.apiUrl;
    this.accessToken = this.config.accessToken;
    this.refreshToken = this.config.refreshToken;
    this.authenticated = false;
  }

  /**
   * Inicializa a conexão com o Kommo
   * @returns {Promise<boolean>} Sucesso da inicialização
   */
  async initialize() {
    try {
      if (this.accessToken) {
        await this.validateToken();
      } else {
        logger.warn('Token de acesso não configurado. Iniciando processo de autenticação...');
        // Em produção, isso redirecionaria para o fluxo OAuth
        return false;
      }
      
      this.authenticated = true;
      logger.info('Kommo CRM conectado com sucesso');
      return true;
    } catch (error) {
      logger.error('Erro ao inicializar conexão com Kommo:', error.message);
      return false;
    }
  }

  /**
   * Valida o token atual
   * @returns {Promise<boolean>} Token válido
   */
  async validateToken() {
    try {
      const response = await this.makeRequest('GET', '/account');
      return response.status === 200;
    } catch (error) {
      if (error.response?.status === 401) {
        logger.info('Token expirado, tentando renovar...');
        return await this.refreshAccessToken();
      }
      throw error;
    }
  }

  /**
   * Renova o token de acesso
   * @returns {Promise<boolean>} Sucesso da renovação
   */
  async refreshAccessToken() {
    try {
      const response = await axios.post(`${this.baseURL}/oauth2/access_token`, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      logger.info('Token renovado com sucesso');
      return true;
    } catch (error) {
      logger.error('Erro ao renovar token:', error.message);
      return false;
    }
  }

  /**
   * Faz requisição autenticada para a API
   * @param {string} method - Método HTTP
   * @param {string} endpoint - Endpoint da API
   * @param {Object} data - Dados para envio
   * @returns {Promise<Object>} Resposta da API
   */
  async makeRequest(method, endpoint, data = null) {
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };

    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      logger.error(`Erro na requisição ${method} ${endpoint}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Cria um novo lead no Kommo
   * @param {Object} leadData - Dados do lead
   * @returns {Promise<Object>} Lead criado
   */
  async createLead(leadData) {
    try {
      const lead = {
        name: leadData.name || 'Lead PowerMate',
        price: leadData.price || 0,
        responsible_user_id: leadData.responsibleUserId,
        status_id: leadData.statusId,
        pipeline_id: leadData.pipelineId,
        custom_fields_values: leadData.customFields || [],
        _embedded: {
          contacts: leadData.contacts || []
        }
      };

      const response = await this.makeRequest('POST', '/leads', [lead]);
      const createdLead = response.data._embedded.leads[0];
      
      logger.activity('KOMMO', `Lead criado: ${createdLead.name} (ID: ${createdLead.id})`);
      return createdLead;
    } catch (error) {
      logger.error('Erro ao criar lead:', error.message);
      throw error;
    }
  }

  /**
   * Adiciona arquivo a um lead
   * @param {number} leadId - ID do lead
   * @param {string} filePath - Caminho do arquivo
   * @param {string} description - Descrição do arquivo
   * @returns {Promise<Object>} Arquivo anexado
   */
  async attachFileToLead(leadId, filePath, description = '') {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Arquivo não encontrado: ' + filePath);
      }

      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      
      // Upload do arquivo
      const uploadResponse = await axios.post(
        `${this.baseURL}/files/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const fileId = uploadResponse.data.file_uuid;

      // Anexar arquivo ao lead
      const noteData = {
        entity_id: leadId,
        entity_type: 'leads',
        note_type: 'common',
        params: {
          text: description || `Arquivo anexado: ${path.basename(filePath)}`,
          attachment: {
            file_uuid: fileId,
            file_name: path.basename(filePath)
          }
        }
      };

      const noteResponse = await this.makeRequest('POST', '/notes', [noteData]);
      
      logger.activity('KOMMO', `Arquivo anexado ao lead ${leadId}: ${path.basename(filePath)}`);
      return noteResponse.data;
    } catch (error) {
      logger.error('Erro ao anexar arquivo:', error.message);
      throw error;
    }
  }

  /**
   * Busca leads por critério
   * @param {Object} criteria - Critérios de busca
   * @returns {Promise<Array>} Lista de leads
   */
  async searchLeads(criteria) {
    try {
      const params = new URLSearchParams();
      
      if (criteria.query) params.append('query', criteria.query);
      if (criteria.responsible_user_id) params.append('filter[responsible_user_id]', criteria.responsible_user_id);
      if (criteria.status_id) params.append('filter[statuses]', criteria.status_id);
      
      const response = await this.makeRequest('GET', `/leads?${params.toString()}`);
      return response.data._embedded?.leads || [];
    } catch (error) {
      logger.error('Erro ao buscar leads:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza um lead existente
   * @param {number} leadId - ID do lead
   * @param {Object} updateData - Dados para atualização
   * @returns {Promise<Object>} Lead atualizado
   */
  async updateLead(leadId, updateData) {
    try {
      const response = await this.makeRequest('PATCH', `/leads/${leadId}`, updateData);
      logger.activity('KOMMO', `Lead atualizado: ${leadId}`);
      return response.data;
    } catch (error) {
      logger.error('Erro ao atualizar lead:', error.message);
      throw error;
    }
  }

  /**
   * Cria contato no Kommo
   * @param {Object} contactData - Dados do contato
   * @returns {Promise<Object>} Contato criado
   */
  async createContact(contactData) {
    try {
      const contact = {
        name: contactData.name,
        first_name: contactData.firstName,
        last_name: contactData.lastName,
        responsible_user_id: contactData.responsibleUserId,
        custom_fields_values: [
          {
            field_id: 'EMAIL',
            values: [{ value: contactData.email, enum_code: 'WORK' }]
          },
          {
            field_id: 'PHONE',
            values: [{ value: contactData.phone, enum_code: 'WORK' }]
          }
        ]
      };

      const response = await this.makeRequest('POST', '/contacts', [contact]);
      const createdContact = response.data._embedded.contacts[0];
      
      logger.activity('KOMMO', `Contato criado: ${createdContact.name} (ID: ${createdContact.id})`);
      return createdContact;
    } catch (error) {
      logger.error('Erro ao criar contato:', error.message);
      throw error;
    }
  }

  /**
   * Adiciona nota a um lead
   * @param {number} leadId - ID do lead
   * @param {string} text - Texto da nota
   * @param {string} type - Tipo da nota
   * @returns {Promise<Object>} Nota criada
   */
  async addNoteToLead(leadId, text, type = 'common') {
    try {
      const noteData = {
        entity_id: leadId,
        entity_type: 'leads',
        note_type: type,
        params: { text }
      };

      const response = await this.makeRequest('POST', '/notes', [noteData]);
      logger.activity('KOMMO', `Nota adicionada ao lead ${leadId}`);
      return response.data;
    } catch (error) {
      logger.error('Erro ao adicionar nota:', error.message);
      throw error;
    }
  }

  /**
   * Processa arquivo automaticamente e cria lead
   * @param {string} filePath - Caminho do arquivo
   * @param {Object} fileInfo - Informações do arquivo
   * @returns {Promise<Object>} Resultado do processamento
   */
  async processFileAutomatically(filePath, fileInfo) {
    try {
      const fileName = path.basename(filePath);
      
      // Criar lead automático
      const leadData = {
        name: `Arquivo PowerMate: ${fileName}`,
        price: 0,
        customFields: [
          {
            field_code: 'POWERMATE_FILE',
            values: [{ value: fileName }]
          },
          {
            field_code: 'FILE_SIZE',
            values: [{ value: this.formatBytes(fileInfo.size) }]
          }
        ]
      };

      const lead = await this.createLead(leadData);

      // Anexar arquivo ao lead
      await this.attachFileToLead(lead.id, filePath, `Arquivo processado automaticamente pelo PowerMate\nTamanho: ${this.formatBytes(fileInfo.size)}`);

      // Adicionar nota sobre a validação
      if (fileInfo.validation) {
        const noteText = fileInfo.validation.isValid 
          ? '✅ Arquivo validado com sucesso'
          : `❌ Arquivo com problemas:\n${fileInfo.validation.errors.join('\n')}`;
        
        await this.addNoteToLead(lead.id, noteText);
      }

      logger.activity('KOMMO', `Arquivo processado automaticamente: ${fileName} → Lead ${lead.id}`);
      return { success: true, leadId: lead.id, fileName };

    } catch (error) {
      logger.error('Erro no processamento automático:', error.message);
      return { success: false, error: error.message };
    }
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
   * Obtém estatísticas da conta
   * @returns {Promise<Object>} Estatísticas
   */
  async getAccountStats() {
    try {
      const response = await this.makeRequest('GET', '/account');
      return {
        name: response.data.name,
        subdomain: response.data.subdomain,
        currency: response.data.currency,
        timezone: response.data.timezone
      };
    } catch (error) {
      logger.error('Erro ao obter estatísticas:', error.message);
      throw error;
    }
  }
}

module.exports = KommoIntegration;
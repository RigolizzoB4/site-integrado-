#!/bin/bash

echo "========================================"
echo "PowerMate Automation - Instalação"
echo "B4 Trade - Sistema de Automação"
echo "========================================"
echo

# Verificar se Node.js está instalado
echo "[1/5] Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ ERRO: Node.js não encontrado!"
    echo "Por favor, instale Node.js 14+ de: https://nodejs.org"
    exit 1
fi
echo "✅ Node.js encontrado: $(node --version)"

# Verificar se NPM está disponível
echo "[2/5] Verificando NPM..."
if ! command -v npm &> /dev/null; then
    echo "❌ ERRO: NPM não encontrado!"
    exit 1
fi
echo "✅ NPM encontrado: $(npm --version)"

# Instalar dependências
echo "[3/5] Instalando dependências..."
if ! npm install; then
    echo "❌ ERRO: Falha na instalação das dependências"
    exit 1
fi
echo "✅ Dependências instaladas"

# Criar arquivo de configuração
echo "[4/5] Configurando ambiente..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Arquivo .env criado (configure suas credenciais)"
else
    echo "✅ Arquivo .env já existe"
fi

# Criar pastas necessárias
echo "[5/5] Criando estrutura de pastas..."
mkdir -p automation/logs
mkdir -p automation/temp
echo "✅ Pastas criadas"

echo
echo "========================================"
echo "✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
echo "========================================"
echo
echo "Próximos passos:"
echo "1. Edite o arquivo .env com suas configurações"
echo "2. Configure a pasta de monitoramento OneDrive"
echo "3. Adicione credenciais do Kommo CRM (opcional)"
echo "4. Execute: npm start"
echo
echo "Dashboard disponível em: http://localhost:3000/powermate"
echo
echo "Para testar o sistema:"
echo "  npm start -- --test"
echo
echo "Para ver logs em tempo real:"
echo "  tail -f automation/logs/powermate.log"
echo

# Tornar executável
chmod +x install-powermate.sh
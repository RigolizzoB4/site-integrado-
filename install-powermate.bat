@echo off
echo ========================================
echo PowerMate Automation - Instalacao
echo B4 Trade - Sistema de Automacao
echo ========================================
echo.

REM Verificar se Node.js esta instalado
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale Node.js 14+ de: https://nodejs.org
    pause
    exit /b 1
)
echo ✓ Node.js encontrado

REM Verificar se NPM esta disponivel
echo [2/5] Verificando NPM...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: NPM nao encontrado!
    pause
    exit /b 1
)
echo ✓ NPM encontrado

REM Instalar dependencias
echo [3/5] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha na instalacao das dependencias
    pause
    exit /b 1
)
echo ✓ Dependencias instaladas

REM Criar arquivo de configuracao
echo [4/5] Configurando ambiente...
if not exist .env (
    copy .env.example .env >nul
    echo ✓ Arquivo .env criado (configure suas credenciais)
) else (
    echo ✓ Arquivo .env ja existe
)

REM Criar pastas necessarias
echo [5/5] Criando estrutura de pastas...
if not exist "automation\logs" mkdir "automation\logs"
if not exist "automation\temp" mkdir "automation\temp"
echo ✓ Pastas criadas

echo.
echo ========================================
echo ✓ INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================
echo.
echo Proximos passos:
echo 1. Edite o arquivo .env com suas configuracoes
echo 2. Configure a pasta de monitoramento OneDrive
echo 3. Adicione credenciais do Kommo CRM (opcional)
echo 4. Execute: npm start
echo.
echo Dashboard disponivel em: http://localhost:3000/powermate
echo.
echo Para testar o sistema:
echo   npm start -- --test
echo.
echo Para ver logs em tempo real:
echo   Get-Content automation\logs\powermate.log -Wait
echo.
pause
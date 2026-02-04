# TODO - Plataforma de Planejamento de Escalas

## Banco de Dados e Modelos
- [x] Criar tabela `runs` (execuções de processamento)
- [x] Criar tabela `escalas` (atividades consolidadas)
- [x] Criar tabela `eventos` (eventos consolidados)
- [x] Criar tabela `alertas_conflito` (conflitos de horário)
- [x] Criar tabela `alertas_folga` (violações de folga)
- [x] Criar tabela `alertas_deslocamento` (riscos de deslocamento)
- [x] Criar tabela `qualidade_dados` (problemas de dados)

## Pipeline ETL e Regras de Negócio
- [x] Implementar parser de planilhas Excel (2468 e 2020)
- [x] Implementar normalização de colunas
- [x] Implementar cálculo de duração com tratamento de virada de dia
- [x] Implementar merge de dados por WO + data
- [x] Implementar regra: detecção de conflito de horário (sobreposição)
- [x] Implementar regra: detecção de violação de folga (bloqueio de dia inteiro)
- [x] Implementar regra: detecção de risco de deslocamento (gap por cidade)
- [x] Implementar salvamento de dados processados no banco

## Backend - Rotas tRPC
- [x] Rota: upload de arquivos Excel
- [x] Rota: processar planilhas e gerar alertas
- [x] Rota: listar execuções (runs)
- [x] Rota: obter estatísticas do dashboard (KPIs)
- [x] Rota: listar alertas de conflito com filtros
- [x] Rota: listar alertas de folga com filtros
- [x] Rota: listar alertas de deslocamento com filtros
- [x] Rota: obter dados de tendências (alertas por semana)
- [x] Rota: obter rankings (top 10 pessoas)

## Frontend - Páginas e Componentes
- [x] Configurar tema e cores globais (index.css)
- [x] Criar layout com DashboardLayout
- [x] Página: Home/Upload de planilhas
- [x] Página: Dashboard executivo com KPIs
- [x] Componente: Cards de KPIs
- [x] Componente: Gráficos de tendências (alertas por semana)
- [x] Componente: Gráficos de horas por semana)
- [x] Componente: Rankings Top 10
- [x] Página: Alertas de conflito (tabela filtrável)
- [x] Página: Alertas de folga (tabela filtrável)
- [x] Página: Alertas de deslocamento (tabela filtrável)
- [ ] Página: Detalhes de pessoa (drill-down)

## Testes
- [x] Testar upload de planilhas
- [x] Testar processamento ETL
- [x] Testar detecção de conflitos
- [x] Testar detecção de violações de folga
- [x] Testar detecção de riscos de deslocamento
- [ ] Testar visualizações do dashboard
- [ ] Testar filtros de alertas

## Documentação
- [ ] README.md com instruções de uso
- [ ] Documentar regras de negócio
- [ ] Documentar estrutura de dados
- [ ] Documentar fluxo de processamento

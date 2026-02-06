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
- [x] Testar detecção de interjornada
- [x] Testar detecção de viagens
- [ ] Testar visualizações do dashboard
- [ ] Testar filtros de alertas

## Documentação
- [ ] README.md com instruções de uso
- [ ] Documentar regras de negócio
- [ ] Documentar estrutura de dados
- [ ] Documentar fluxo de processamento


## Novos Recursos - Expansão da Plataforma

### Alerta de Interjornada
- [x] Criar tabela `alertas_interjornada` no schema
- [x] Implementar regra: detectar descanso < 11h entre atividades
- [x] Adicionar KPI de interjornada no dashboard
- [x] Criar página de alertas de interjornada

### Histórico Multi-Run
- [ ] Implementar visão macro (agregação de todos os runs)
- [ ] Implementar visão micro (detalhes por run específico)
- [ ] Adicionar seletor de período no dashboard
- [ ] Criar página de histórico de runs

### Filtros Avançados
- [ ] Adicionar filtro por período (data início/fim)
- [ ] Adicionar filtro por canal
- [ ] Adicionar filtro por função
- [ ] Aplicar filtros em todas as páginas de alertas
- [ ] Aplicar filtros no dashboard

### Quantificação de Volumes
- [x] Criar tabela `viagens` para rastrear deslocamentos
- [x] Implementar detecção de viagens (mudança de cidade)
- [x] Adicionar KPI: total de eventos únicos
- [x] Adicionar KPI: total de viagens
- [ ] Adicionar gráfico: eventos por tipo
- [ ] Adicionar gráfico: viagens por destino

### Perfil Individual
- [ ] Criar rota: obter perfil de pessoa
- [ ] Criar rota: histórico de atividades por pessoa
- [ ] Criar rota: alertas por pessoa
- [ ] Criar rota: estatísticas de desempenho por pessoa
- [ ] Criar página: perfil de pessoa
- [ ] Exibir: total de horas, atividades, alertas
- [ ] Exibir: timeline de atividades
- [ ] Exibir: lista de alertas

### Análise de Grades
- [x] Criar tabela `grades` para armazenar grades de eventos
- [x] Criar tabela `analise_grades` para resultados de análise
- [x] Implementar parser de planilha de grade
- [x] Implementar cálculo de suficiência de narradores
- [x] Considerar férias e folgas no cálculo
- [x] Permitir input de exceções (licença maternidade, etc.)
- [ ] Criar rota: upload de grade
- [ ] Criar rota: processar análise de grade
- [ ] Criar rota: obter resultado de análise- [x] Criar rotas de upload e análise de grade (backend) de grades
- [ ] Exibir: eventos sem cobertura
- [ ] Exibir: narradores disponíveis por data
- [ ] Exibir: recomendações de ajuste


## Novo KPI - WOs sem Evento
- [x] Implementar cálculo de % de WOs sem evento associado
- [x] Adicionar KPI ao dashboard (backend)
- [x] Adicionar card de KPI no dashboard (frontend)
- [x] Criar teste para validar cálculo

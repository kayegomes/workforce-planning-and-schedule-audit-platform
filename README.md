# Plataforma de Planejamento de Escalas

Sistema web completo para gestão e auditoria de escalas de trabalho com detecção inteligente de conflitos, violações de folga e riscos de deslocamento.

## 🎯 Funcionalidades

### Upload e Processamento
- Upload de planilhas Excel (2468 Atividades e 2020 Eventos Consolidado)
- Processamento automático via pipeline ETL
- Consolidação e normalização de dados
- Cálculo automático de duração com tratamento de virada de dia
- Merge inteligente de dados por WO + data

### Detecção de Alertas

#### 1. Conflitos de Horário
- Detecta sobreposições de atividades para a mesma pessoa
- Calcula overlap em minutos
- Identifica eventos conflitantes

#### 2. Violações de Folga
- Detecta trabalho agendado em dias de folga, férias ou compensação
- Bloqueio de dia inteiro para folgas
- Rastreamento de duração e status de aprovação

#### 3. Riscos de Deslocamento
- Identifica gap insuficiente entre atividades em cidades diferentes
- Gap mínimo configurável (padrão: 3 horas)
- Rastreamento de origem/destino e horários

### Dashboard Executivo

#### KPIs
- **Horas Atividades:** Total de horas de trabalho
- **Total Atividades:** Número de atividades processadas
- **Alertas Conflito:** Sobreposições detectadas
- **Alertas Folga:** Violações de folga
- **Alertas Deslocamento:** Riscos de deslocamento

#### Visualizações
- **Conflitos por Semana:** Tendência de conflitos (gráfico de linha)
- **Horas por Semana:** Distribuição de carga de trabalho (gráfico de barras)

#### Rankings
- **Top 10 Conflitos:** Pessoas com mais conflitos de horário
- **Top 10 Violações de Folga:** Pessoas com mais trabalho em folga
- **Top 10 Riscos de Deslocamento:** Pessoas com mais gaps insuficientes

### Páginas de Alertas
- Tabelas detalhadas com todos os alertas detectados
- Filtros por pessoa, data, canal e função
- Exportação de dados (futuro)

## 🏗️ Arquitetura

### Backend
- **Framework:** Express + tRPC
- **Banco de Dados:** PostgreSQL (TiDB)
- **ETL:** Pipeline customizado com xlsx
- **Autenticação:** Manus OAuth

### Frontend
- **Framework:** React 19 + TypeScript
- **Estilo:** Tailwind CSS 4 + shadcn/ui
- **Gráficos:** Recharts
- **Roteamento:** Wouter

### Estrutura do Banco de Dados

#### Tabelas Principais
- `users` - Usuários do sistema
- `runs` - Execuções de processamento
- `escalas` - Atividades consolidadas (F_Escalas)
- `eventos` - Eventos consolidados (D_Eventos)
- `alertas_conflito` - Conflitos de horário
- `alertas_folga` - Violações de folga
- `alertas_deslocamento` - Riscos de deslocamento
- `qualidade_dados` - Problemas de qualidade de dados

## 🚀 Como Usar

### 1. Acesso
- Acesse a plataforma e faça login com sua conta Manus

### 2. Upload de Planilhas
- Na página inicial, selecione os dois arquivos:
  - **Planilha 2468:** Atividades de Equipe (Sub-Atividades)
  - **Planilha 2020:** Gestão de Eventos Consolidado
- Clique em "Processar Planilhas"

### 3. Processamento
- O sistema irá:
  1. Fazer upload dos arquivos para S3
  2. Processar e consolidar os dados
  3. Aplicar regras de negócio
  4. Detectar alertas
  5. Calcular estatísticas

### 4. Visualização
- Após o processamento, você será redirecionado para o Dashboard
- Explore os KPIs, gráficos e rankings
- Acesse as páginas de alertas para detalhes

## 📊 Regras de Negócio

### Conflito de Horário
```
SE pessoa tem duas atividades A e B
E horário de A sobrepõe horário de B
ENTÃO gerar alerta de conflito
```

### Violação de Folga
```
SE pessoa tem folga no dia D
E pessoa tem atividade de trabalho no dia D
ENTÃO gerar alerta de violação de folga
```

### Risco de Deslocamento
```
SE pessoa tem atividade A na cidade X
E pessoa tem atividade B na cidade Y (X ≠ Y)
E gap entre fim de A e início de B < 3 horas
ENTÃO gerar alerta de risco de deslocamento
```

## 🧪 Testes

Execute os testes com:

```bash
pnpm test
```

Cobertura de testes:
- ✅ Processamento ETL
- ✅ Detecção de conflitos
- ✅ Detecção de violações de folga
- ✅ Detecção de riscos de deslocamento
- ✅ Autenticação e logout

## 📝 Formato das Planilhas

### Planilha 2468 (Atividades)
Colunas esperadas:
- Nome
- Tipo de Atividade
- Data (DD/MM/YYYY)
- Início (HH:MM)
- Fim (HH:MM)
- WO#
- Função
- Cidade
- UF
- Status Aprov.

### Planilha 2020 (Eventos)
Colunas esperadas:
- WO#
- Data (DD/MM/YYYY)
- Tipo de Evento
- Produto
- Canal
- Cidade
- UF

## 🔧 Configuração

### Variáveis de Ambiente
Todas as variáveis são injetadas automaticamente pelo sistema Manus:
- `DATABASE_URL` - Conexão com PostgreSQL
- `JWT_SECRET` - Segredo para sessões
- `OAUTH_SERVER_URL` - URL do servidor OAuth

### Banco de Dados
Execute as migrações:

```bash
pnpm db:push
```

## 📈 Roadmap Futuro

- [ ] Página de detalhes por pessoa (drill-down)
- [ ] Exportação de alertas para Excel/CSV
- [ ] Filtros avançados (por canal, função, status)
- [ ] Configuração de gap mínimo por rota
- [ ] Notificações por e-mail
- [ ] Integração com Microsoft Teams
- [ ] API para integração externa
- [ ] Dashboard em tempo real (WebSocket)

## 🤝 Suporte

Para dúvidas ou problemas, entre em contato através do sistema Manus.

---

**Desenvolvido com ❤️ para otimizar o planejamento de escalas**

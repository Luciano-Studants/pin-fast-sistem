Quero adicionar ao sistema PINFAST um novo módulo chamado "Central de Estudos", integrado à estrutura atual da aplicação.

IMPORTANTE:
- NÃO recrie o PINFAST do zero.
- NÃO altere a identidade visual existente.
- NÃO remova nenhuma funcionalidade atual.
- NÃO altere a estrutura principal do menu lateral.
- Mantenha o mesmo estilo visual, tipografia, espaçamentos, bordas, sombras, cores e componentes já utilizados.
- As novas funcionalidades devem parecer parte nativa do PINFAST.
- A interface deve continuar limpa, moderna, acadêmica e produtiva.
- O sistema deve funcionar de maneira responsiva.
- Priorize uma experiência simples para estudantes.

==================================================
1. NOVA ÁREA: CENTRAL DE ESTUDOS
==================================================

Adicionar uma nova opção chamada:

📚 Central de Estudos

Ela deve aparecer no menu lateral dentro das áreas do usuário.

Ao acessar, criar uma dashboard de estudos.

Estrutura:

--------------------------------------------------
CENTRAL DE ESTUDOS
Organize seus estudos, acompanhe seu progresso e mantenha sua constância.
--------------------------------------------------

No topo apresentar:

[ 🔥 7 dias de sequência ]

[ ⏱️ 12h 40min estudados ]

[ 🎯 8 metas concluídas ]

[ ⭐ Nível 4 ]

Abaixo, apresentar uma seção:

"Estudar agora"

Com um card central contendo:

📚 Matéria
Banco de Dados

🎯 Assunto
Normalização

[ Iniciar estudo ]

O usuário deve poder selecionar uma matéria ou assunto antes de iniciar.

--------------------------------------------------
2. MATÉRIAS
--------------------------------------------------

Criar uma seção "Minhas matérias".

Permitir criar matérias.

Exemplo:

📘 Banco de Dados
📗 Programação
📙 Engenharia de Software
📕 Redes
📒 TCC

Cada matéria deve possuir:

- Nome
- Cor
- Descrição
- Professor opcional
- Instituição opcional
- Semestre
- Meta de horas
- Tempo estudado
- Quantidade de sessões
- Progresso

Exibir cada matéria em cards.

Exemplo:

┌──────────────────────────────┐
│ 📘 Banco de Dados            │
│                              │
│ 12h 40min estudados          │
│                              │
│ ████████████░░░ 78%          │
│                              │
│ 16 sessões                   │
└──────────────────────────────┘

Ao clicar na matéria, abrir uma página/dashboard específica da matéria.

Nessa página mostrar:

- Tempo total estudado
- Sessões realizadas
- Progresso
- Metas
- Questionários relacionados
- Documentos relacionados
- Post-its relacionados
- Flashcards, caso existam
- Próximos estudos
- Histórico de sessões

==================================================
3. POMODORO / TIMER DE ESTUDO
==================================================

Adicionar um sistema de Pomodoro integrado à Central de Estudos.

O usuário deve poder configurar completamente o tempo.

Não utilizar apenas tempos fixos.

Criar configuração:

Tempo de estudo:
[ 25 ] minutos

Pausa curta:
[ 5 ] minutos

Pausa longa:
[ 15 ] minutos

Sessões até pausa longa:
[ 4 ]

Permitir qualquer valor razoável escolhido pelo usuário.

Também disponibilizar presets:

🍅 Clássico
25 min / 5 min

⚡ Foco
50 min / 10 min

🧠 Profundo
90 min / 20 min

⚙ Personalizado

O timer deve possuir:

        25:00

       Foco

    Banco de Dados

[ Pausar ] [ Finalizar ]

Durante a sessão:

- Mostrar tempo restante
- Mostrar progresso circular ou barra
- Mostrar matéria
- Mostrar assunto
- Mostrar quantidade de sessões
- Permitir pausar
- Permitir continuar
- Permitir finalizar
- Permitir cancelar

Quando o estudo terminar:

Exibir uma pequena tela:

🎉 Sessão concluída!

Você estudou:

25 minutos

+25 XP

[ Iniciar próxima sessão ]

[ Finalizar ]

O tempo efetivamente estudado deve ser registrado no histórico.

==================================================
4. HISTÓRICO DE ESTUDOS
==================================================

Criar uma seção:

"Histórico de estudos"

Mostrar:

Hoje
📚 Banco de Dados
25 min

📝 Programação
50 min

Ontem
📘 Engenharia de Software
1h 20min

Permitir filtrar por:

- Hoje
- Semana
- Mês
- Matéria

Também mostrar gráfico simples de horas estudadas.

==================================================
5. SISTEMA DE METAS
==================================================

Criar um sistema de metas gamificado.

A ideia é incentivar o usuário a manter uma rotina de estudos e produtividade.

Criar uma seção:

🎯 Minhas metas

Existem três tipos principais:

1. META DIÁRIA
2. META SEMANAL
3. META DE ESTUDO

--------------------------------------------------
META DIÁRIA
--------------------------------------------------

Toda vez que o usuário entrar no PINFAST em um novo dia, registrar uma atividade diária.

IMPORTANTE:

Não contar múltiplas entradas no mesmo dia.

Exemplo:

Usuário entrou:

Segunda → +1 dia
Terça → +1 dia
Quarta → +1 dia

Se entrar 10 vezes na quarta-feira:

Continua contando somente 1 dia.

Mostrar:

🔥 Sequência atual
7 dias

🏆 Maior sequência
14 dias

Exibir calendário de atividade:

Seg
●

Ter
●

Qua
●

Qui
●

Sex
●

Sáb
○

Dom
●

Usar uma visualização semelhante a um calendário de hábitos.

--------------------------------------------------
6. INTERAÇÕES QUE GERAM PROGRESSO
--------------------------------------------------

O sistema deve registrar ações produtivas realizadas pelo usuário.

Exemplos:

Entrou no sistema:
+ XP diário

Criou uma anotação:
+ XP

Escreveu em um documento:
+ XP

Criou um post-it:
+ XP

Concluiu uma tarefa:
+ XP

Iniciou uma sessão de estudo:
+ XP

Concluiu uma sessão:
+ XP maior

Respondeu um questionário:
+ XP

Acertou uma questão:
+ XP adicional

Criou flashcards:
+ XP

Concluiu uma meta:
+ XP bônus

IMPORTANTE:

Não permitir exploração do sistema para ganhar XP infinitamente.

Por exemplo:

- Criar e apagar 100 post-its não deve gerar XP ilimitado.
- Editar repetidamente o mesmo documento não deve gerar XP a cada clique.
- Atualizações pequenas não devem gerar XP infinitamente.

Criar limites e regras para evitar farming de XP.

O objetivo é recompensar PRODUTIVIDADE REAL.

==================================================
7. SISTEMA DE XP
==================================================

Criar um sistema de experiência.

Exemplo:

Login diário:
+10 XP

Criar anotação:
+5 XP

Criar tarefa:
+5 XP

Concluir tarefa:
+15 XP

Sessão de estudo iniciada:
+10 XP

Sessão de estudo concluída:
+30 XP

Questionário concluído:
+20 XP

Bom desempenho no questionário:
+10 XP bônus

Meta diária concluída:
+25 XP

Sequência de 7 dias:
+100 XP bônus

Os valores devem ficar centralizados em uma configuração para que possam ser alterados posteriormente.

==================================================
8. RANKING / NÍVEIS
==================================================

Criar um sistema de níveis baseado no XP acumulado.

Exemplo:

Nível 1
🌱 Iniciante

Nível 2
📚 Estudante

Nível 3
🧠 Aprendiz

Nível 4
⚡ Dedicado

Nível 5
🔥 Focado

Nível 6
🏆 Avançado

Nível 7
💎 Especialista

Nível 8
🚀 Mestre

Nível 9
👑 Elite

Os nomes podem ser alterados posteriormente.

No perfil do usuário mostrar:

┌────────────────────────────────┐
│ 👤 Usuário                     │
│                                │
│ 🔥 Nível 4 — Dedicado          │
│                                │
│ 2.450 / 3.000 XP               │
│ ███████████████░░░              │
│                                │
│ 550 XP para o próximo nível    │
└────────────────────────────────┘

Quando subir de nível, apresentar uma animação/modal:

🎉 NOVO NÍVEL!

Você alcançou:

NÍVEL 5

🔥 Focado

+ novos desafios desbloqueados

==================================================
9. SEQUÊNCIA / STREAK
==================================================

Criar um sistema de sequência.

Exemplo:

🔥 12 dias

"Você está estudando há 12 dias consecutivos."

A sequência deve considerar atividade real.

O login diário conta para a sequência diária, porém atividades produtivas também devem ser consideradas para indicadores de produtividade.

Mostrar:

🔥 Sequência atual
12 dias

🏆 Recorde
21 dias

Evitar punir o usuário de forma exagerada.

Se ele perder um dia:

"Você perdeu sua sequência."

Mas não remover XP já conquistado.

==================================================
10. DESAFIOS
==================================================

Adicionar uma seção:

🏆 Desafios

Exemplos:

"Estude 3 dias seguidos"
+50 XP

"Estude 5 horas nesta semana"
+100 XP

"Complete 5 sessões de Pomodoro"
+75 XP

"Responda 20 questões"
+100 XP

"Estude uma matéria por 10 horas"
+200 XP

"Complete 7 dias consecutivos"
+250 XP

Os desafios devem possuir:

- progresso
- objetivo
- recompensa
- status
- data de conclusão

==================================================
11. DASHBOARD DE PRODUTIVIDADE
==================================================

Na Central de Estudos criar uma área:

📊 Meu progresso

Mostrar:

Tempo estudado esta semana:
12h 40min

Sessões:
18

Questões:
84

Tarefas concluídas:
27

Sequência:
7 dias

XP ganho:
540

Adicionar gráficos simples:

Horas estudadas por dia.

Exemplo:

SEG ███████
TER █████████
QUA ████
QUI ████████
SEX █████
SÁB ██
DOM ███████

Também mostrar:

"Matéria mais estudada"

📘 Banco de Dados

"Melhor dia"

🔥 Terça-feira — 3h20

==================================================
12. META DE ESTUDO PERSONALIZADA
==================================================

Permitir que o usuário configure uma meta.

Exemplo:

🎯 Meta semanal

Estudar:

[ 10 ] horas por semana

Progresso:

████████░░░░

7h 30min / 10h

Também permitir:

Meta diária:
60 minutos

Meta semanal:
8 horas

Meta mensal:
30 horas

==================================================
13. SISTEMA DE RECOMPENSAS
==================================================

Criar pequenas recompensas visuais.

Exemplos:

🏅 Primeira sessão de estudo

🔥 7 dias consecutivos

📚 10 horas estudadas

🧠 100 questões respondidas

🎯 10 metas concluídas

🚀 Nível 10

As conquistas devem aparecer no perfil do usuário.

==================================================
14. INTEGRAÇÃO COM O PINFAST EXISTENTE
==================================================

A Central de Estudos NÃO deve funcionar isoladamente.

Ela deve aproveitar os recursos existentes.

Integrar:

📌 Post-its
📅 Calendário
🔄 Rotina
📝 Questionários
📄 Documentos
📊 Planilhas
🎨 Quadro Branco
🗒️ Anotações
👥 Espaços colaborativos

Exemplo:

Um post-it:

"Estudar Banco de Dados"

pode possuir:

Matéria:
Banco de Dados

Data:
02/09/2026

Duração:
50 minutos

Ao clicar:

[ Estudar agora ]

Isso deve abrir o Pomodoro já configurado para aquela tarefa.

==================================================
15. NOVA ÁREA "MEU DESEMPENHO"
==================================================

No perfil do usuário adicionar:

Meu desempenho

Nível:
4

XP:
2.450

Sequência:
12 dias

Tempo total estudado:
86h 40min

Sessões:
143

Metas concluídas:
87

Questionários:
32

Taxa média de acertos:
82%

Mostrar também badges/conquistas.

==================================================
16. NOTIFICAÇÕES
==================================================

Adicionar notificações relacionadas aos estudos.

Exemplos:

🔔 "Você ainda não realizou sua meta de hoje."

🔔 "Sua sequência está em 6 dias."

🔔 "Sua próxima prova está em 3 dias."

🔔 "Você está a 30 minutos de completar sua meta semanal."

🔔 "Parabéns! Você subiu para o nível 5."

As notificações devem ser discretas e seguir o padrão visual existente.

==================================================
17. EXPERIÊNCIA DO USUÁRIO
==================================================

A funcionalidade deve transmitir:

- produtividade
- estudo
- evolução
- constância
- organização
- recompensa

Evitar transformar o sistema em um jogo exagerado.

A gamificação deve ser elegante e discreta.

O foco continua sendo:

ESTUDAR + ORGANIZAR + PRODUZIR.

==================================================
18. ESTRUTURA FINAL DA CENTRAL DE ESTUDOS
==================================================

Criar uma navegação interna:

📚 Central de Estudos

├── Visão geral
├── Minhas matérias
├── Sessão de estudo
├── Pomodoro
├── Metas
├── Desafios
├── Histórico
├── Desempenho
└── Conquistas

==================================================
19. REGRA PRINCIPAL
==================================================

O sistema deve transformar atividades reais do usuário em progresso.

Exemplo:

Usuário entra
↓
Meta diária registrada
↓
Cria tarefa
↓
+ XP
↓
Inicia estudo
↓
Pomodoro
↓
Conclui sessão
↓
+ XP
↓
Responde questionário
↓
+ XP
↓
Conclui meta
↓
+ bônus
↓
Atinge XP necessário
↓
Sobe de nível

O usuário deve conseguir visualizar claramente:

"O que eu fiz"
"Quanto eu estudei"
"Quanto evoluí"
"Qual é minha próxima meta"
"Quanto falta para subir de nível"

==================================================
20. DESIGN
==================================================

Manter exatamente a linguagem visual atual do PINFAST.

Usar:

- fundo creme/bege
- marrom escuro
- laranja como cor de destaque
- cards arredondados
- sombras suaves
- tipografia atual
- ícones simples
- componentes compactos
- bastante espaço em branco
- aparência de aplicativo de produtividade

Não criar uma interface gamer.

A gamificação deve utilizar elementos sutis como:

🔥
⭐
🏆
🎯
📚
⚡

O resultado deve parecer uma evolução natural do PINFAST.

Criar estados:

- vazio
- carregando
- progresso
- concluído
- nível aumentado
- meta perdida
- sequência ativa
- sequência quebrada

Utilizar dados mockados realistas para demonstrar todas as funcionalidades na interface.

IMPORTANTE:
Todas as funcionalidades devem ser visualmente navegáveis e demonstráveis no protótipo.
Os dados podem inicialmente ser mockados, mas a estrutura deve ser preparada de forma organizada para posteriormente conectar a um backend real.
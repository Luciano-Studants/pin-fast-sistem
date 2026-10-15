Crie uma aplicação web responsiva chamada **PINFAST**, baseada no conceito de um **quadro de avisos digital pessoal**, inspirado na simplicidade e praticidade de utilizar post-its físicos em uma parede.

Use como referência visual principal o wireframe de baixa fidelidade fornecido. O wireframe representa a estrutura geral da interface: uma barra lateral de áreas de trabalho, um grande quadro de avisos central, calendário/agenda, prazos ativos, anotações e acessos rápidos.

## 1. CONCEITO DO PRODUTO

O PINFAST deve ser uma ferramenta de organização visual voltada principalmente para:

* estudantes;
* profissionais;
* pessoas que trabalham com produção;
* pessoas que precisam controlar tarefas e prazos;
* equipes pequenas;
* usuários que precisam visualizar rapidamente o que precisam fazer.

A ideia central é:

> "Tudo o que você precisa lembrar, na sua frente."

O produto deve transmitir a sensação de pegar um post-it, escrever algo e simplesmente colocar em qualquer lugar do quadro.

Não transforme a interface em um clone do Trello, Jira, Monday ou Notion.

O diferencial do PINFAST é justamente a **liberdade visual**.

O usuário não deve ser obrigado a organizar tudo em listas, colunas ou cards estruturados.

Ele pode simplesmente:

1. criar um post-it;
2. escrever uma informação;
3. escolher uma cor;
4. posicionar o post-it livremente no quadro;
5. clicar nele quando quiser visualizar ou editar seus detalhes.

O quadro deve parecer um **quadro físico de avisos**, mas com recursos digitais inteligentes.

---

# 2. DIREÇÃO VISUAL

Utilize o wireframe fornecido como referência estrutural.

A interface deve combinar:

* quadro de avisos físico;
* post-its;
* calendário de mesa;
* agenda;
* mural de escritório;
* caderno de anotações;
* pequenas etiquetas;
* elementos de papel;
* sombras suaves;
* cantos arredondados;
* organização visual simples.

A estética deve ser:

* moderna;
* amigável;
* intuitiva;
* limpa;
* funcional;
* visualmente memorável;
* levemente inspirada em papelaria e escritório;
* sem aparência excessivamente corporativa.

O usuário deve olhar para a tela e imediatamente compreender:

"Esse é o meu quadro."

Evite excesso de gradientes, glassmorphism exagerado, cards genéricos de dashboard, tabelas administrativas e visual excessivamente tecnológico.

---

# 3. ESTRUTURA PRINCIPAL DA APLICAÇÃO

A tela principal deve possuir três grandes áreas:

### A. SIDEBAR

Barra lateral esquerda semelhante à navegação lateral do Notion.

Ela deve poder:

* expandir;
* recolher;
* permanecer fixa;
* mostrar ícones quando recolhida;
* mostrar ícones + nomes quando expandida.

A sidebar deve conter:

### PINFAST

No topo:

**PINFAST**

Utilizar uma identidade simples e marcante.

---

## ÁREAS DE TRABALHO

Exibir as áreas de trabalho criadas pelo usuário.

Exemplo:

* Faculdade
* Trabalho
* Projetos
* Pessoal
* Estudos

Cada área deve possuir um pequeno indicador visual/cor.

Adicionar botão:

**+ Nova área de trabalho**

Ao criar uma área:

* nome;
* descrição opcional;
* cor;
* ícone opcional.

---

## ESPAÇOS COLABORATIVOS

Criar uma segunda seção:

**ESPAÇOS COLAB**

Aqui aparecem espaços compartilhados com outras pessoas.

Exemplo:

* Projeto TCC
* Equipe Produção
* Grupo Faculdade
* Projeto Marketing

Permitir:

* criar espaço colaborativo;
* entrar em espaço existente;
* visualizar membros;
* compartilhar quadro.

Cada espaço deve possuir uma identificação visual diferente das áreas pessoais.

---

# 4. QUADRO PRINCIPAL

Essa é a parte mais importante do sistema.

Criar um grande espaço chamado:

**QUADRO DE AVISOS**

O quadro deve ocupar a maior parte da tela.

Visualmente deve lembrar:

* quadro de cortiça;
* quadro escolar;
* quadro branco;
* mural de escritório.

Pode utilizar textura extremamente sutil, desde que não prejudique a leitura.

O quadro deve permitir posicionamento livre.

O usuário pode criar um post-it e arrastá-lo para qualquer posição.

Não limitar os post-its a colunas.

Não utilizar estrutura Kanban.

---

# 5. POST-ITS

O elemento principal do PINFAST é o post-it.

O post-it padrão deve ser:

* quadrado;
* amarelo;
* simples;
* pequeno;
* com sombra;
* levemente arredondado;
* aparência de papel;
* visual semelhante a um post-it físico.

Exemplo:

[ POST-IT ]

"Entrega do trabalho"

O usuário pode arrastar livremente o post-it pelo quadro.

---

## CRIAÇÃO DE POST-IT

Adicionar botão:

**+ Novo post-it**

Ao clicar, abrir uma pequena interface de criação.

Campos:

### Título

Exemplo:

"Entregar atividade"

### Descrição

Campo opcional para informações adicionais.

### Data

Selecionar data do prazo.

### Hora

Selecionar horário.

### Cor

Permitir personalização completa.

O usuário pode:

* escolher cores pré-definidas;
* escolher uma cor personalizada;
* utilizar seletor RGB/HEX.

O post-it deve aceitar praticamente qualquer cor.

Entretanto, manter algumas cores rápidas:

* amarelo;
* vermelho;
* azul;
* verde;
* laranja;
* roxo;
* rosa;
* cinza.

---

# 6. INTERAÇÃO COM POST-IT

Ao clicar em um post-it, abrir uma visualização expandida.

Essa tela/modal deve mostrar:

### Título

Exemplo:

ENTREGAR TRABALHO DE ADS

### Descrição

"Finalizar documentação do projeto e enviar para o professor."

### DATA

29/08/2026

### HORA

23:59

### TEMPO RESTANTE

Exemplo:

**2 dias, 08 horas e 31 minutos**

Esse contador deve ser atualizado em tempo real.

Mostrar também status:

* Em andamento;
* Próximo do prazo;
* Prazo hoje;
* Atrasado;
* Concluído.

---

# 7. CONTROLE DE PRAZOS

O sistema deve identificar automaticamente a proximidade do prazo.

Exemplo:

Mais de 7 dias:

**Prazo distante**

Entre 3 e 7 dias:

**Prazo próximo**

Menos de 24 horas:

**Prazo crítico**

Prazo atingido:

**Prazo vencido**

Tarefa concluída:

**Concluído**

Utilizar alterações visuais sutis para chamar atenção.

O sistema também deve oferecer notificações visuais e auditivas.

---

# 8. TAREFAS CONCLUÍDAS

O quadro principal deve possuir uma divisão vertical.

Essa divisão deve ser feita por uma linha branca vertical.

### LADO ESQUERDO

**TAREFAS ATIVAS**

Aqui ficam os post-its pendentes.

### LADO DIREITO

**TAREFAS REALIZADAS**

Aqui ficam as tarefas concluídas.

O usuário pode concluir manualmente uma tarefa.

Quando uma tarefa for concluída:

* mover automaticamente para a área de tarefas realizadas;
* registrar data e hora da conclusão;
* manter a aparência do post-it;
* aplicar visual de tarefa concluída;
* opcionalmente utilizar efeito de transparência ou pequeno risco no texto.

O sistema também pode identificar automaticamente quando uma tarefa foi marcada como concluída pelo usuário.

Não apagar imediatamente a tarefa.

Ela deve permanecer registrada no histórico.

---

# 9. LIXEIRA

Em uma das extremidades do quadro deve existir uma pequena área:

**LIXEIRA**

Visualmente semelhante a uma pequena lixeira física.

O usuário poderá:

* arrastar um post-it para a lixeira;
* clicar em excluir;
* restaurar tarefas excluídas recentemente.

Ao arrastar um post-it sobre a lixeira:

* destacar visualmente a lixeira;
* mostrar indicação de que a tarefa será excluída.

---

# 10. CALENDÁRIO

Criar um calendário visual que lembre um **calendário de mesa físico**.

O calendário não deve parecer apenas um componente de calendário empresarial.

Ele deve possuir:

* aparência de papel;
* cabeçalho;
* mês;
* dias;
* pequenos marcadores;
* visual simples.

Exemplo:

**AGOSTO — 2026**

O dia atual deve ser claramente destacado com um círculo.

Exemplo:

**27**

deve estar circulado.

Dias anteriores devem apresentar uma pequena marca de "X", indicando que já passaram.

Dias com tarefas devem apresentar pequenos indicadores.

---

# 11. HISTÓRICO DOS DIAS

Essa funcionalidade é extremamente importante.

Quando o usuário clicar em um dia que já passou:

abrir uma visão daquele dia.

Exemplo:

**25 DE AGOSTO**

Mostrar:

### TAREFAS DO DIA

* Entregar relatório — concluída
* Reunião — concluída
* Estudar banco de dados — não concluída

Mostrar o que aconteceu naquele dia.

O sistema deve registrar:

* tarefas realizadas;
* tarefas não realizadas;
* anotações;
* horários;
* conclusão;
* prazos.

O calendário funciona como uma espécie de **linha do tempo pessoal**.

O usuário deve conseguir navegar para dias anteriores e consultar seu histórico.

---

# 12. AGENDA / ANOTAÇÕES

Criar uma área chamada:

**ANOTAÇÕES**

Ela deve lembrar uma agenda ou caderno físico.

Não utilizar simplesmente um textarea branco dentro de um card.

Criar aparência de:

* folha de agenda;
* papel;
* linhas sutis;
* pequenas divisões;
* notas coloridas.

Cada anotação pode possuir:

* texto;
* data de criação;
* hora;
* cor;
* título opcional.

Exemplo:

**27 AGO 2026**

"Conversar com João sobre o projeto."

As anotações devem preservar sua data.

---

# 13. ACESSOS RÁPIDOS

No lado direito do quadro criar uma área:

**ACESSOS RÁPIDOS**

Essa área funciona de maneira semelhante a um pequeno Linktree pessoal.

O usuário pode adicionar:

* sites;
* sistemas;
* documentos;
* redes sociais;
* ferramentas;
* links de trabalho;
* links de estudo.

Cada acesso deve possuir:

* nome;
* URL;
* ícone;
* cor opcional.

Exemplo:

▶ YouTube

◎ Instagram

✉ Gmail

＋ Adicionar acesso

Ao clicar, abrir o endereço correspondente.

Permitir reorganização dos links.

---

# 14. NOTIFICAÇÕES

O sistema deve possuir dois tipos de notificações:

### VISUAIS

Exemplos:

"Seu prazo vence amanhã."

"Você possui 3 tarefas vencendo hoje."

"Prazo vencido."

"Tarefa concluída."

Utilizar pequenos banners/toasts.

### AUDITIVAS

Permitir sons sutis para eventos importantes.

Exemplo:

* prazo próximo;
* prazo atingido;
* tarefa concluída;
* nova tarefa compartilhada.

Criar uma configuração para:

**Som das notificações: ON/OFF**

E volume.

Nunca utilizar sons agressivos ou constantes.

---

# 15. SISTEMA DE LOGIN

Criar uma tela de autenticação.

A identidade visual deve continuar utilizando a linguagem do PINFAST.

Tela de cadastro:

### Criar sua conta

Campos:

* Nome
* Sobrenome
* Nome de usuário
* E-mail
* Senha
* Confirmar senha

Botão:

**Criar conta**

Também criar tela de login:

### Bem-vindo de volta

Campos:

* E-mail ou nome de usuário
* Senha

Botão:

**Entrar**

Links:

* Esqueci minha senha
* Criar conta

A tela deve ser simples e não parecer um formulário empresarial genérico.

Pode utilizar uma ilustração de um quadro com pequenos post-its ao lado.

---

# 16. PERFIL DO USUÁRIO

Adicionar menu de perfil.

Ao clicar:

* Meu perfil
* Preferências
* Notificações
* Sons
* Aparência
* Gerenciar áreas
* Gerenciar espaços colaborativos
* Sair

---

# 17. PERSONALIZAÇÃO DO QUADRO

O usuário deve conseguir personalizar seu quadro.

Configurações:

### Aparência

* textura;
* fundo;
* tamanho dos post-its;
* densidade;
* sombras.

### Cores

Permitir personalizar:

* cor dos post-its;
* cor do quadro;
* cor das áreas;
* cor dos marcadores.

O objetivo é permitir que cada usuário transforme o PINFAST em seu próprio espaço.

---

# 18. COLABORAÇÃO

Os espaços colaborativos devem permitir múltiplas pessoas.

Um usuário pode:

* criar espaço;
* convidar pessoas;
* compartilhar quadro;
* adicionar post-its;
* mover post-its;
* concluir tarefas.

Mostrar pequenas fotos/avatares dos membros.

Cada alteração importante pode mostrar quem realizou a ação.

Exemplo:

"Lucas concluiu a tarefa às 14:32."

---

# 19. RESPONSIVIDADE

Criar versões:

### Desktop

Experiência completa com:

* sidebar;
* quadro;
* calendário;
* anotações;
* prazos;
* acessos rápidos.

### Tablet

Sidebar reduzida.

Elementos reorganizados.

### Mobile

Não simplesmente reduzir o desktop.

Criar uma experiência mobile própria.

No mobile:

* quadro ocupa a maior parte da tela;
* sidebar vira menu;
* calendário pode abrir como painel;
* acessos rápidos podem virar uma seção deslizável;
* criação de post-it deve ser extremamente rápida.

O princípio deve ser:

**abrir → escrever → colocar no quadro.**

---

# 20. EXPERIÊNCIA DE USO

Priorize a rapidez.

O usuário deve conseguir criar um post-it em poucos segundos.

Fluxo ideal:

1. clicar em "+";
2. escrever título;
3. opcionalmente adicionar prazo;
4. salvar;
5. post-it aparece no quadro;
6. usuário arrasta para a posição desejada.

Não obrigar o usuário a preencher diversos campos para criar uma tarefa simples.

A informação detalhada só aparece quando o post-it é aberto.

---

# 21. MICROINTERAÇÕES

Adicionar pequenas animações:

* post-it sendo criado;
* post-it sendo arrastado;
* post-it sendo colocado no quadro;
* abertura do detalhe;
* tarefa sendo concluída;
* movimento para área de concluídas;
* calendário mudando de mês;
* sidebar expandindo;
* toast aparecendo.

As animações devem ser rápidas e discretas.

O produto deve parecer físico, mas continuar sendo uma aplicação web moderna.

---

# 22. DASHBOARD NÃO TRADICIONAL

Não criar:

* gráficos financeiros;
* gráficos de produtividade excessivos;
* tabelas;
* KPI cards;
* dashboards corporativos;
* excesso de números.

A interface principal deve ser predominantemente visual.

O quadro é o centro do produto.

---

# 23. ESTRUTURA VISUAL INICIAL

Utilizar aproximadamente esta composição:

┌─────────────────────────────────────────────────────────────┐
│ PINFAST                                                     │
├──────────────┬──────────────────────────────────────────────┤
│              │ QUADRO DE AVISOS                             │
│ ÁREAS DE     │                                              │
│ TRABALHO     │   [POST-IT]       [POST-IT]                  │
│              │                                              │
│ Faculdade    │          [POST-IT]                           │
│ Trabalho     │                         [POST-IT]             │
│ Projetos     │                                              │
│              │──────────────────────┬───────────────────────│
│ ÁREAS        │ TAREFAS ATIVAS       │ TAREFAS REALIZADAS   │
│ COLLAB       │                      │                       │
│              │                      │                       │
│              ├──────────────────────┴───────────────────────│
│              │ CALENDÁRIO │ PRAZOS │ ANOTAÇÕES │ LINKS      │
└──────────────┴──────────────────────────────────────────────┘

Não precisa seguir exatamente essa distribuição.

Use o wireframe fornecido como referência de composição e transforme-o em uma interface profissional e funcional.

---

# 24. PRINCÍPIO DE DESIGN

O PINFAST deve parecer:

**"um quadro físico que ganhou inteligência digital."**

Não deve parecer:

**"um software empresarial que tenta imitar um quadro."**

Essa diferença é fundamental.

Preserve:

* post-its;
* liberdade de posicionamento;
* calendário físico;
* agenda;
* quadro;
* lixeira;
* acessos rápidos;
* tarefas concluídas;
* sensação de papelaria.

Mas acrescente:

* busca;
* edição;
* prazos;
* contador de tempo;
* histórico;
* colaboração;
* notificações;
* personalização;
* responsividade.

---

# 25. TELAS A SEREM GERADAS

Crie protótipos navegáveis das seguintes telas:

1. Login
2. Cadastro
3. Primeiro acesso / onboarding
4. Quadro principal
5. Quadro com post-it aberto
6. Criação de post-it
7. Edição de post-it
8. Calendário
9. Histórico de um dia passado
10. Anotações
11. Acessos rápidos
12. Áreas de trabalho
13. Espaço colaborativo
14. Gerenciamento de membros
15. Perfil
16. Configurações
17. Configurações de notificações
18. Configuração de aparência
19. Lixeira
20. Estado de tarefa concluída
21. Estado de prazo próximo
22. Estado de prazo vencido
23. Estado vazio do quadro
24. Versão mobile
25. Versão tablet

---

# 26. ESTADOS IMPORTANTES

Criar estados visuais para:

* quadro vazio;
* primeiro post-it;
* muitos post-its;
* prazo próximo;
* prazo vencido;
* tarefa concluída;
* tarefa excluída;
* calendário atual;
* calendário passado;
* notificação;
* colaboração;
* usuário sem áreas;
* usuário sem acessos rápidos.

---

# 27. ACESSIBILIDADE

Garantir:

* contraste adequado;
* textos legíveis;
* áreas de clique confortáveis;
* navegação por teclado;
* estados de foco;
* suporte a leitores de tela;
* não depender exclusivamente de cores para indicar status.

---

# 28. RESULTADO ESPERADO

Entregue uma interface visualmente refinada e navegável do PINFAST.

O resultado deve parecer um produto real pronto para ser apresentado como MVP.

Priorize:

**simplicidade + velocidade + liberdade + memória visual + organização.**

A experiência principal deve sempre voltar para o quadro.

Quando o usuário entrar no sistema, ele deve imediatamente visualizar:

**o que precisa fazer, o que está atrasado, o que já fez, que dia é hoje e quais informações precisa lembrar.**

O quadro não é apenas uma lista de tarefas.

**O quadro é o espaço pessoal de organização do usuário.**

Use o wireframe enviado como base estrutural e evolua-o para um produto de alta fidelidade, mantendo sua essência original.

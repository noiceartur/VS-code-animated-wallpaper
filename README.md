# Fundo Personagem

Extensão para o VS Code que coloca uma personagem animada como plano de fundo do editor. A fumaça do cigarro e a
piscada são animadas **só com CSS**, sem vídeo, canvas ou JavaScript rodando na janela. As cores continuam sendo as
do seu tema (feita para temas escuros, como o Dracula).

## Destaques técnicos

- **Animação quadro a quadro em CSS puro.** Os 7 desenhos da fumaça e as 5 poses da piscada foram extraídos de um
  vídeo e viraram PNGs de tela cheia. Uma única `@keyframes` com `steps(1, end)` mostra um quadro por vez, trocando o
  `background-size` de cada camada entre `0 0` e `100% 100%`.
- **Uma linha do tempo para duas animações.** A fumaça (20 passos, ciclo de 5 s) e a piscada (0,6 s) têm ritmos
  diferentes. `linhaDoTempo()` junta as duas num ciclo só, com um número inteiro de piscadas, para o loop fechar sem
  "pulo".
- **Sem desalinhamento de subpixel.** Personagem, fumaça e olhos são fundos do mesmo elemento (`body::before`), com o
  mesmo tamanho e posição. Assim, as camadas ficam alinhadas pixel a pixel em qualquer zoom ou escala do Windows.
- **Mistura com `screen`.** O preto da arte não altera o tema, então não é preciso recortar o fundo. A opacidade é
  aplicada uma vez só, no conjunto.
- **Volta sozinha depois de cada atualização do VS Code.** Veja [abaixo](#por-que-a-janela-recarrega-sozinha).
- **Config seguro.** Os valores do `fundo.config.json` passam por validação antes de entrar no CSS, para que um valor
  errado não quebre a interface do VS Code.

## Como funciona

O VS Code não tem API para imagem de fundo. Por isso, a extensão grava um bloco de CSS, entre
`/* FUNDO-PERSONAGEM:INICIO */` e `/* FUNDO-PERSONAGEM:FIM */`, no arquivo `workbench.desktop.main.css` da instalação
do VS Code. Antes, guarda um backup do original. As imagens entram no CSS como *data URI*, então não dependem de
`file://`.

### Por que a janela recarrega sozinha

Temas como o Dracula usam a API de temas, que o VS Code lê a cada inicialização. Este fundo, não: ele fica dentro de um
arquivo do próprio VS Code, que é substituído a cada atualização. Além disso, a janela lê esse CSS **antes** de as
extensões rodarem.

Por isso, a extensão é ativada logo na inicialização (`"activationEvents": ["*"]`). Se o bloco sumiu, ela reaplica. Se
o CSS em disco é mais novo do que o que a janela carregou, ela recarrega a janela uma vez, sem perguntar. O resultado é
o fundo aparecer já na primeira abertura depois de uma atualização, com uma piscada rápida da janela. Uma marca por
janela (`workspaceState`) impede que ela recarregue em loop. Isso também vale para várias janelas restauradas ao mesmo
tempo.

## Instalar

1. Baixe o `.vsix` da página de *Releases* ou gere o seu (veja [Desenvolvimento](#desenvolvimento)).
2. No VS Code: **Extensions** → `...` → **Install from VSIX...**
3. A janela recarrega sozinha e o fundo aparece.

> O VS Code vai avisar que a instalação parece "corrompida" e pode mostrar `[Unsupported]` no título. Isso acontece
> porque o CSS dele foi alterado. Pode dispensar o aviso. Para desfazer tudo, use **Fundo Personagem: Remover fundo**.

Se a extensão não tiver permissão para gravar na pasta do VS Code (instalação "System"), abra o VS Code como
administrador uma vez ou use a instalação "User".

## Comandos

| Comando (Ctrl+Shift+P)                     | O que faz                                                |
| ------------------------------------------ | -------------------------------------------------------- |
| `Fundo Personagem: Abrir config`           | Abre o `fundo.config.json`. Salvar reaplica o fundo.     |
| `Fundo Personagem: Abrir pasta de imagens` | Mostra a pasta com o config e as imagens.                |
| `Fundo Personagem: Aplicar`                | Reaplica, por exemplo depois de trocar uma imagem.       |
| `Fundo Personagem: Remover fundo`          | Restaura o CSS original e deixa `"ativo": false`.        |

## Configuração (`fundo.config.json`)

Todas as chaves são opcionais. O que não estiver no arquivo usa o padrão.

```json
{
  "ativo": true,
  "imagem": "personagem.png",
  "opacidade": 0.15,
  "altura": "95vh",
  "direita": "0px",
  "baixo": "0px",
  "zIndex": 50,
  "fumaca": { "ativo": true, "arquivo": "fumaca.json", "velocidade": 1 },
  "piscar": { "ativo": true, "arquivo": "olhos.json", "intervalo": 2.5 }
}
```

- `opacidade`: de 0 a 1.
- `altura`: tamanho da arte na janela. A largura acompanha a proporção da imagem.
- `direita` e `baixo`: margens.
- `fumaca.velocidade`: 1 é o ritmo do vídeo, 0.5 a metade e 2 o dobro.
- `piscar.intervalo`: segundos entre piscadas. O valor é ajustado para caber um número inteiro de piscadas no ciclo da
  fumaça.
- Os caminhos de imagem podem ser relativos à pasta do config ou absolutos.

## Imagens

Todas usam o mesmo canvas (1610×1080).

| Arquivo                         | Conteúdo                                                                   |
| ------------------------------- | -------------------------------------------------------------------------- |
| `imagens/personagem.png`        | A arte inteira, com os olhos abertos e **sem fumaça**                      |
| `imagens/olho-1..5.png`         | As 5 poses da piscada (transparentes fora da região dos olhos)             |
| `imagens/fumaca-1..7.png`       | Os 7 desenhos da fumaça, com o esmaecimento salvo no canal alfa            |
| `imagens/olhos.json`            | Poses da piscada e duração de cada uma (`passos`: `[pose, segundos]`)       |
| `imagens/fumaca.json`           | Desenhos da fumaça e a ordem e duração de cada um (20 passos, 5 s)          |

Para usar outra animação, troque as imagens e edite o `.json` correspondente. Quando as imagens que vêm com a extensão
mudam, a cópia antiga do usuário vai para `anteriores-<versão>/`.

## Desenvolvimento

Requer Node.js 18 ou mais novo. Não há dependências de runtime.

```bash
npm test          # testes das funções de CSS e da extensão com um VS Code simulado
npm run package   # gera fundo-personagem-<versão>.vsix com o vsce oficial
```

Estrutura:

```
extension.js        ativação, cópia das imagens, injeção/remoção do CSS, recarga automática, comandos
src/css.js          geração do bloco CSS, linha do tempo da animação, validação do config
imagens/            arte e quadros da animação
teste/              testes (node, sem framework)
```

Os testes de `teste/extensao.test.js` simulam a primeira instalação, a atualização do VS Code, várias janelas abertas,
config com erro e falta de permissão.

## Créditos

Arte e animação originais: **The Muun**, no vídeo
[youtube.com/watch?v=93Sfl5rRBGw](https://www.youtube.com/watch?v=93Sfl5rRBGw). As imagens em `imagens/` e o ícone em
`midia/` foram feitos a partir desse vídeo e são usados com a autorização do autor.

## Licença

O código está sob a licença [MIT](LICENSE). A arte (pastas `imagens/` e `midia/`) pertence a The Muun e **não** está
incluída nessa licença: não reutilize as imagens sem a autorização do autor.

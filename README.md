# SAMUCA GAMES — CORRE, SAMUCA!

Endless runner 2D em pixel art 16-bit: o Samuca corre pelas ruas de São Paulo (Av. Paulista com o MASP, Centro com o Copan, Vila Madalena com grafites), pula obstáculos, dá rasteira por baixo de placas e pega moedas.

**Jogar:** https://themikesandes-cell.github.io/Samuca-games-/

## Controles

| | Celular | Computador |
|---|---|---|
| Pular | toque rápido (ou deslizar para cima) | Espaço / ↑ |
| Rasteira | segurar o dedo (ou deslizar para baixo) | ↓ (enquanto segurar) |
| Jogar / reiniciar | botão JOGAR | Enter |
| Pausa | botão ❚❚ | P / Esc |

## Desenvolvimento

```bash
npm install
npm run dev      # servidor local
npm run build    # build de produção em dist/
npm run art      # regenera o atlas do Samuca e a arte do cenário (Python 3 + Pillow, numpy, scipy)
```

## Estrutura

```
web/index.html            página do jogo (fonte)
web/src/game/             motor do jogo (Phaser 3)
  config.ts               todos os números de jogabilidade (física, velocidade, hitboxes)
  assets.ts               manifesto de imagens, animações e obstáculos
  scenes/RunScene.ts      corrida, parallax, colisões, efeitos
  systems/Player.ts       física do Samuca (passo fixo de 1/120 s, coyote time, buffer de pulo)
  systems/Spawner.ts      geração procedural justa de obstáculos e moedas
  systems/Audio.ts        efeitos e música chiptune via Web Audio API
web/src/ui/               interface em React (menu, HUD, pausa, game over)
web/public/assets/        sprites e cenários (PNG) — troque um arquivo pelo mesmo nome para mudar a arte
reference/                sprite sheet original do Samuca
tools/extract.py          recorta o sprite sheet, remove fundo/sombra e monta o atlas samuca.png/json
tools/art.py              desenha o cenário de São Paulo, obstáculos e moedas em pixel art
tools/smoke_test.py       teste automático no navegador (toque, pausa, game over, console sem erros)
legacy/                   protótipo anterior (mantido)
```

## Publicação

O GitHub Pages deste repositório está em "Deploy from a branch → main / (root)".
A cada push que altera o código, o workflow `.github/workflows/deploy.yml` faz o build e grava o resultado
na raiz da branch `main` (`index.html`, `assets/` …), que o Pages publica automaticamente.
Esses arquivos da raiz são gerados — edite sempre o que está em `web/`.

Modo de teste: `?bot=1&warp=4` no endereço liga um piloto automático que joga com a latência do toque,
usado para conferir que nenhuma sequência de obstáculos é impossível.

'use strict';

// Marcadores do bloco injetado no CSS do VS Code (permitem remover/atualizar com segurança)
const INI = '/* FUNDO-PERSONAGEM:INICIO */';
const FIM = '/* FUNDO-PERSONAGEM:FIM */';

// Valores padrão. Tudo aqui pode ser sobrescrito no fundo.config.json
const PADRAO = {
  ativo: true,
  imagem: 'personagem.png', // relativa à pasta do config, ou caminho absoluto
  opacidade: 0.15, // 0 a 1
  altura: '95vh', // altura da arte na janela (a largura segue a proporção da imagem)
  direita: '0px', // distância da borda direita
  baixo: '0px', // distância da borda de baixo
  zIndex: 50,
  fumaca: {
    ativo: true,
    arquivo: 'fumaca.json', // lista os desenhos da fumaça e quanto tempo cada um dura
    velocidade: 1 // 1 = ritmo do vídeo; 0.5 = metade; 2 = o dobro
  },
  piscar: {
    ativo: true,
    arquivo: 'olhos.json', // lista as poses da piscada e quanto tempo cada uma dura
    intervalo: 2.5 // segundos entre piscadas (ajustado para caber um número inteiro de piscadas no ciclo da fumaça)
  }
};

function ehObjeto(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Mescla o config do usuário por cima do padrão (recursivo)
function mesclar(base, extra) {
  const saida = {};
  for (const k of Object.keys(base)) {
    if (ehObjeto(base[k])) saida[k] = mesclar(base[k], ehObjeto(extra && extra[k]) ? extra[k] : {});
    else saida[k] = extra && extra[k] !== undefined ? extra[k] : base[k];
  }
  return saida;
}

function num(v, min, max, padrao) {
  const n = Number(v);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

// Aceita só caracteres seguros para valores CSS vindos do config (evita quebrar o CSS do VS Code)
function seguro(v, padrao) {
  return typeof v === 'string' && /^[a-z0-9%.\s-]+$/i.test(v.trim()) ? v.trim() : padrao;
}

function fmt(n, casas = 2) {
  return Number(n.toFixed(casas));
}

// Confere um .json de camada animada (fumaca.json / olhos.json): canvas, lista de imagens ("poses") e
// "passos" ([indiceDaPose, segundos]). Devolve texto de erro, ou null se estiver ok.
function erroMetaPoses(meta) {
  const ehNum = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!ehObjeto(meta)) return 'metadados ausentes';
  const { canvas, poses, passos } = meta;
  if (!Array.isArray(canvas) || canvas.length !== 2 || !canvas.every((v) => ehNum(v) && v > 0)) return 'canvas inválido';
  if (!Array.isArray(poses) || poses.length < 1 || poses.length > 12) return 'poses deve ter de 1 a 12 imagens';
  if (!poses.every((f) => typeof f === 'string' && /^[\w .-]+\.(png|webp)$/i.test(f) && !f.includes('..'))) {
    return 'nome de pose inválido (use só o nome do arquivo, .png ou .webp, na mesma pasta)';
  }
  if (!Array.isArray(passos) || passos.length === 0 || passos.length > 100) return 'passos inválidos';
  for (const p of passos) {
    if (!Array.isArray(p) || p.length !== 2 || !Number.isInteger(p[0]) || p[0] < 0 || p[0] >= poses.length || !ehNum(p[1]) || p[1] <= 0) {
      return 'passo inválido (use [indiceDaPose, segundos])';
    }
  }
  return null;
}

// Camada animada utilizável? (imagens carregadas na mesma quantidade das poses do .json)
function camadaOk(camada, ativo, base) {
  return !!(base && camada && ativo && !erroMetaPoses(camada.meta) && Array.isArray(camada.poses) && camada.poses.length === camada.meta.poses.length);
}

// Linha do tempo única de um ciclo: fumaça (ciclo próprio) + piscadas, que se repetem dentro do ciclo.
// Devolve { ciclo, estados: [{ini, fumaca, olhos}] } com ini em segundos; -1 = nenhuma pose visível.
function linhaDoTempo(c, fumaca, olhos) {
  const vel = num(c.fumaca.velocidade, 0.05, 20, 1);
  let ciclo = 0;
  const evF = []; // [ini, fim, pose]
  if (fumaca) {
    let t = 0;
    for (const [i, d] of fumaca.meta.passos) {
      evF.push([t, t + d / vel, i]);
      t += d / vel;
    }
    ciclo = t;
  }
  const evO = [];
  if (olhos) {
    const piscada = olhos.meta.passos.reduce((s, p) => s + p[1], 0);
    const inter0 = Math.max(num(c.piscar.intervalo, 0.5, 120, 2.5), piscada + 0.2);
    if (!ciclo) ciclo = inter0;
    // um número inteiro de piscadas por ciclo, para o loop fechar sem "pulo"
    let n = Math.max(1, Math.round(ciclo / inter0));
    if (ciclo / n < piscada + 0.1) n = Math.max(1, Math.floor(ciclo / (piscada + 0.2)));
    const inter = ciclo / n;
    for (let j = 0; j < n; j++) {
      let t = (j + 1) * inter - piscada;
      for (const [i, d] of olhos.meta.passos) {
        if (t < ciclo) evO.push([Math.max(t, 0), Math.min(t + d, ciclo), i]);
        t += d;
      }
    }
  }
  const pontos = new Set([0]);
  for (const [a, b] of [...evF, ...evO]) {
    pontos.add(fmt(a, 4));
    pontos.add(fmt(b, 4));
  }
  const ts = [...pontos].filter((t) => t < ciclo - 1e-6).sort((a, b) => a - b);
  const em = (ev, t) => {
    const e = ev.find(([a, b]) => t >= a - 1e-9 && t < b - 1e-9);
    return e ? e[2] : -1;
  };
  const estados = [];
  for (let k = 0; k < ts.length; k++) {
    const meio = (ts[k] + (k + 1 < ts.length ? ts[k + 1] : ciclo)) / 2;
    const est = { ini: ts[k], fumaca: em(evF, meio), olhos: em(evO, meio) };
    const ant = estados[estados.length - 1];
    if (!ant || ant.fumaca !== est.fumaca || ant.olhos !== est.olhos) estados.push(est);
  }
  return { ciclo, estados };
}

// camadas: { base: dataUri, fumaca: { poses: [dataUri...], meta }, olhos: { poses: [dataUri...], meta } }
// (camadas ausentes = null). proporcao: largura / altura da imagem principal.
function gerarBloco(cfgBruto, camadas, proporcao) {
  const c = mesclar(PADRAO, cfgBruto || {});
  const opac = num(c.opacidade, 0, 1, PADRAO.opacidade);
  const z = Math.round(num(c.zIndex, 0, 2000, PADRAO.zIndex));
  const prop = num(proporcao, 0.2, 10, 1610 / 1080);
  const alt = seguro(c.altura, PADRAO.altura);
  const dir = seguro(c.direita, PADRAO.direita);
  const baixo = seguro(c.baixo, PADRAO.baixo);

  const partes = [INI];
  partes.push(`html { --fp-opacidade: ${opac}; --fp-h: ${alt}; --fp-dir: ${dir}; --fp-baixo: ${baixo}; }`);

  if (camadas.base) {
    // Personagem, poses da piscada e desenhos da fumaça são fundos do MESMO elemento e têm exatamente o mesmo
    // tamanho e posição (imagens de tela cheia). O navegador as mapeia pixel a pixel igual, sem deslocamento de
    // subpixel, em qualquer zoom ou escala do Windows. Cada desenho da fumaça (que passa por cima da pele, até a
    // brasa) SUBSTITUI o que está embaixo antes de o conjunto ser misturado, e a opacidade vale uma vez só.
    // Tudo é misturado com "screen": o preto da imagem não altera nada, então não precisa de recorte por transparência.
    const fum = camadaOk(camadas.fumaca, c.fumaca.ativo, camadas.base) ? camadas.fumaca : null;
    const olh = camadaOk(camadas.olhos, c.piscar.ativo, camadas.base) ? camadas.olhos : null;
    const nO = olh ? olh.poses.length : 0;
    const nF = fum ? fum.poses.length : 0;
    // ordem da pilha (o primeiro fica por cima): poses dos olhos, desenhos da fumaça, personagem
    const imagens = [...(olh ? olh.poses : []), ...(fum ? fum.poses : []), camadas.base].map((u) => `url("${u}")`);
    const tamanhos = (e, f) =>
      [
        ...Array.from({ length: nO }, (_, i) => (i === e ? '100% 100%' : '0 0')),
        ...Array.from({ length: nF }, (_, i) => (i === f ? '100% 100%' : '0 0')),
        '100% 100%'
      ].join(', ');
    let anim = null;
    if (fum || olh) {
      const { ciclo, estados } = linhaDoTempo(c, fum, olh);
      const kf = estados.map((s) => `  ${fmt((s.ini / ciclo) * 100, 3)}% { background-size: ${tamanhos(s.olhos, s.fumaca)}; }`);
      kf.push(`  100% { background-size: ${tamanhos(estados[0].olhos, estados[0].fumaca)}; }`);
      anim = { ciclo, inicial: tamanhos(estados[0].olhos, estados[0].fumaca), keyframes: `@keyframes fp-anim {\n${kf.join('\n')}\n}` };
    }
    partes.push(`body::before {
  content: '';
  position: fixed;
  pointer-events: none;
  z-index: ${z};
  opacity: var(--fp-opacidade);
  mix-blend-mode: screen;
  right: var(--fp-dir);
  bottom: var(--fp-baixo);
  height: var(--fp-h);
  aspect-ratio: ${fmt(prop * 1000)} / 1000;
  background-repeat: no-repeat;
  background-image: ${imagens.join(', ')};
  background-position: ${new Array(imagens.length).fill('center').join(', ')};
  background-size: ${anim ? anim.inicial : '100% 100%'};${anim ? `
  animation: fp-anim ${fmt(anim.ciclo, 3)}s steps(1, end) infinite;` : ''}
}`);
    if (anim) {
      partes.push(anim.keyframes);
      partes.push(`@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
}`);
    }
  }

  partes.push(FIM);
  return partes.join('\n');
}

function temBloco(css) {
  return css.includes(INI) && css.includes(FIM);
}

function removerBloco(css) {
  let i;
  while ((i = css.indexOf(INI)) !== -1) {
    const f = css.indexOf(FIM, i);
    const antes = css.slice(0, i).replace(/\n+$/, '\n');
    if (f === -1) return antes; // bloco quebrado: o bloco é sempre o último, então corta até o fim
    css = antes + css.slice(f + FIM.length).replace(/^\n/, '');
  }
  return css;
}

module.exports = { INI, FIM, PADRAO, mesclar, erroMetaPoses, linhaDoTempo, gerarBloco, temBloco, removerBloco };

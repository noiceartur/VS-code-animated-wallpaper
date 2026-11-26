'use strict';

// Testes das funções puras de src/css.js. Rodar com: node teste/css.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { INI, FIM, PADRAO, mesclar, erroMetaPoses, linhaDoTempo, gerarBloco, temBloco, removerBloco } = require('../src/css');

const IMAGENS = path.join(__dirname, '..', 'imagens');
const lerJson = (n) => JSON.parse(fs.readFileSync(path.join(IMAGENS, n), 'utf8'));

let falhas = 0;
function teste(nome, fn) {
  try {
    fn();
    console.log('ok   ' + nome);
  } catch (e) {
    falhas++;
    console.log('FALHA ' + nome + '\n      ' + e.message);
  }
}

const fumacaMeta = lerJson('fumaca.json');
const olhosMeta = lerJson('olhos.json');
const camadaFalsa = (meta) => ({ meta, poses: meta.poses.map((_, i) => `data:image/png;base64,P${i}`) });
const camadas = { base: 'data:image/png;base64,BASE', fumaca: camadaFalsa(fumacaMeta), olhos: camadaFalsa(olhosMeta) };

teste('os .json que vêm com a extensão são válidos', () => {
  assert.strictEqual(erroMetaPoses(fumacaMeta), null);
  assert.strictEqual(erroMetaPoses(olhosMeta), null);
});

teste('erroMetaPoses recusa nomes de arquivo fora da pasta', () => {
  assert.ok(erroMetaPoses({ ...olhosMeta, poses: ['../x.png', 'a.png', 'b.png', 'c.png', 'd.png'] }));
  assert.ok(erroMetaPoses({ ...olhosMeta, passos: [[9, 0.1]] }));
});

teste('mesclar usa o padrão e ignora chaves desconhecidas', () => {
  const c = mesclar(PADRAO, { opacidade: 0.2, mascara: 'antiga', fumaca: { velocidade: 2 } });
  assert.strictEqual(c.opacidade, 0.2);
  assert.strictEqual(c.mascara, undefined);
  assert.strictEqual(c.fumaca.velocidade, 2);
  assert.strictEqual(c.fumaca.arquivo, 'fumaca.json');
  assert.strictEqual(c.piscar.intervalo, 2.5);
});

teste('linha do tempo: ciclo de 5 s com duas piscadas', () => {
  const { ciclo, estados } = linhaDoTempo(PADRAO, camadas.fumaca, camadas.olhos);
  assert.ok(Math.abs(ciclo - 5) < 1e-9, 'ciclo = ' + ciclo);
  assert.strictEqual(estados[0].ini, 0);
  const comOlho = estados.filter((e, i) => e.olhos === 0 && (i === 0 || estados[i - 1].olhos === -1));
  assert.strictEqual(comOlho.length, 2, 'piscadas no ciclo');
  for (let i = 1; i < estados.length; i++) assert.ok(estados[i].ini > estados[i - 1].ini);
});

teste('gerarBloco tem marcadores, uma camada por imagem e a animação', () => {
  const bloco = gerarBloco(PADRAO, camadas, 1610 / 1080);
  assert.ok(bloco.startsWith(INI) && bloco.endsWith(FIM));
  assert.strictEqual((bloco.match(/url\("/g) || []).length, 1 + 7 + 5);
  assert.ok(/animation: fp-anim 5s steps\(1, end\) infinite;/.test(bloco));
  assert.ok(bloco.includes('prefers-reduced-motion'));
  assert.ok(bloco.includes('--fp-opacidade: 0.15'));
});

teste('valores perigosos do config não entram no CSS', () => {
  const bloco = gerarBloco({ altura: '1px; } body { display: none', opacidade: 9 }, camadas, 1.5);
  assert.ok(!bloco.includes('display: none'));
  assert.ok(bloco.includes('--fp-h: 95vh'));
  assert.ok(bloco.includes('--fp-opacidade: 1;'));
});

teste('sem fumaça e sem piscada: imagem parada, sem keyframes', () => {
  const bloco = gerarBloco({ fumaca: { ativo: false }, piscar: { ativo: false } }, camadas, 1.5);
  assert.strictEqual((bloco.match(/url\("/g) || []).length, 1);
  assert.ok(!bloco.includes('@keyframes'));
});

teste('removerBloco devolve o CSS original', () => {
  const original = '.a{color:red}\n.b{color:blue}\n';
  const comBloco = original + '\n' + gerarBloco(PADRAO, camadas, 1.5) + '\n';
  assert.ok(temBloco(comBloco));
  assert.ok(!temBloco(original));
  assert.strictEqual(removerBloco(comBloco), original);
  assert.strictEqual(removerBloco(original + INI + '\nquebrado'), original);
});

if (falhas) {
  console.log(`\n${falhas} teste(s) falharam`);
  process.exit(1);
}
console.log('\ncss: todos os testes passaram');

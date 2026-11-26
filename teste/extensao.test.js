'use strict';

// Testes de integração do extension.js com um VS Code simulado (mock do módulo "vscode").
// Simulam abrir o VS Code, atualizar o VS Code, recarregar a janela e abrir várias janelas.
// Rodar com: node teste/extensao.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const RAIZ = path.join(__dirname, '..');
const CSS_ORIGINAL = '.monaco-workbench { color: white; }\n';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fundo-personagem-teste-'));
const appRoot = path.join(tmp, 'vscode');
const arquivoCss = path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.css');
const pastaDados = path.join(tmp, 'dados');

// --- VS Code simulado ---------------------------------------------------------------------
let registro; // o que a extensão pediu ao VS Code nesta "janela"
const vscodeFalso = {
  version: '1.99.0',
  env: { appRoot },
  Uri: { file: (p) => ({ fsPath: p }) },
  window: {
    showWarningMessage: (m) => registro.avisos.push(m),
    showErrorMessage: (m) => registro.erros.push(m),
    showInformationMessage: async (m) => {
      registro.infos.push(m);
      return undefined;
    }
  },
  commands: {
    registerCommand: (id, fn) => {
      registro.comandos[id] = fn;
      return { dispose() {} };
    },
    executeCommand: async (id) => {
      registro.executados.push(id);
    }
  },
  workspace: {
    onDidSaveTextDocument: () => ({ dispose() {} }),
    openTextDocument: async (p) => ({ uri: { fsPath: p } })
  }
};
const carregarOriginal = Module._load;
Module._load = function (pedido, ...resto) {
  return pedido === 'vscode' ? vscodeFalso : carregarOriginal.call(this, pedido, ...resto);
};

// Memória de uma janela (workspaceState sobrevive ao recarregar a mesma janela)
const novaMemoria = () => {
  const m = new Map();
  return { get: (k) => m.get(k), update: async (k, v) => void m.set(k, v) };
};

// Abre uma "janela": o host de extensões começou há `hostHaMs` ms (a janela leu o CSS um pouco antes disso).
async function abrirJanela(memoria, hostHaMs = 300) {
  registro = { avisos: [], erros: [], infos: [], comandos: {}, executados: [] };
  const uptimeOriginal = process.uptime;
  process.uptime = () => hostHaMs / 1000;
  try {
    delete require.cache[require.resolve(path.join(RAIZ, 'extension.js'))];
    const ext = require(path.join(RAIZ, 'extension.js'));
    await ext.activate({ globalStorageUri: { fsPath: pastaDados }, extensionPath: RAIZ, subscriptions: [], workspaceState: memoria });
  } finally {
    process.uptime = uptimeOriginal;
  }
  return registro;
}

const recarregou = (r) => r.executados.filter((c) => c === 'workbench.action.reloadWindow').length;
const lerCss = () => fs.readFileSync(arquivoCss, 'utf8');
const envelhecerCss = (msAtras) => {
  const t = new Date(Date.now() - msAtras);
  fs.utimesSync(arquivoCss, t, t);
};
// "Atualizar o VS Code": o CSS volta ao original, gravado na instalação (antes de a janela abrir)
const atualizarVsCode = () => {
  fs.writeFileSync(arquivoCss, CSS_ORIGINAL);
  envelhecerCss(60 * 60 * 1000);
};
const config = () => JSON.parse(fs.readFileSync(path.join(pastaDados, 'fundo.config.json'), 'utf8'));
const salvarConfig = (c) => fs.writeFileSync(path.join(pastaDados, 'fundo.config.json'), JSON.stringify(c));

// --- Testes ---------------------------------------------------------------------------------
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

teste('primeira abertura: copia imagens, aplica o fundo e recarrega sozinha uma vez', async () => {
  fs.mkdirSync(path.dirname(arquivoCss), { recursive: true });
  atualizarVsCode();
  const janela = novaMemoria();
  const r = await abrirJanela(janela);
  assert.deepStrictEqual(r.erros, []);
  assert.ok(fs.existsSync(path.join(pastaDados, 'personagem.png')));
  assert.ok(fs.existsSync(path.join(pastaDados, 'fundo.config.json')));
  assert.ok(lerCss().includes('/* FUNDO-PERSONAGEM:INICIO */'));
  assert.ok(lerCss().startsWith(CSS_ORIGINAL));
  assert.strictEqual(recarregou(r), 1, 'recarregar a janela');
  assert.deepStrictEqual(r.infos, [], 'não deve perguntar nada');

  // depois de recarregar, a mesma janela já tem o fundo: não recarrega de novo (sem loop)
  const r2 = await abrirJanela(janela, 300);
  assert.strictEqual(recarregou(r2), 0);
  assert.deepStrictEqual(r2.erros, []);
});

teste('abrir o VS Code normalmente (fundo já aplicado): não reescreve nem recarrega', async () => {
  envelhecerCss(10 * 60 * 1000);
  const antes = fs.statSync(arquivoCss).mtimeMs;
  const r = await abrirJanela(novaMemoria());
  assert.strictEqual(recarregou(r), 0);
  assert.strictEqual(fs.statSync(arquivoCss).mtimeMs, antes);
});

teste('depois de atualizar o VS Code: reaplica e recarrega na PRIMEIRA abertura', async () => {
  atualizarVsCode();
  const janela = novaMemoria();
  const r = await abrirJanela(janela);
  assert.ok(lerCss().includes('/* FUNDO-PERSONAGEM:INICIO */'));
  assert.strictEqual(recarregou(r), 1);
  // a janela recarregada abre com o fundo e fica quieta
  assert.strictEqual(recarregou(await abrirJanela(janela)), 0);
});

teste('várias janelas restauradas após a atualização: cada uma recarrega uma vez', async () => {
  atualizarVsCode();
  const a = novaMemoria();
  const b = novaMemoria();
  const ra = await abrirJanela(a); // a janela A reaplica o CSS
  const rb = await abrirJanela(b, 400); // a B abriu junto, leu o CSS antigo, mas encontra o bloco já aplicado
  assert.strictEqual(recarregou(ra), 1);
  assert.strictEqual(recarregou(rb), 1, 'a janela B também precisa recarregar');
  assert.strictEqual(recarregou(await abrirJanela(a)), 0);
  assert.strictEqual(recarregou(await abrirJanela(b)), 0);
});

teste('janela aberta muito depois da última gravação do CSS: não recarrega', async () => {
  envelhecerCss(30 * 1000);
  const r = await abrirJanela(novaMemoria(), 300);
  assert.strictEqual(recarregou(r), 0);
});

teste('fundo desligado ("ativo": false): não aplica nem recarrega', async () => {
  salvarConfig({ ...config(), ativo: false });
  atualizarVsCode();
  const r = await abrirJanela(novaMemoria());
  assert.strictEqual(recarregou(r), 0);
  assert.strictEqual(lerCss(), CSS_ORIGINAL);
  salvarConfig({ ...config(), ativo: true });
});

teste('config com erro de sintaxe: não trava a inicialização nem recarrega', async () => {
  const p = path.join(pastaDados, 'fundo.config.json');
  const bom = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, '{ "opacidade": 0.2, ');
  atualizarVsCode();
  const r = await abrirJanela(novaMemoria());
  assert.strictEqual(recarregou(r), 0);
  assert.strictEqual(lerCss(), CSS_ORIGINAL);
  fs.writeFileSync(p, bom);
});

teste('sem permissão para escrever o CSS: mostra erro e não recarrega', async () => {
  atualizarVsCode();
  const escreverOriginal = fs.writeFileSync;
  fs.writeFileSync = function (alvo, ...resto) {
    if (String(alvo).startsWith(appRoot)) throw Object.assign(new Error('negado'), { code: 'EPERM' });
    return escreverOriginal.call(this, alvo, ...resto);
  };
  let r;
  try {
    r = await abrirJanela(novaMemoria());
  } finally {
    fs.writeFileSync = escreverOriginal;
  }
  assert.strictEqual(recarregou(r), 0);
  assert.strictEqual(r.erros.length, 1);
  assert.ok(/permissão/.test(r.erros[0]));
});

teste('comandos Aplicar e Remover continuam perguntando antes de recarregar', async () => {
  atualizarVsCode();
  const r = await abrirJanela(novaMemoria());
  r.executados.length = 0;
  await r.comandos['fundoPersonagem.remover']();
  assert.strictEqual(config().ativo, false);
  assert.strictEqual(lerCss(), CSS_ORIGINAL);
  assert.deepStrictEqual(r.infos, ['Fundo removido. Recarregue a janela.']);
  salvarConfig({ ...config(), ativo: true });
  await r.comandos['fundoPersonagem.aplicar']();
  assert.ok(lerCss().includes('/* FUNDO-PERSONAGEM:INICIO */'));
  assert.strictEqual(r.infos[1], 'Fundo atualizado. Recarregue a janela para ver a mudança.');
  assert.strictEqual(recarregou(r), 0, 'o usuário não clicou em "Recarregar janela"');
});

(async () => {
  let falhas = 0;
  for (const [nome, fn] of testes) {
    try {
      await fn();
      console.log('ok   ' + nome);
    } catch (e) {
      falhas++;
      console.log('FALHA ' + nome + '\n      ' + e.message);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (falhas) {
    console.log(`\n${falhas} teste(s) falharam`);
    process.exit(1);
  }
  console.log('\nextensão: todos os testes passaram');
})();

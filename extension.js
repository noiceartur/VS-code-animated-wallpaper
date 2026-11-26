'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PADRAO, mesclar, erroMetaPoses, gerarBloco, removerBloco, temBloco } = require('./src/css');

const CSS_DO_VSCODE = ['out', 'vs', 'workbench', 'workbench.desktop.main.css'];
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

let pastaDados; // pasta de dados da extensão (config + imagens ficam aqui)
let pastaExtensao; // pasta onde a extensão está instalada (traz as imagens padrão)
let versaoExtensao = '0';

const caminhoConfig = () => path.join(pastaDados, 'fundo.config.json');
const caminhoCss = () => path.join(vscode.env.appRoot, ...CSS_DO_VSCODE);
const absoluto = (caminho) => (path.isAbsolute(caminho) ? caminho : path.join(pastaDados, caminho));

// Copia as imagens padrão para a pasta de dados.
// - Primeira vez: copia tudo.
// - Versão nova da extensão: guarda as imagens antigas em "anteriores-<versão>" e copia as novas
//   (as imagens padrão e seus .json andam juntos; misturar versões quebraria a animação).
function sincronizarImagens() {
  const origem = path.join(pastaExtensao, 'imagens');
  if (!fs.existsSync(origem)) return;
  const marca = path.join(pastaDados, '.versao');
  const atual = fs.existsSync(marca) ? fs.readFileSync(marca, 'utf8').trim() : null;
  if (atual === versaoExtensao) return;

  const nomes = fs.readdirSync(origem);
  if (atual !== null) {
    const backup = path.join(pastaDados, `anteriores-${atual}`);
    for (const nome of nomes) {
      const velho = path.join(pastaDados, nome);
      if (fs.existsSync(velho)) {
        fs.mkdirSync(backup, { recursive: true });
        fs.copyFileSync(velho, path.join(backup, nome));
      }
    }
  }
  for (const nome of nomes) {
    const destino = path.join(pastaDados, nome);
    // primeira vez: nunca sobrescreve algo que já exista
    if (atual === null && fs.existsSync(destino)) continue;
    fs.copyFileSync(path.join(origem, nome), destino);
  }
  fs.writeFileSync(marca, versaoExtensao, 'utf8');
}

function garantirConfig() {
  fs.mkdirSync(pastaDados, { recursive: true });
  const p = caminhoConfig();
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(PADRAO, null, 2) + '\n', 'utf8');
  sincronizarImagens();
  return p;
}

// Largura/altura de um PNG lendo o cabeçalho (para a caixa da arte ter a proporção certa)
function proporcaoPng(caminho) {
  try {
    const fd = fs.openSync(absoluto(caminho), 'r');
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    fs.closeSync(fd);
    if (b.toString('ascii', 1, 4) !== 'PNG') return null;
    return b.readUInt32BE(16) / b.readUInt32BE(20);
  } catch (_) {
    return null;
  }
}

function lerConfig() {
  const bruto = fs.readFileSync(garantirConfig(), 'utf8');
  let json;
  try {
    json = JSON.parse(bruto);
  } catch (e) {
    throw new Error('Erro de sintaxe no fundo.config.json: ' + e.message);
  }
  return mesclar(PADRAO, json);
}

// Lê a imagem e devolve como data URI (assim não depende de file:// no VS Code)
function carregarImagem(caminho, avisos) {
  if (!caminho) return null;
  const abs = absoluto(caminho);
  if (!fs.existsSync(abs)) {
    avisos.push(`Imagem não encontrada: ${abs}`);
    return null;
  }
  const mime = MIME[path.extname(abs).toLowerCase()];
  if (!mime) {
    avisos.push(`Formato não suportado: ${abs}`);
    return null;
  }
  const buf = fs.readFileSync(abs);
  if (buf.length > 3 * 1024 * 1024) {
    avisos.push(`${path.basename(abs)} tem mais de 3 MB; reduza a imagem para o VS Code não ficar pesado.`);
  }
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Camada animada (fumaça ou piscada): um .json lista as imagens de pose (tela cheia, na mesma pasta) e quanto tempo cada uma dura
function carregarPoses(caminho, avisos) {
  if (!caminho) return null;
  const abs = absoluto(caminho);
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (_) {
    avisos.push(`Falta o arquivo da animação (ou ele tem erro): ${abs}`);
    return null;
  }
  const erro = erroMetaPoses(meta);
  if (erro) {
    avisos.push(`${path.basename(abs)}: ${erro}`);
    return null;
  }
  const poses = meta.poses.map((f) => carregarImagem(path.join(path.dirname(abs), f), avisos));
  if (poses.some((p) => !p)) return null;
  return { poses, meta };
}

function aplicar() {
  const cfg = lerConfig();
  const arquivoCss = caminhoCss();
  if (!fs.existsSync(arquivoCss)) {
    throw new Error(`Não encontrei o CSS do VS Code em: ${arquivoCss}`);
  }

  const limpo = removerBloco(fs.readFileSync(arquivoCss, 'utf8'));
  const avisos = [];
  let novo = limpo;

  if (cfg.ativo) {
    const camadas = {
      base: carregarImagem(cfg.imagem, avisos),
      fumaca: cfg.fumaca.ativo ? carregarPoses(cfg.fumaca.arquivo, avisos) : null,
      olhos: cfg.piscar.ativo ? carregarPoses(cfg.piscar.arquivo, avisos) : null
    };
    if (!camadas.base) {
      throw new Error('A imagem principal não foi encontrada. Coloque-a na pasta do config (comando "Abrir pasta de imagens").');
    }
    novo = limpo + '\n' + gerarBloco(cfg, camadas, proporcaoPng(cfg.imagem)) + '\n';
  }

  try {
    // backup do CSS original (uma vez por versão do VS Code)
    const backup = `${arquivoCss}.fundo-backup-${vscode.version}`;
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, limpo, 'utf8');
    fs.writeFileSync(arquivoCss, novo, 'utf8');
    fs.writeFileSync(path.join(pastaDados, '.aplicado'), versaoExtensao, 'utf8');
  } catch (e) {
    if (e.code === 'EACCES' || e.code === 'EPERM') {
      throw new Error('Sem permissão para escrever na pasta do VS Code. Feche o VS Code e abra como administrador (ou use a instalação por usuário).');
    }
    throw e;
  }
  return { avisos, ativo: cfg.ativo };
}

async function executar(mostrarMensagem) {
  try {
    const { avisos, ativo } = aplicar();
    for (const a of avisos) vscode.window.showWarningMessage('Fundo Personagem: ' + a);
    if (mostrarMensagem) {
      const msg = ativo ? 'Fundo atualizado. Recarregue a janela para ver a mudança.' : 'Fundo removido. Recarregue a janela.';
      const escolha = await vscode.window.showInformationMessage(msg, 'Recarregar janela');
      if (escolha) vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } catch (e) {
    vscode.window.showErrorMessage('Fundo Personagem: ' + e.message);
  }
}

function activate(context) {
  pastaDados = context.globalStorageUri.fsPath;
  pastaExtensao = context.extensionPath;
  try {
    versaoExtensao = JSON.parse(fs.readFileSync(path.join(pastaExtensao, 'package.json'), 'utf8')).version;
  } catch (_) {
    /* mantém o padrão */
  }
  // A "versão" que vale para atualizar imagens/CSS inclui uma assinatura das imagens que vêm com a extensão:
  // trocou uma imagem padrão (mesmo sem mudar o número da versão)? A extensão percebe e atualiza sozinha.
  try {
    const dir = path.join(pastaExtensao, 'imagens');
    const h = crypto.createHash('sha1');
    for (const n of fs.readdirSync(dir).sort()) {
      h.update(n);
      h.update(fs.readFileSync(path.join(dir, n)));
    }
    versaoExtensao += '-' + h.digest('hex').slice(0, 8);
  } catch (_) {
    /* sem pasta de imagens padrão: fica só o número da versão */
  }
  garantirConfig();

  context.subscriptions.push(
    vscode.commands.registerCommand('fundoPersonagem.abrirConfig', async () => {
      const doc = await vscode.workspace.openTextDocument(garantirConfig());
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand('fundoPersonagem.abrirPasta', () =>
      vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(garantirConfig()))
    ),
    vscode.commands.registerCommand('fundoPersonagem.aplicar', () => executar(true)),
    vscode.commands.registerCommand('fundoPersonagem.remover', async () => {
      try {
        const p = garantirConfig();
        const json = JSON.parse(fs.readFileSync(p, 'utf8'));
        json.ativo = false;
        fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n', 'utf8');
      } catch (e) {
        vscode.window.showErrorMessage('Fundo Personagem: ' + e.message);
        return;
      }
      await executar(true);
    }),
    // Salvou o config dentro do VS Code? Reaplica sozinho.
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (path.normalize(doc.uri.fsPath).toLowerCase() === path.normalize(caminhoConfig()).toLowerCase()) {
        executar(true);
      }
    })
  );

  return prepararNaInicializacao(context);
}

// A janela lê o CSS do VS Code ANTES de as extensões rodarem. Por isso, quando o VS Code atualiza (e troca o CSS
// pelo original), a janela abre sem o fundo mesmo que a extensão reaplique logo em seguida.
// Solução: na inicialização, reaplica se precisar e, se o CSS em disco for mais novo que esta janela, recarrega
// a janela sozinha (sem perguntar). Vale também para as outras janelas abertas junto, depois de uma atualização.
const CHAVE_RECARGA = 'fundoPersonagem.recarregadoParaCss';
// Folga entre a janela carregar o CSS e o host de extensões começar (o host sobe depois da janela).
const FOLGA_INICIO_MS = 5000;

// Momento (ms) em que o host de extensões desta janela começou.
const inicioDoHost = () => Date.now() - process.uptime() * 1000;

// O CSS em disco é mais novo do que o que esta janela carregou? Devolve o mtime do CSS, ou null.
// A marca em workspaceState (por janela/pasta) impede recarregar de novo pelo mesmo CSS: nunca entra em loop.
function cssMaisNovoQueAJanela(context) {
  const mtime = fs.statSync(caminhoCss()).mtimeMs;
  if (mtime < inicioDoHost() - FOLGA_INICIO_MS) return null;
  if (context.workspaceState.get(CHAVE_RECARGA) === mtime) return null;
  return mtime;
}

async function prepararNaInicializacao(context) {
  let cfg;
  try {
    cfg = lerConfig();
  } catch (_) {
    return; // config com erro: o usuário corrige e salva (o salvar reaplica)
  }
  if (!cfg.ativo) return;

  try {
    // O VS Code restaura o CSS quando atualiza: se o bloco sumiu, reaplica.
    // Também reaplica quando a extensão foi atualizada e trouxe imagens novas.
    const css = fs.readFileSync(caminhoCss(), 'utf8');
    const marca = path.join(pastaDados, '.aplicado');
    const aplicadoCom = fs.existsSync(marca) ? fs.readFileSync(marca, 'utf8') : '';
    if (!temBloco(css) || aplicadoCom !== versaoExtensao) {
      const { avisos } = aplicar();
      for (const a of avisos) vscode.window.showWarningMessage('Fundo Personagem: ' + a);
    }

    const mtime = cssMaisNovoQueAJanela(context);
    if (mtime !== null) {
      await context.workspaceState.update(CHAVE_RECARGA, mtime);
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } catch (e) {
    vscode.window.showErrorMessage('Fundo Personagem: ' + e.message);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };

# Fundo Personagem

**English** · [Português](README.pt-BR.md)

A VS Code extension that puts an animated character in the editor background. The cigarette smoke and the blinking are
animated with **CSS only**: no video, no canvas and no JavaScript running in the window. Your theme's colors stay as
they are (made for dark themes such as Dracula).

https://github.com/user-attachments/assets/053f7ba8-85cc-40c9-b728-2ccca11a9496

Art by **The Muun** ([YouTube](https://www.youtube.com/channel/UCw3rXoJK9CDhENV-ZifmEDg) ·
[Ko-fi](https://ko-fi.com/themuunlofi)), used with permission. See [credits](#credits).

> "Fundo Personagem" is Portuguese for "character background". The command names and config keys are in Portuguese;
> this README translates each one.

## Installation guide

### Requirements

- VS Code **1.80 or newer**, desktop version (Windows, macOS or Linux). It does not work in VS Code in the browser
  (vscode.dev, github.dev or Codespaces in the browser).
- A dark theme. The art is blended with the background using `screen` mode, so on a light theme it nearly disappears.

### 1. Download the extension

Download `fundo-personagem-<version>.zip` from the
[Releases](https://github.com/noiceartur/VS-code-animated-wallpaper/releases) page and extract the `.vsix` file inside it.

If you'd rather build the file from source (requires [Node.js](https://nodejs.org) 18 or newer):

```bash
git clone https://github.com/noiceartur/VS-code-animated-wallpaper.git
cd VS-code-animated-wallpaper
npm run package
```

### 2. Install it in VS Code

**From the interface:**

1. Open the **Extensions** view (`Ctrl+Shift+X`; on macOS, `Cmd+Shift+X`).
2. Click the three dots (`...`) at the top of the view.
3. Choose **Install from VSIX...** and select the `.vsix` file you downloaded.

**Or from the terminal:**

```bash
code --install-extension fundo-personagem-<version>.vsix
```

### 3. First launch

1. After installing, the extension applies the background and **reloads the window by itself once**. The screen
   blinks quickly and the character appears.
2. VS Code will show the warning *"Your Code installation appears to be corrupt"* and may show `[Unsupported]` in the
   window title. This happens because the extension changes one of VS Code's CSS files. It's not a problem: click the
   gear on the warning and choose **Don't Show Again**.
3. If the background doesn't appear, open the Command Palette (`Ctrl+Shift+P`), run **Fundo Personagem: Aplicar**
   (*Apply*) and click **Recarregar janela** (*Reload window*).

### Permission errors

The extension needs to write to the folder where VS Code is installed. If you get a permission error:

- **Windows:** the "System" installation (in `Program Files`) is protected. Run VS Code as administrator once and run
  **Fundo Personagem: Aplicar**, or switch to the "User" installer, which doesn't need this.
- **macOS:** keep VS Code in the **Applications** folder. When opened straight from Downloads, it runs from a read-only
  location.
- **Linux:** with `.deb` or `.rpm` installs, the VS Code folder belongs to root. Give your user access (for example,
  `sudo chown -R $(whoami) /usr/share/code`) or use the `.tar.gz` version. The **Snap version does not work**, because
  its files are read-only.

### Updating

Install the new version's `.vsix` the same way, on top of the old one. Your settings are kept.

When VS Code itself updates, it restores the original CSS. The extension notices this on startup, reapplies the
background and reloads the window once, with nothing for you to do.

### Uninstalling

1. Run **Fundo Personagem: Remover fundo** (*Remove background*) from `Ctrl+Shift+P` and click **Recarregar janela**.
   This restores VS Code's original CSS.
2. Then uninstall the extension in the **Extensions** view.

If you uninstall without removing it first, the background keeps showing until the next VS Code update. To remove it
right away, install the extension again and follow step 1.

## Technical highlights

- **Frame-by-frame animation in pure CSS.** The 7 smoke drawings and the 5 blink poses were extracted from a video and
  turned into full-canvas PNGs. A single `@keyframes` with `steps(1, end)` shows one frame at a time by switching each
  layer's `background-size` between `0 0` and `100% 100%`.
- **One timeline for two animations.** The smoke (20 steps, 5 s cycle) and the blink (0.6 s) run at different paces.
  `linhaDoTempo()` merges them into a single cycle with a whole number of blinks, so the loop closes without a "jump".
- **No subpixel misalignment.** The character, smoke and eyes are backgrounds of the same element (`body::before`), with
  the same size and position. The layers stay aligned pixel for pixel at any zoom level or Windows display scale.
- **`screen` blending.** The black in the art doesn't change the theme, so there's no need to cut out the background.
  Opacity is applied once, to the whole stack.
- **Comes back after every VS Code update.** See [below](#why-the-window-reloads-by-itself).
- **Safe config.** Values from `fundo.config.json` are validated before going into the CSS, so a wrong value can't
  break the VS Code interface.

## How it works

VS Code has no API for background images. So the extension writes a CSS block, between
`/* FUNDO-PERSONAGEM:INICIO */` and `/* FUNDO-PERSONAGEM:FIM */`, into the `workbench.desktop.main.css` file of the VS
Code installation, after backing up the original. The images go into the CSS as *data URIs*, so they don't depend on
`file://`.

### Why the window reloads by itself

Themes like Dracula use the theme API, which VS Code reads on every startup. This background doesn't: it lives inside
one of VS Code's own files, which is replaced on every update. On top of that, the window reads this CSS **before**
extensions run.

That's why the extension activates right at startup (`"activationEvents": ["*"]`). If the block is gone, it reapplies
it. If the CSS on disk is newer than the one the window loaded, it reloads the window once, without asking. The result
is that the background shows up on the very first launch after an update, with a quick blink of the window. A per-window
marker (`workspaceState`) prevents reload loops. This also works for several windows restored at the same time.

## Commands

| Command (Ctrl+Shift+P)                     | What it does                                                    |
| ------------------------------------------ | --------------------------------------------------------------- |
| `Fundo Personagem: Abrir config`           | *Open config.* Opens `fundo.config.json`. Saving reapplies it.  |
| `Fundo Personagem: Abrir pasta de imagens` | *Open images folder.* Shows the folder with config and images.  |
| `Fundo Personagem: Aplicar`                | *Apply.* Reapplies, for example after replacing an image.       |
| `Fundo Personagem: Remover fundo`          | *Remove background.* Restores the original CSS, sets `"ativo": false`. |

## Configuration (`fundo.config.json`)

Every key is optional. Anything missing from the file uses the default.

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

| Key                  | Meaning                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `ativo`              | *Enabled.* `false` turns the background off.                                                     |
| `imagem`             | *Image.* The main artwork.                                                                       |
| `opacidade`          | *Opacity*, from 0 to 1.                                                                          |
| `altura`             | *Height* of the art in the window. The width follows the image's aspect ratio.                   |
| `direita`, `baixo`   | *Right* and *bottom* margins.                                                                    |
| `fumaca.velocidade`  | *Smoke speed.* 1 is the video's pace, 0.5 is half, 2 is double.                                  |
| `piscar.intervalo`   | *Blink interval* in seconds. Adjusted so a whole number of blinks fits in the smoke cycle.       |

Image paths can be relative to the config folder or absolute.

## Images

All of them use the same canvas (1610×1080).

| File                            | Contents                                                                   |
| ------------------------------- | -------------------------------------------------------------------------- |
| `imagens/personagem.png`        | The full artwork, eyes open and **without smoke**                          |
| `imagens/olho-1..5.png`         | The 5 blink poses (transparent outside the eye area)                       |
| `imagens/fumaca-1..7.png`       | The 7 smoke drawings, with the fade stored in the alpha channel            |
| `imagens/olhos.json`            | Blink poses and how long each lasts (`passos`: `[pose, seconds]`)          |
| `imagens/fumaca.json`           | Smoke drawings and their order and duration (20 steps, 5 s)                |

To use a different animation, replace the images and edit the matching `.json`. When the images bundled with the
extension change, the user's old copy is moved to `anteriores-<version>/`.

## Development

Requires Node.js 18 or newer. No runtime dependencies.

```bash
npm test          # tests for the CSS functions and for the extension against a simulated VS Code
npm run package   # builds fundo-personagem-<version>.vsix with the official vsce
```

Structure:

```
extension.js        activation, image copy, CSS injection/removal, automatic reload, commands
src/css.js          CSS block generation, animation timeline, config validation
imagens/            artwork and animation frames
teste/              tests (plain node, no framework)
```

The tests in `teste/extensao.test.js` simulate the first install, a VS Code update, several open windows, a broken
config and missing write permission.

## Credits

Original art and animation by **The Muun**, used with the author's permission. Support their work:

- YouTube: [The Muun](https://www.youtube.com/channel/UCw3rXoJK9CDhENV-ZifmEDg)
- Ko-fi: [ko-fi.com/themuunlofi](https://ko-fi.com/themuunlofi)
- Original video: [youtube.com/watch?v=93Sfl5rRBGw](https://www.youtube.com/watch?v=93Sfl5rRBGw)

The images in `imagens/` and the icon in `midia/` were made from that video.

## License

The code is under the [MIT](LICENSE) license. The artwork (the `imagens/` and `midia/` folders) belongs to The Muun and
is **not** covered by that license: don't reuse the images without the author's permission.

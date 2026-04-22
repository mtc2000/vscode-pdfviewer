import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable } from './disposable';

function escapeAttribute(value: string | vscode.Uri): string {
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

type PreviewState = 'Disposed' | 'Visible' | 'Active';

export class PdfPreview extends Disposable {
  private _previewState: PreviewState = 'Visible';

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel
  ) {
    super();
    const resourceRoot = resource.with({
      path: resource.path.replace(/\/[^/]+?\.\w+$/, '/'),
    });

    webviewEditor.webview.options = {
      enableScripts: true,
      localResourceRoots: [resourceRoot, extensionRoot],
    };

    this._register(
      webviewEditor.webview.onDidReceiveMessage((message) => {
        switch (message.type) {
          case 'reopen-as-text': {
            vscode.commands.executeCommand(
              'vscode.openWith',
              resource,
              'default',
              webviewEditor.viewColumn
            );
            break;
          }
        }
      })
    );

    this._register(
      webviewEditor.onDidChangeViewState(() => {
        this.update();
      })
    );

    this._register(
      webviewEditor.onDidDispose(() => {
        this._previewState = 'Disposed';
      })
    );

    const watcher = this._register(
      vscode.workspace.createFileSystemWatcher(resource.fsPath)
    );
    this._register(
      watcher.onDidChange((e) => {
        if (e.toString() === this.resource.toString()) {
          this.reload();
        }
      })
    );
    this._register(
      watcher.onDidDelete((e) => {
        if (e.toString() === this.resource.toString()) {
          this.webviewEditor.dispose();
        }
      })
    );

    this.webviewEditor.webview.html = this.getWebviewContents();
    this.update();
  }

  private reload(): void {
    if (this._previewState !== 'Disposed') {
      this.webviewEditor.webview.postMessage({ type: 'reload' });
    }
  }

  private update(): void {
    if (this._previewState === 'Disposed') {
      return;
    }

    if (this.webviewEditor.active) {
      this._previewState = 'Active';
      return;
    }
    this._previewState = 'Visible';
  }

  private getWebviewContents(): string {
    const webview = this.webviewEditor.webview;
    const docPath = webview.asWebviewUri(this.resource);
    const cspSource = webview.cspSource;
    const resolveAsUri = (...p: string[]): vscode.Uri => {
      const uri = vscode.Uri.file(path.join(this.extensionRoot.fsPath, ...p));
      return webview.asWebviewUri(uri);
    };

    const config = vscode.workspace.getConfiguration('pdf-preview');
    const settings = {
      path: docPath.toString(),
      defaults: {
        cursor: config.get('default.cursor') as string,
        scale: config.get('default.scale') as string,
        sidebar: config.get('default.sidebar') as boolean,
        scrollMode: config.get('default.scrollMode') as string,
        spreadMode: config.get('default.spreadMode') as string,
      },
    };

    const viewerHtmlPath = path.join(
      this.extensionRoot.fsPath,
      'lib',
      'web',
      'viewer.html'
    );
    const viewerHtml = fs.readFileSync(viewerHtmlPath, 'utf8');
    const viewerBase = `${resolveAsUri('lib', 'web').toString()}/`;
    const csp = `default-src 'none'; connect-src ${cspSource}; script-src 'unsafe-inline' ${cspSource}; style-src 'unsafe-inline' ${cspSource}; img-src blob: data: ${cspSource}; font-src ${cspSource} data:; worker-src ${cspSource} blob:;`;
    const injectedHeadStart = [
      `<meta http-equiv="X-UA-Compatible" content="IE=edge">`,
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
      `<base href="${escapeAttribute(viewerBase)}">`,
      `<meta id="pdf-preview-config" data-config="${escapeAttribute(
        JSON.stringify(settings)
      )}">`,
    ].join('\n');
    const injectedHeadEnd = [
      `<link rel="stylesheet" href="../pdf.css">`,
      `<script src="../main.js" type="module"></script>`,
    ].join('\n');

    return viewerHtml
      .replace('<head>', `<head>\n${injectedHeadStart}`)
      .replace('</head>', `${injectedHeadEnd}\n</head>`);
  }
}

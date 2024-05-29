import * as vscode from 'vscode';
import * as fs from 'fs';

interface Message {
	command: string;
	name: string;
	model: string;
}

export default class CreateProjectPanel {
	public static currentPanel?: CreateProjectPanel;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _context: vscode.ExtensionContext;
	private readonly _models: { [key: string]: any };
	public onSubmit: (message: Message) => Promise<void> = async () => {};

	public static show(context: vscode.ExtensionContext, models: { [key: string]: any }): CreateProjectPanel {
		if (CreateProjectPanel.currentPanel) {
			CreateProjectPanel.currentPanel._panel.reveal();
			return CreateProjectPanel.currentPanel;
		}
		
		let panel = vscode.window.createWebviewPanel(
			'createProject',
			'Create a RuyiSDK Project',
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(context.extensionPath)]
			}
		)
		CreateProjectPanel.currentPanel = new CreateProjectPanel(panel, context, models);
		return CreateProjectPanel.currentPanel;
	}

	private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, models: { [key: string]: any }) {
		this._panel = panel;
		this._context = context;
		this._models = models;

		this._panel.onDidDispose(() => {
			CreateProjectPanel.currentPanel = undefined;
		}, null, this._context.subscriptions);
		this._panel.webview.html = this.getWebviewContent();
		this._panel.webview.onDidReceiveMessage((message: Message) => {
			this.onSubmit(message)
				.then(() => this._panel.dispose())
				.catch((error) => vscode.window.showErrorMessage(error.message));
		}, null, this._context.subscriptions);
		this._panel.webview.postMessage({ command: 'init', models: this._models });
	}

	private getWebviewContent() {
		const path = vscode.Uri.joinPath(this._context.extensionUri, 'src/CreateProjectPanel/index.html');
		return fs.readFileSync(path.fsPath, 'utf8');
	}
}
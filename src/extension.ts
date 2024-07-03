import * as vscode from 'vscode';
import * as fs from 'fs';
import * as ruyisdk from './riyisdk';

function packageInit() {
	const packages = ruyisdk.installablePackages();

	type Package = ruyisdk.Package;
	type PackageVersion = { parent: Package, semver: string };
	type Node = Package | PackageVersion;
	const treeView = vscode.window.createTreeView('ruyisdk.packages', {
		treeDataProvider: {
			getTreeItem: function (element: Node): vscode.TreeItem {
				let item = new vscode.TreeItem('');
				if ('name' in element) {
					item.label = (element as Package).name;
					item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
				} else {
					item.label = (element as PackageVersion).semver;
					item.collapsibleState = vscode.TreeItemCollapsibleState.None;
				}
				return item;
			},
			getChildren: function (element?: Node): Thenable<Node[]> {
				if (element) {
					const package_ = (element as Package);
					return Promise.resolve(package_.vers.map(ver => ({
						parent: package_,
						semver: ver.semver
					})));
				}
				return Promise.resolve(packages);
			}
		}
	});
	treeView.onDidChangeSelection(async (e) => {
		if (e.selection.length === 0) return;
		if ('name' in e.selection[0]) return; // ignore package nodes

		const selected = e.selection[0] as PackageVersion;
		const answer = await vscode.window.showInformationMessage(
			`do you want to install ${selected.parent.name}/${selected.semver}?`, 'Yes', 'No'
		);
		if (answer === 'No') return;

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Installing ${selected.parent.name}/${selected.semver}`
		}, async (progress) => {
			progress.report({ increment: 0, message: 'Installing...' });
			await ruyisdk.install(selected.parent.name, selected.semver);
			progress.report({ increment: 100 });
			vscode.window.showInformationMessage('Toolchain installed successfully');
		});
	});
}

function newsInit() {
	const treeView = vscode.window.createTreeView('ruyisdk.news', {
		treeDataProvider: {
			getTreeItem: function (element: ruyisdk.News): vscode.TreeItem {
				const item = new vscode.TreeItem(element.langs[0].display_title);
				return item;
			},
			getChildren: function (element?: ruyisdk.News): Thenable<ruyisdk.News[]> {
				if (element) return Promise.resolve([]);
				return Promise.resolve(ruyisdk.news());
			}
		}
	});
	treeView.onDidChangeSelection(async (e) => {
		if (e.selection.length === 0) return;
		const news = e.selection[0];
		await vscode.window.showInformationMessage(news.langs[0].content);
	});
}

function venvInit(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('ruyisdk.openVENV', async (path) => {
		if (path === undefined) {
			path = await vscode.window.showOpenDialog({
				title: 'Select a virtual environment',
				canSelectFolders: true,
				canSelectMany: false
			});
			if (path === undefined) return;
			path = path[0].fsPath;
		}

		path += '/bin/ruyi-activate';
		if (!fs.existsSync(path)) {
			vscode.window.showErrorMessage('Not a virtual environment');
			return;
		}
		vscode.commands.executeCommand('setContext', 'ruyisdk.content.venv', path);
		context.globalState.update('venv', path);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('ruyisdk.closeVENV', () => {
		vscode.commands.executeCommand('setContext', 'ruyisdk.content.venv', undefined);
		context.globalState.update('venv', undefined);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('ruyisdk.createVENV', async () => {
		const profiles = await ruyisdk.profiles();
		const profile = await vscode.window.showQuickPick(profiles, {
			placeHolder: 'Select a profile'
		});
		if (!profile) return;

		const toolchains = await ruyisdk.toolchains();
		const toolchain = await vscode.window.showQuickPick(toolchains.map(toolchain => ({
			label: toolchain.name,
			detail: toolchain.vers[0].pm.toolchain.target
		})), {
			placeHolder: 'Select toolchain'
		});
		if (!toolchain) return;

		const sysroots = toolchains.filter(toolchain => toolchain.vers[0].pm.toolchain.included_sysroot);
		const sysroot = await vscode.window.showQuickPick(sysroots.map(sysroot => ({
			label: sysroot.name
		})), {
			placeHolder: 'Select sysroot from',
		});
		if (!sysroot) return;

		const name = await vscode.window.showInputBox({
			prompt: 'Enter a name for the virtual environment'
		});
		if (!name) return;

		const savepath = await vscode.window.showOpenDialog({
			title: 'Select a folder to create in',
			canSelectFolders: true,
			canSelectMany: false
		})
		if (!savepath) return;

		const path = vscode.Uri.joinPath(savepath[0], name);
		if (fs.existsSync(path.fsPath)) {
			vscode.window.showErrorMessage('Folder already exists');
			return;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Creating ${name}`
		}, async (progress) => {
			progress.report({ increment: 0, message: 'Installing toolchain...' });
			await ruyisdk.install(toolchain.label);
			progress.report({ increment: 25, message: 'Installing sysroot...' });
			await ruyisdk.install(sysroot.label);
			progress.report({ increment: 25, message: 'Sit and relax...' });
			await ruyisdk.venv(path.fsPath, profile, toolchain.label, sysroot.label);
			progress.report({ increment: 50 });
		});
		vscode.commands.executeCommand('ruyisdk.openVENV', path.fsPath);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('ruyisdk.run', async () => {
		const venv = context.globalState.get('venv');
		const terminal = vscode.window.createTerminal('ruyisdk', 'bash');
		terminal.show();
		terminal.sendText(`. ${venv}`);
		terminal.sendText('make');
	}));
}

function projectInit(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('ruyisdk.extract', async () => {
		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showErrorMessage('No workspace folder open');
			return;
		}

		const sources = await ruyisdk.sources();
		const source = await vscode.window.showQuickPick(sources.map(source => ({
			label: source.name,
		}), {
			placeHolder: 'Select a source'
		}));
		if (!source) return;

		const path = vscode.workspace.workspaceFolders[0].uri;
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Extracting ${source.label}`
		}, async (progress) => {
			progress.report({ increment: 0, message: 'Sit and relax...' });
			await ruyisdk.extract(source.label, path.path);
			progress.report({ increment: 100, });
		});

		const readme = vscode.Uri.joinPath(path, 'README.md');
		if (fs.existsSync(readme.fsPath)) {
			await vscode.workspace.openTextDocument(readme);
			await vscode.window.showTextDocument(readme);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('ruyisdk.createProject', async () => {
		const models = JSON.parse(fs.readFileSync(context.extensionPath + '/resources/models.json', 'utf-8'));
		const model = await vscode.window.showQuickPick(models, {
			placeHolder: 'Select a model'
		});
	}));
}

export function activate(context: vscode.ExtensionContext) {
	packageInit();
	newsInit();
	venvInit(context);
	projectInit(context);
}

export function deactivate() {}

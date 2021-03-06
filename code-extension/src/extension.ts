// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { clearInterval } from "timers";
import * as vscode from "vscode";
import { GitExtension, Repository } from "./api/git";

let _handlingChangeNotification = false;
let _remoteSyncIntervalHandle: NodeJS.Timeout;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log("gitnote activated.");

  const gitExtension =
    vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
  const git = gitExtension?.getAPI(1);
  if (!git) {
    vscode.window.showErrorMessage("Failed to load git extension.");
    return;
  }

  if (git.state === "initialized" && git.repositories.length > 0) {
    console.log(
      "git is initialized and has a repository open. subscribing to changes."
    );
    const repo = git.repositories[0];
    console.log("on activation state check", {
      indexChanges: repo.state.indexChanges.length,
      mergeChanges: repo.state.mergeChanges.length,
      workingTreeChanges: repo.state.workingTreeChanges.length,
    });

    context.subscriptions.push(
      repo.state.onDidChange(() => {
        onGitRepoStateChanged(repo);
      })
    );

    if (getTotalRepoChangeCount(repo) > 0) {
      onGitRepoStateChanged(repo);
    }

    console.log("Setting remote sync interval at 30s");
    _remoteSyncIntervalHandle = setInterval(() => remoteSyncInterval(repo), 30000);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("gitnote.enableSync", () => {
      vscode.window.showInformationMessage("enable sync stub");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gitnote.disableSync", () => {
      vscode.window.showInformationMessage("disable sync stub");
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  if (_remoteSyncIntervalHandle) {
    clearInterval(_remoteSyncIntervalHandle);
  }
}

async function commitRepoChanges(repo: Repository) {
  try {
    console.log(`Attempting to commit changes.`);
    await repo.add([repo.rootUri.path]);
    await repo.commit("gitnote autosave", {
      all: true,
      empty: false,
    });
    console.log("Changes committed.");
  } catch (e) {
    console.error("Encountered an error committing changes.", e);
  }
}

async function onGitRepoStateChanged(repo: Repository) {
  if (_handlingChangeNotification) {
    return;
  }
  const totalChangeCount = getTotalRepoChangeCount(repo);
  if (totalChangeCount === 0) {
    return;
  }

  _handlingChangeNotification = true;

  console.log("Detected changes.", {
    indexChanges: repo.state.indexChanges.length,
    mergeChanges: repo.state.mergeChanges.length,
    workingTreeChanges: repo.state.workingTreeChanges.length,
  });

  await commitRepoChanges(repo);

  _handlingChangeNotification = false;
}

async function remoteSyncInterval(repo: Repository) {
  console.log("Remote sync interval.");
  if (_handlingChangeNotification) {
    console.log("Ignoring sync while change handling is in progress.");
    return;
  }

  try {
    console.log("Pulling.");
    await repo.pull();
    console.log("Pushing.");
    await repo.push();
    console.log("Remote sync complete.");
  }
  catch (e) {
    console.error("Failed to synchronize with remote.", e);
  }
}

function getTotalRepoChangeCount(repo: Repository) {
  return (
    repo.state.indexChanges.length +
    repo.state.mergeChanges.length +
    repo.state.workingTreeChanges.length
  );
}

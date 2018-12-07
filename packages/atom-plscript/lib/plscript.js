'use babel';

import { readFile, writeFileSync } from 'fs';
import path from 'path';
// import { homedir } from 'os';

import config from './config';
import PlscriptView from './plscript-view';
import PlscriptInputView from './plscript-input-view';
import { CompositeDisposable, BufferedProcess } from 'atom';
import cleanPlscript from './cleanPlscript';

export default {
    config,
    plscriptView: null,
    modalPanel: null,
    subscriptions: null,

    inRepo(filePath) {
        const linuxFilePath = this.convertWindowsPathToLinux(filePath);
        const repoRoot = atom.config.get('plscript.repoRoot');
        return linuxFilePath.indexOf(repoRoot) > -1;
    },

    getBreakpointFilename() {
        const root = atom.config.get('plscript.repoRoot');
        return path.join(root, 'pl_app/break_points.dat');
        // return path.join(homedir(), root, 'pl_app/break_points.dat');
    },

    activate(state) {
        this.plscriptView = new PlscriptView(state.plscriptViewState);
        this.modalPanel = atom.workspace.addModalPanel({
            item: this.plscriptView.getElement(),
            visible: false
        });

        this.inputView = new PlscriptInputView(state.inputView);

        // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
        this.subscriptions = new CompositeDisposable();

        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'plscript:add-breakpoint': () => this.addBreakpoint(),
            'plscript:clear-breakpoints': () => this.clearBreakpoints(),
            'plscript:clean-file': () => this.cleanFile(),
            'plscript:list-locks': () => this.listLocks(),
            'plscript:lock-file': () => this.lockFile(),
            'plscript:get-prop-list': () => this.getPropList(),
        }));
    },

    deactivate() {
        this.modalPanel.destroy();
        this.subscriptions.dispose();
        this.plscriptView.destroy();
        this.inputView.destroy();
    },

    serialize() {
        return {
            plscriptViewState: this.plscriptView.serialize()
        };
    },

    addBreakpoint() {
        const editor = atom.workspace.getActiveTextEditor();
        const filePath = editor.getPath();
        const lineNum = editor.getCursorBufferPosition().row + 1;

        if(!this.inRepo(filePath)) {
            console.log("[plscript] Breakpoints don't mean anything in this context.");
            atom.notifications.addWarning("Breakpoints don't make sense in this context");
            return false;
        }

        const dir = atom.config.get('plscript.repoRoot');

        let bpStr = filePath.replace(/\\/g, "/");
        const index = bpStr.indexOf(dir);
        bpStr = bpStr.substr(index + dir.length) + ":" + lineNum;
        console.log("[plscript] Attempting to add breakpoint at", bpStr);

        const breakpointFile = this.getBreakpointFilename();

        return readFile(breakpointFile, (err, breakpoints) => {
            if (err) {
                console.log("[plscript] Uh oh!");
                console.log(err);
                return;
            }

            if (breakpoints != "") breakpoints += "\n";
            if (breakpoints.indexOf(bpStr) != -1) {
                console.log("[plscript] Breakpoint already exists");
                atom.notifications.addInfo("A breakpoint on this line already exists.");
                return;
            }
            atom.notifications.addSuccess("Breakpoint added to\n" + bpStr);
            breakpoints += bpStr;
            writeFileSync(breakpointFile, breakpoints);
        });
    },

    clearBreakpoints() {
        // const dir = this.getDir(atom.workspace.getActiveTextEditor().getPath());
        const dir = atom.config.get('plscript.repoRoot');
        const breakpointFile = this.getBreakpointFilename();
        writeFileSync(breakpointFile, "");
        atom.notifications.addSuccess("Breakpoints cleared.");
        console.log("[plscript] Breakpoints cleared.")
        return;
    },

    listLocks() {
        let curFilename = atom.workspace.getActiveTextEditor().getPath();
        curFilename = this.convertWindowsPathToLinux(curFilename);
        this.runShellCommand('git locks', [curFilename], currentLocks => {
            let lockingBranches = currentLocks.split('\n').map(lock => lock.split('  ')[1]).filter(item => item).join(', ');
            this.holler(`This file is locked on these branches: ${lockingBranches}`);
        });
    },

    lockFile() {
        let curFilename = atom.workspace.getActiveTextEditor().getPath();
        this.inputView.miniEditor.setPlaceholderText("Enter lock message for this file");
        this.inputView.message.textContent = "What would you like the lock message to say?";
        this.inputView.onConfirm = input => {
            if (input) {
                const formattedFilename = this.convertWindowsPathToLinux(curFilename);
                this.runShellCommand('git lock', ['-f', formattedFilename, `-m '${input}'`], lockOutput => {
                    this.holler(lockOutput);
                    this.listLocks();
                });
            }
        }
        this.inputView.open();
        return;
    },

    cleanFile() {
        const textBuffer = atom.workspace.getActiveTextEditor().getBuffer();
        let buffText = textBuffer.getText();
        const cleanText = cleanPlscript(buffText);
        textBuffer.setText(cleanText.text);
        if(cleanText.warnings) {
            for (var i = 0; i < cleanText.warnings.length; i++) {
                this.holler(cleanText.warnings[i]);
            }
        }
    },

    convertWindowsPathToLinux(filepath) {
        const isAbsolutePath = filepath.indexOf(':\\') == 1;
        let ret = filepath.replace(/\\/g, '/');
        ret = ret.replace(':/', '/');

        if(isAbsolutePath)
        ret = '/' + ret;

        return ret;
    },

    getPropList() {
        this.inputView.miniEditor.setPlaceholderText("Val_list");
        this.inputView.message.textContent = "Which C Object are you interested in?";

        this.inputView.onConfirm = input => {
            atom.notifications.addInfo(`Looking up props of '${input}'.`);
            const prop_list = "/usr/local/lib/pl_tools/bin/prop_list";
            this.runShellCommand(prop_list, [input], output => this.holler(`prop_list ${input}`, output))
        }
        this.inputView.open();
    },

    holler(message, detail) {
        atom.notifications.addSuccess(message, detail);
        // atom.notifications.addSuccess(message, {detail, dismissable: 1});
    },

    runShellCommand(cmd, commandArgs, callback) {
        const extraPath = 'PATH=$PATH:/usr/local/lib/pl_tools/bin';
        const bashBinary = 'C:\\Program\ Files\\Cygwin\\bin\\bash.exe';

        let args = ["-l", "-c", `${extraPath} ${cmd} ${commandArgs.join(' ')}`]
        let output = "";

        console.log(`[runShellCommand] running ${bashBinary} ${args.join(' ')}`)
        const stdout = data => { output += data }
        const stderr = console.error
        const exit = (code) => {
            if(code === 0) callback(output)
            else console.log(`exited with status ${code}`)
        }
        const process = new BufferedProcess({
            command: bashBinary,
            args,
            stdout,
            stderr,
            exit
        });
    }

};

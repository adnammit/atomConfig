'use babel';

import { readFile, writeFileSync } from 'fs';
import path from 'path';
// import { homedir } from 'os';

import config from './config';
import PlscriptView from './plscript-view';
import PlscriptInputView from './plscript-input-view';
import { CompositeDisposable, BufferedProcess } from 'atom';

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
            'plscript:list-locks': () => this.listLocks(),
            'plscript:lock-file': () => this.lockFile(),
            'plscript:get-prop-list': () => this.getPropList(),
            'plscript:clean-file': () => this.cleanFile(),
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

    // This is pretty over-simplified.
    // If there is something silly like `sally=make("Alert_mgr");`, we should search all instances of
    //      'sally' and replace with 'Alert_mgr::' but that is for another time...
    cleanFile() {
        const textBuffer = atom.workspace.getActiveTextEditor().getBuffer();
        let buffText = textBuffer.getText();

        const map = [];

        map.push({'regex': /\t/gi, 'val': '        '});
        map.push({'regex': /\r/gi, 'val': ''});


        map.push({'regex': /\bhg *= *make\("Hourglass"\);\s+/g, 'val': ''});

        map.push({'regex': /\b(alert_mgr|am) *= *make\("Alert_mgr"\);\s+/g, 'val': ''});
        map.push({'regex': /\b(alert_mgr|am|make\("Alert_mgr"\))\./g, 'val': 'Alert_mgr::'});

        map.push({'regex': /\b(str_util|su) *= *make\("Str_util"\);\s+/g, 'val': ''});
        map.push({'regex': /\b(str_util|su|make\("Str_util"\))\./g, 'val': 'Str_util::'});

        map.push({'regex': /\b(query|q) *= *make\("Query"\);\s+/g, 'val': ''});
        map.push({'regex': /\b(query|q|make\("Query"\))\./g, 'val': 'Query::'});

        map.push({'regex': /\bobj_mgr *= *make\("Object_mgr"\);\s+/g, 'val': ''});
        map.push({'regex': /\b(obj_mgr|make\("Object_mgr"\))\./g, 'val': 'Object_mgr::'});

        map.push({'regex': /\b(list_util|lu) *= *make\("List_util"\);\s+/g, 'val': ''});
        map.push({'regex': /\b(list_util|lu|make\("List_util"\))\./g, 'val': 'List_util::'});

        map.push({'regex': /\b(prop_extractor|pe) *= *make\("Prop_extractor"\);\s+/g, 'val': ''});
        map.push({'regex': /\b(prop_extractor|pe|make\("Prop_extractor"\))\./g, 'val': 'Prop_extractor::'});

        map.push({'regex': /\b(date_util|du) *= *make\("Date_util"\);\s+/g, 'val': ''});
        map.push({'regex': /\b(date_util|du|make\("Date_util"\))\./g, 'val': 'Date_util::'});

        map.push({'regex': /\bcopier *= *make\("Copier"\);\s+/g, 'val': ''});
        map.push({'regex': /\b(copier|make\("Copier"\))\./g, 'val': 'Copier::'});

        // // M_loader replacements might have to be manually done b/c sometimes 'loader' is still Loader:: :(
        // map.push({'regex': /\s+(loader|m_loader) *= *make\("M_loader"\);\s+/g, 'val': '\n'});
        // map.push({'regex': /\b(loader|m_loader|make\("M_loader"\))\./g, 'val': 'M_loader::'});

        for(i = 0; i < map.length; i++) {
            buffText = buffText.replace(map[i].regex,map[i].val);
        }

        if(!/\bmake\("Loader"\)/g.test(buffText)) {
            buffText = buffText.replace(/\b(loader|m_loader) *= *make\("M_loader"\);\s+/g, '');
            buffText = buffText.replace(/\b(loader|m_loader|make\("M_loader"\))\./g, 'M_loader::');
        } else {
            this.holler(`This file contains instances of 'Loader'. Manual replacements with 'M_loader' are required.`);
        }

        textBuffer.setText(buffText);
    },

    //// so that's ^ ok....  but the indenting is weird.
    //// would be better to use the below because:
    ////        use textBuffer's built-in methods is probably better
    ////        but for some reason, the regexes in replacements are not matching and
    ////            replacements are erroring

    // cleanFile() {
    //     const textBuffer = atom.workspace.getActiveTextEditor().getBuffer();
    //     const textLines = textBuffer.getLines();
    //
    //     const replacements = [];
    //     const removals = [];
    //
    //     replacements.push({'regex': /\t/gi, 'val': '        '});
    //     replacements.push({'regex': /\r/gi, 'val': ''});
    //
    //     removals.push(/\s+(alert_mgr|am) *= *make\("Alert_mgr"\);\s+/g);
    //     replacements.push({'regex': /\b(alert_mgr|am|make\("Alert_mgr"\))\./g, 'val': 'Alert_mgr::'});
    //
    //     removals.push(/\s+(str_util|su) *= *make\("Str_util"\);\s+/g);
    //     replacements.push({'regex': /\b(str_util|su|make\("Str_util"\))\./g, 'val': 'Str_util::'});
    //
    //     removals.push(/\s+(query|q) *= *make\("Query"\);\s+/g);
    //     replacements.push({'regex': /\b(query|q|make\("Query"\))\./g, 'val': 'Query::'});
    //
    //     // // M_loader replacements might have to be manually done b/c sometimes 'loader' is still Loader:: :(
    //     // replacements.push({'regex': /\s+(loader|m_loader) *= *make\("M_loader"\);\s+/g, 'val': '\n'});
    //     // replacements.push({'regex': /\b(loader|m_loader|make\("M_loader"\))\./g, 'val': 'M_loader::'});
    //
    //     removals.push(/\s+obj_mgr *= *make\("Object_mgr"\);\s+/g);
    //     replacements.push({'regex': /\b(obj_mgr|make\("Object_mgr"\))\./g, 'val': 'Object_mgr::'});
    //
    //     removals.push(/\s+(list_util|lu) *= *make\("List_util"\);\s+/g);
    //     replacements.push({'regex': /\b(list_util|lu|make\("List_util"\))\./g, 'val': 'List_util::'});
    //
    //     removals.push(/\s+(prop_extractor|pe) *= *make\("Prop_extractor"\);\s+/g);
    //     replacements.push({'regex': /\b(prop_extractor|pe|make\("Prop_extractor"\))\./g, 'val': 'Prop_extractor::'});
    //
    //     removals.push(/\s+(date_util|du) *= *make\("Date_util"\);\s+/g);
    //     replacements.push({'regex': /\b(date_util|du|make\("Date_util"\))\./g, 'val': 'Date_util::'});
    //
    //     removals.push(/\s+copier *= *make\("Copier"\);\s+/g);
    //     replacements.push({'regex': /\b(copier|make\("Copier"\))\./g, 'val': 'Copier::'});
    //
    //     console.log('# removal regexes '+removals.length);
    //
    //     let line, lineNum, removal, removed;
    //     const removeLines = [];
    //     for(lineNum = 0; lineNum < textLines.length; lineNum++) {
    //         line = textLines[lineNum];
    //         removed = false;
    //
    //         // console.log('testing line '+line);
    //
    //         for(j = 0; j < removals.length && !removed; j++) {
    //             removal = removals[j];
    //
    //             console.log('is removal a regex? '+(removal instanceof RegExp));
    //             // console.log('testing '+removal+' for line \n'+line);
    //
    //             if(removal.test(line)) {
    //                 removeLines.push(lineNum);
    //                 removed = true;
    //                 console.log('matched '+removal);
    //             }
    //         }
    //     }
    //
    //
    //     console.log('# removing lines '+removeLines.length);
    //
    //
    //     for(i = 0; i < removeLines.length; i++) {
    //         console.log('removing lines '+removeLines[i]);
    //     }
    //
    //     for(i = 0; i < removeLines.length; i++) {
    //         textBuffer.deleteRow(removeLines[i]);
    //     }
    //
    //     // for(i = 0; i < replacements.length; i++) {
    //     //     textBuffer.replace(replacements.regex, replacements.val);
    //     // }
    //
    // },

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

# Your init script
#
# Atom will evaluate this file each time a new window is opened. It is run
# after packages are loaded/activated and after the previous editor state
# has been restored.
#
# An example hack to log to the console when each text editor is saved.
#
# atom.workspace.observeTextEditors (editor) ->
#   editor.onDidSave ->
#     console.log "Saved! #{editor.getPath()}

fs = require 'fs'
path = require 'path'
{BufferedProcess} = require 'atom'

# emacs "kill" (ctrl-k)
atom.commands.add 'atom-text-editor', 'custom:kill-line', ->
  editor = atom.workspace.getActiveTextEditor()
  editor.cutToEndOfLine()

# atom.commands.add 'atom-text-editor', 'custom:lock-current-file': ->
#   # editor = atom.workspace.getActivePaneItem()
#   editor = atom.workspace.getActiveTextEditor()
#   filePath = editor.getPath()
#   file = editor?.buffer.file
#   # filePath = file?.path
#   command = 'git-lock'
#   args = [file.fileName]
#   # command = 'la'
#   # args = ["-la"]
#   options = {
#     cwd: filePath
#     # cwd: atom.project.getPaths()
#     env: process.env
#   }
#   output = ''
#   stdout = (out) ->
#     output += out
#   exit = (code) ->
#     if code isnt 0
#       message = "'#{command}' failed to execute sucessfully!"
#       options =
#         detail: output
#         dismissable: true
#       atom.notifications.addError message, options
#     else
#       message = "'#{command}' executed successfully!"
#       options =
#         detail: output
#         dismissable: false
#       atom.notifications.addSuccess message, options
#   new BufferedProcess {command, args, options, stdout, exit}

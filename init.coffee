fs = require 'fs'
path = require 'path'
{BufferedProcess} = require 'atom'

# emacs "kill" (ctrl-k)
atom.commands.add 'atom-text-editor', 'custom:kill-line', ->
  editor = atom.workspace.getActiveTextEditor()
  editor.cutToEndOfLine()

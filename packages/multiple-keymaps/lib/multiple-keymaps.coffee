{CompositeDisposable} = require 'atom'

fs = require 'fs-extra'

module.exports = MultipleKeymaps =

  activate: (state) ->
    for keymap in fs.readdirSync "#{atom.configDirPath}/keymaps"
      atom.keymaps.loadKeymap "#{atom.configDirPath}/keymaps/#{keymap}"

-- Options

vim.o.cursorline = true
vim.o.ignorecase = true
vim.o.incsearch = true
vim.o.number = true
vim.o.relativenumber = true
vim.o.scrolloff = 3
vim.o.signcolumn = 'yes'
vim.o.smartcase = true
vim.o.undofile = true

vim.o.foldmethod = 'expr'
vim.o.foldexpr = 'v:lua.vim.treesitter.foldexpr()'
vim.o.foldlevelstart = 99 -- start with all folds open

-- Autocmds

-- Enable treesitter highlighting for any buffer that has a parser available.
vim.api.nvim_create_autocmd('FileType', {
  callback = function()
    pcall(vim.treesitter.start)
  end,
})

-- Restore cursor to last position when reopening a file.
-- Based on :h last-position-jump and
-- https://github.com/neovim/neovim/issues/16339#issuecomment-1457394370
vim.api.nvim_create_autocmd('BufRead', {
  desc = 'Jump to last cursor position when reopening a file',
  callback = function(opts)
    vim.api.nvim_create_autocmd('BufWinEnter', {
      once = true,
      buffer = opts.buf,
      callback = function()
        local ft = vim.bo[opts.buf].filetype
        local last_known_line = vim.api.nvim_buf_get_mark(opts.buf, '"')[1]
        if
          not (ft:match('commit') or ft:match('rebase'))
          and ft ~= 'xxd'
          and not vim.wo.diff
          and last_known_line > 1
          and last_known_line <= vim.api.nvim_buf_line_count(opts.buf)
        then
          vim.api.nvim_feedkeys([[g`"]], 'nx', false)
        end
      end,
    })
  end,
})

-- Core keymaps

vim.g.mapleader = ' '

vim.keymap.set('n', '<leader>w', ':write<CR>', { desc = 'Write' })
vim.keymap.set('n', '<leader>d', ':bdelete<CR>', { desc = 'Delete buffer' })
-- Tmux buffer integration

local function tmux_yank(text)
  vim.fn.system({'tmux', 'load-buffer', '-'}, text)
end

vim.keymap.set('v', '<leader>ty', function()
  local start = vim.fn.getpos('v')
  local finish = vim.fn.getpos('.')
  local lines = vim.fn.getregion(start, finish, { type = vim.fn.mode() })
  tmux_yank(table.concat(lines, '\n') .. '\n')
  vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<Esc>', true, false, true), 'nx', false)
end, { desc = 'Yank selection to tmux buffer' })

vim.keymap.set('n', '<leader>tp', function()
  local text = vim.fn.system({'tmux', 'show-buffer'})
  vim.api.nvim_put(vim.split(text, '\n', { trimempty = true }), '', true, true)
end, { desc = 'Paste from tmux buffer' })

vim.keymap.set('n', '<leader>tP', function()
  local text = vim.fn.system({'tmux', 'show-buffer'})
  vim.api.nvim_put(vim.split(text, '\n', { trimempty = true }), '', false, true)
end, { desc = 'Paste from tmux buffer (before)' })

-- Git permalink

local function git_permalink(file, line_start, line_end)
  local args = {'git', 'permalink', file, tostring(line_start)}
  if line_end and line_end ~= line_start then
    table.insert(args, tostring(line_end))
  end
  local result = vim.system(args, { text = true }):wait()
  if result.code ~= 0 then
    vim.notify('git permalink failed: ' .. (result.stderr or ''), vim.log.levels.ERROR)
    return
  end
  local url = vim.trim(result.stdout)
  vim.notify(url)
  vim.system({'xdg-open', url})
end

vim.keymap.set('n', '<leader>p', function()
  git_permalink(vim.fn.expand('%:p'), vim.fn.line('.'))
end, { desc = 'Open git permalink' })

vim.keymap.set('v', '<leader>p', function()
  local start = vim.fn.getpos('v')[2]
  local finish = vim.fn.getpos('.')[2]
  if start > finish then start, finish = finish, start end
  vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<Esc>', true, false, true), 'nx', false)
  git_permalink(vim.fn.expand('%:p'), start, finish)
end, { desc = 'Open git permalink (selection)' })

-- AI assistant integration (tmux-xagent)

local ai_cached_agent = nil -- { pane = '...', type = '...' }

-- Resolve which agent pane to target. Calls back with { pane, type } or nil.
local function ai_resolve_agent(callback)
  if ai_cached_agent then
    callback(ai_cached_agent)
    return
  end
  local output = vim.fn.system('tmux-xagent-list')
  local agents = {}
  for line in output:gmatch('[^\n]+') do
    local pane, type, index = line:match('^(.+):(.+):(.+)$')
    if pane then table.insert(agents, { pane = pane, type = type, index = index }) end
  end
  if #agents == 0 then
    vim.notify('No AI assistant found in this window', vim.log.levels.ERROR)
  elseif #agents == 1 then
    ai_cached_agent = agents[1]
    callback(ai_cached_agent)
  else
    vim.ui.select(agents, {
      prompt = 'Select AI assistant:',
      format_item = function(a) return a.type .. ' (pane ' .. a.index .. ')' end,
    }, function(choice)
      if choice then
        ai_cached_agent = choice
        callback(choice)
      end
    end)
  end
end

vim.keymap.set('n', '<leader>q', function()
  ai_resolve_agent(function(agent)
    local file = vim.fn.expand('%:.')
    local line = vim.fn.line('.')
    vim.fn.system({'tmux-xagent', '--pane', agent.pane, '--type', agent.type,
      '--file', file, '--line', tostring(line)})
  end)
end, { desc = 'Send context to AI assistant' })
vim.keymap.set('n', '<leader>Q', function()
  ai_resolve_agent(function(agent)
    local ok, prompt = pcall(vim.fn.input, 'AI prompt: ')
    if not ok or prompt == '' then return end
    local file = vim.fn.expand('%:.')
    local line = vim.fn.line('.')
    vim.fn.system({'xch', '--pane', agent.pane, '--type', agent.type,
      '--file', file, '--line', tostring(line), prompt})
  end)
end, { desc = 'Send prompt to AI assistant' })

-- Packages

vim.cmd.packadd('nvim.undotree')

vim.pack.add({
  { src = 'https://github.com/sainnhe/gruvbox-material' },
  { src = 'https://github.com/neovim/nvim-lspconfig' },
  { src = 'https://github.com/lewis6991/gitsigns.nvim' },
  { src = 'https://github.com/nvim-mini/mini.pick', version = 'stable' },
  { src = 'https://github.com/nvim-mini/mini.surround', version = 'stable' },
  { src = 'https://github.com/saghen/blink.cmp', version = 'v1' },
  { src = 'https://github.com/folke/flash.nvim' },
  { src = 'https://github.com/nvim-treesitter/nvim-treesitter' },
  { src = 'https://github.com/folke/which-key.nvim' },
})

-- Colorscheme

vim.g.gruvbox_material_background = 'hard' -- 'hard', 'medium' (default), 'soft'
vim.g.gruvbox_material_enable_italic = true
vim.cmd.colorscheme('gruvbox-material')

-- Gitsigns

require('gitsigns').setup({
  signs = {
    add          = { text = '▌' },
    change       = { text = '▌' },
    delete       = { text = '_' },
    topdelete    = { text = '‾' },
    changedelete = { text = '~' },
    untracked    = { text = '┆' },
  },
  on_attach = function(bufnr)
    local gs = require('gitsigns')
    local function map(mode, l, r, desc)
      vim.keymap.set(mode, l, r, { buffer = bufnr, desc = desc })
    end
    map('n', ']c', function() gs.nav_hunk('next') end, 'Next hunk')
    map('n', '[c', function() gs.nav_hunk('prev') end, 'Prev hunk')
    map({'n', 'v'}, '<leader>hs', gs.stage_hunk, 'Stage hunk')
    map({'n', 'v'}, '<leader>hr', gs.reset_hunk, 'Reset hunk')
    map('n', '<leader>hp', gs.preview_hunk_inline, 'Preview hunk inline')
    map('n', '<leader>hP', gs.preview_hunk, 'Preview hunk popup')
  end,
})

-- Mini.pick

require('mini.pick').setup()

vim.keymap.set('n', '<leader>ff', '<cmd>Pick files<cr>', { desc = 'Find files' })
vim.keymap.set('n', '<leader>fg', '<cmd>Pick grep_live<cr>', { desc = 'Live grep' })
vim.keymap.set('n', '<leader>fb', '<cmd>Pick buffers<cr>', { desc = 'Buffers' })
vim.keymap.set('n', '<leader>fh', '<cmd>Pick help<cr>', { desc = 'Help tags' })
vim.keymap.set('n', '<leader>fr', '<cmd>Pick resume<cr>', { desc = 'Resume picker' })
vim.keymap.set('n', '<leader>fs', function()
  local pick = MiniPick
  local on_list = function(data)
    local items = data.items
    for _, item in ipairs(items) do
      item.path = item.filename
    end
    pick.set_picker_items(items, { do_match = false })
  end
  pick.start({
    source = {
      items = {},
      name = 'LSP (workspace symbol)',
      match = function(_, _, query)
        if #query == 0 then return pick.set_picker_items({}, { do_match = false }) end
        local buf_id = vim.api.nvim_win_get_buf(pick.get_picker_state().windows.target)
        vim.api.nvim_buf_call(buf_id, function()
          vim.lsp.buf.workspace_symbol(table.concat(query), { on_list = on_list })
        end)
      end,
    },
  })
end, { desc = 'Workspace symbols (LSP)' })
vim.keymap.set('n', '<leader>fk', function()
  local items = {}
  for _, mode in ipairs({ 'n', 'i', 'v', 'x', 's', 'o', 't', 'c' }) do
    for _, km in ipairs(vim.api.nvim_get_keymap(mode)) do
      local desc = km.desc or km.rhs or ''
      table.insert(items, { text = mode .. '  ' .. km.lhs .. '  ' .. desc })
    end
  end
  MiniPick.start({ source = { items = items, name = 'Keymaps' } })
end, { desc = 'Keymaps' })

-- Treesitter

require('nvim-treesitter').install({ 'bash', 'c', 'go', 'lua', 'markdown', 'python', 'rust', 'vim', 'vimdoc' })

-- Flash

require('flash').setup({
  modes = {
    char = {
      jump_labels = true,
    },
  },
})

vim.keymap.set({'n', 'x', 'o'}, 's', function() require('flash').jump() end, { desc = 'Flash' })
vim.keymap.set({'n', 'x', 'o'}, 'S', function() require('flash').treesitter() end, { desc = 'Flash Treesitter' })
vim.keymap.set('o', 'r', function() require('flash').remote() end, { desc = 'Remote Flash' })
vim.keymap.set({'o', 'x'}, 'R', function() require('flash').treesitter_search() end, { desc = 'Treesitter Search' })
vim.keymap.set('c', '<C-s>', function() require('flash').toggle() end, { desc = 'Toggle Flash Search' })

-- Surround (mini.surround)
-- Use 'gs' prefix since 's' conflicts with flash.nvim ('gs' is useless stock "sleep")

require('mini.surround').setup({
  mappings = {
    add = 'gsa',
    delete = 'gsd',
    find = 'gsf',
    find_left = 'gsF',
    highlight = 'gsh',
    replace = 'gsr',
    suffix_last = '',
    suffix_next = '',
  },
})

-- Completion (blink.cmp)
--
-- Uses the 'default' keymap preset:
--   C-y:     accept selected (or first) item
--   C-n/C-p: select next/prev item
--   C-e:     dismiss menu
--   C-space: toggle menu / toggle docs
--   C-b/C-f: scroll docs
--   Tab/S-Tab: jump to next/prev snippet placeholder
--   C-k:     toggle signature help
-- All keys fall back to built-in behavior when the menu is closed, except:
--   C-k: overrides digraph entry (i_CTRL-K) — use `:digraphs` instead

require('blink.cmp').setup({
  completion = {
    documentation = { auto_show = true, auto_show_delay_ms = 500 },
    menu = { auto_show_delay_ms = 1000 },
  },
  signature = { enabled = true },
})

-- LSP

local ra_refresh_done = {}
vim.lsp.config('rust_analyzer', {
  -- Workaround: rust-analyzer returns empty inlay hints before it finishes
  -- loading the project, and doesn't reliably send workspace/inlayHint/refresh
  -- afterwards. Listen for its serverStatus notification and force a refresh
  -- once it reports quiescent.
  -- https://github.com/neovim/neovim/issues/33391
  -- https://github.com/rust-lang/rust-analyzer/issues/19548
  handlers = {
    ['experimental/serverStatus'] = function(_, result, ctx)
      if result.quiescent and not ra_refresh_done[ctx.client_id] then
        local client = vim.lsp.get_client_by_id(ctx.client_id)
        for bufnr in pairs(client.attached_buffers) do
          if vim.lsp.inlay_hint.is_enabled({ bufnr = bufnr }) then
            vim.lsp.inlay_hint.enable(false, { bufnr = bufnr })
            vim.lsp.inlay_hint.enable(true, { bufnr = bufnr })
          end
        end
        ra_refresh_done[ctx.client_id] = true
      end
    end,
  },
})

-- gopls disables inlay hints by default so we have to enable them manually
vim.lsp.config('gopls', {
  settings = {
    gopls = {
      hints = {
        assignVariableTypes = true,
        compositeLiteralFields = true,
        compositeLiteralTypes = true,
        constantValues = true,
        functionTypeParameters = true,
        ignoredError = true,
        parameterNames = true,
        rangeVariableTypes = true,
      },
    },
  },
})

vim.lsp.enable('clangd')
vim.lsp.enable('gopls')
vim.lsp.enable('pylsp')
vim.lsp.enable('rust_analyzer')

vim.api.nvim_create_autocmd('BufWritePre', {
  pattern = { '*.rs', '*.go' },
  callback = function()
    vim.lsp.buf.format({ async = false })
  end,
})

vim.keymap.set('n', 'gd', vim.lsp.buf.definition, { desc = 'Go to definition (LSP)' })
vim.keymap.set('n', 'gD', vim.lsp.buf.declaration, { desc = 'Go to declaration (LSP)' })

vim.diagnostic.config({
  severity_sort = true,
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = '⬤',
      [vim.diagnostic.severity.WARN] = '⬤',
      [vim.diagnostic.severity.INFO] = '⬤',
      [vim.diagnostic.severity.HINT] = '⬤',
    },
  },
  virtual_lines = { current_line = true },
  virtual_text = {
    current_line = false,
    severity = { min = vim.diagnostic.severity.WARN },
    format = function(d)
      return d.message:gsub('\n', '; ')
    end,
  },
})

vim.lsp.inlay_hint.enable(true)

-- Which-key

require('which-key').setup({
  preset = 'helix',
  spec = {
    { '<leader>f', group = 'Find' },
    { '<leader>h', group = 'Hunk' },
    { '<leader>t', group = 'Tmux' },
  },
})

-- LSP progress spinner in the ruler
local spinner_frames = { '⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷' }
local spinner_idx = 0
vim.g.lsp_busy = ''
vim.o.rulerformat = '%{g:lsp_busy} %-14.(%l,%c%V%) %P'
local lsp_progress_timer = vim.uv.new_timer()
vim.api.nvim_create_autocmd('LspProgress', {
  callback = function()
    if not lsp_progress_timer:is_active() then
      lsp_progress_timer:start(0, 100, vim.schedule_wrap(function()
        if vim.lsp.status() == '' then
          lsp_progress_timer:stop()
          vim.g.lsp_busy = ''
          spinner_idx = 0
        else
          spinner_idx = (spinner_idx % #spinner_frames) + 1
          vim.g.lsp_busy = spinner_frames[spinner_idx]
        end
        vim.cmd.redrawstatus()
      end))
    end
  end,
})

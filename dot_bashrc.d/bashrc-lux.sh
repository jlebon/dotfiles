# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

# Expand dir env vars on tab
shopt -s direxpand

# Controls the format of the time in output of `history`
HISTTIMEFORMAT="[%F %T] "
HISTCONTROL=ignorespace

# Infinite history
# NB: on newer bash, anything < 0 is the supported way, but on CentOS/RHEL
# at least, only this works
HISTSIZE=
HISTFILESIZE=

export VAGRANT_DEFAULT_PROVIDER=libvirt
export LIBVIRT_DEFAULT_URI=qemu:///system

# XXX: also check for X11 session for this
if [ -x /usr/bin/vimx ]; then
    alias vim='vimx'
    VIM=vimx
elif [ -x /usr/bin/vim ]; then
    VIM=vim
else
    VIM=vi
fi

export EDITOR=$VIM
export VISUAL=$VIM
unset VIM

function whichpkg() {
	local file
	if ! file=$(which "$1"); then
		return
	fi

	# could be an alias/something not a file
	if [ ! -e "$file" ]; then
		which "$1"
	else
		rpm -qf "$file"
	fi
}

alias findx='sudo find / -mount -iname'

alias t='tmux'
alias ta='tmux attach'

alias g='grepx'
alias gg='gitgrepx'
alias gi='grepxi'

alias domlist='virsh list --all'
alias domstart='virsh start'

alias bell='echo -ne "\a"'

alias rost='rpm-ostree'
alias ocw='oc get pods --watch'

alias curlx='curl -L --remote-name-all'

if [ -x /usr/bin/bat ]; then
    #alias cat='bat'
    #alias less='bat'
    export BAT_THEME='Monokai Extended Light'
fi

if [ -x /usr/bin/fd ]; then
  export FZF_DEFAULT_COMMAND='fd --type f'
fi

# Git aliases

# pre-load here to get access to the _git_$cmd autocompletion functions
if [ -f /usr/share/bash-completion/completions/git ]; then
	source /usr/share/bash-completion/completions/git
fi

# create an alias from $1 to "git $2 $3 $4", then tries to also enable
# auto-completion for it (with support for git aliases)
function mkgitalias {

	# create the bash alias
	eval alias $1=\"git $2 $3 $4\"

	# add autocomplete support if we find the right functions
	if [ "$(type -t __git_complete)" == "function" ]; then
		if [ "$(type -t _git_$2)" == "function" ]; then
			__git_complete $1 _git_$2
		else
			gitalias=$(git config alias.$2)
			if [ $? -eq 0 ]; then
				__git_complete $1 _git_${gitalias% *}
			fi
		fi
	fi
}

function mkgitalias_indirect {

	local al=$1; shift
	local completion_fn=$1; shift
	# create the bash alias
	eval alias $al=\"git $1 $2 $3\"

	# add autocomplete support if we find the right functions
	if [ "$(type -t __git_complete)" == "function" ]; then
		if [ "$(type -t _git_$completion_fn)" == "function" ]; then
			__git_complete $al _git_$completion_fn
		fi
	fi
}

# core commands

mkgitalias gits status
mkgitalias gitb branch
mkgitalias gita add
mkgitalias gite edit
mkgitalias gitc commit
mkgitalias_indirect gitls branch lsb

# logging commands

mkgitalias gitl l
mkgitalias gitla la
mkgitalias gitlg lg
mkgitalias gith hh

# diff commands

mkgitalias gitd d
mkgitalias gitdw d --word-diff=color
mkgitalias gitds d --staged
mkgitalias gitdsw d --staged --word-diff=color

function stdprompt_hostname() { # $1 = color
	echo -n "\[\033[0;${1}m\]"
	echo -n "${__containername:-\h}"
	echo -n "\[\033[0m\]"
}

function stdprompt_time() { # $1 = color
	echo -n "\[\033[0;${1}m\]"
	echo -n "$(date +%H:%M:%S)"
	echo -n "\[\033[0m\]"
}

for f in /usr{/local,}/share/git-core/contrib/completion/git-prompt.sh; do
    [ -f $f ] && source $f && break
done

stty -ixon -ixoff

# calculate it once since it's not likely to change in one session
__home_realpath=$(realpath $HOME)

function stdprompt_dir() { # $1 = dir, $2 = git root

	local pwd_realpath
	pwd_realpath=$(realpath $PWD)

	# Get the real path to the repo's root
	local repo_realpath
	if [ -x /bin/git ]; then
		repo_realpath=$(git rev-parse --show-toplevel 2> /dev/null)
	fi

	# A tricky bit on atomic-ws here is that the default dir when starting bash
	# is not $HOME (which is /home/jlebon), but `realpath $HOME`, which is
	# /var/home/jlebon.  So we need to be able to translate both $HOME and
	# $(realpath $HOME) into ~.

	# Get the current dir, but abbreviate homedir if present
	local pwd=$PWD # default to $PWD
	if [[ $pwd_realpath == $__home_realpath ]]; then
		pwd='~'
	# handle /home/jlebon subdir
	elif [[ $PWD == $HOME/* ]]; then
		pwd='~'${pwd:${#HOME}}
	# handle /var/home/jlebon subdir
	elif [[ $PWD == $__home_realpath/* ]]; then
		pwd='~'${PWD:${#__home_realpath}}
	fi

	# Are we even in a repo?
	if [[ -n "$repo_realpath" ]]; then

		# Calculate how deep we are in the repo
		local diff=$((${#pwd_realpath} - ${#repo_realpath}))

		# Get the name of the repo (we use pwd instead of repo_realpath in
		# case the repo name is itself a symlink)
		local repo_name=$(basename ${pwd::$((${#pwd} - $diff))})

		# Calculate the paths before and after the repo name
		local head=${pwd::$((${#pwd} - $diff - ${#repo_name}))}
		if [ $diff -gt 0 ]; then
			local tail=${pwd:$((-$diff))}
		fi

		# if it's a symlink, then it's probably a common git repo we shortened,
		# so just skip the e.g. ~/Code/gh/c prefix
		if [ ! -L ${head/\~/${HOME}}/$repo_name ]; then
			if [[ $head == '~/Code/'* ]]; then
				head=${head:7}
			elif [[ $head == /home/$USER/Code/* ]]; then
				head=${head:18}
			fi
			echo -n "\[\033[0;${1}m\]"
			echo -n "$head"
		fi

		echo -n "\[\033[0;${2}m\]"
		echo -n "$repo_name"

		echo -n "\[\033[0;${1}m\]"
		echo -n "$tail"
	else
		echo -n "\[\033[0;${1}m\]"
		echo -n "$pwd"
	fi

	echo -n "\[\033[0m\]"
}

function stdprompt_gitbranch() { # $1 = color
	echo -n "\[\033[0;${1}m\]"
	echo -n "\$(__git_ps1 \"%s\")"
	echo -n "\[\033[0m\]"
}

# calculate it once since it's not likely to change in one session
__in_containerenv=no
if [ -f /.dockerenv ] || [ -f /run/.containerenv ]; then
	__in_containerenv=yes
	if [ -s /run/.containerenv ]; then
		__containername=$(. /run/.containerenv && echo $name)
	fi
fi

function stdprompt() {

	local rc=$?

	if [[ $__in_containerenv == no ]]; then
		echo -n "["
	else
		echo -n "{"
	fi

	# if this becomes too annoying, we could instead:
	# - rely on bash history timestamps
	# - the above + emit a new history msg to signal when commands finish
	#stdprompt_time 36
	#echo -n " "

	if [ -n "$__last_cmd_start_time" ]; then
		local duration=$(($(date +%s) - $__last_cmd_start_time))
		if [ $duration -gt 0 ]; then
			echo -n "${duration}s "
		fi
	fi

	if [ $rc -ne 0 ]; then
		# only show exit code if it's interesting
		if [ $rc -ne 1 ] && [ $rc -le 127 ]; then
			echo -n "\[\033[0;31m\]"
			echo -n "$rc "
			echo -n "\[\033[0m\]"
		# signal? but really, this is just a heuristic. e.g. `exit 130` will
		# show up as SIGINT.
		elif [ $rc -ge 128 ]; then
			echo -n "\[\033[0;31m\]"
			local sig=$(kill -l $((rc-128)) 2>/dev/null || :)
			echo -n "${sig:-$rc} "
			echo -n "\[\033[0m\]"
		fi
	fi

	# print hostname
	# blue for normal, red for root
	if [ $UID -eq 0 ]; then
		stdprompt_hostname 31
		echo -n " "
	else
		stdprompt_hostname 34
		echo -n " "
	fi

	# print dir in yellow, git root in green
	stdprompt_dir 33 32

	# purple branch
	if rpm -q git &>/dev/null && [[ -n "$(git rev-parse --show-toplevel 2>/dev/null)" ]]; then
		echo -n " "
		stdprompt_gitbranch 35
	fi

	if [[ $__in_containerenv == no ]]; then
		echo -n "]"
	else
		echo -n "}"
	fi

	if [ -n "${PS1_MARKER:-}" ]; then
		echo -n " <$PS1_MARKER>"
	fi

	if [ $rc -ne 0 ]; then
		echo -n "\[\033[0;31m\]"
	fi

	if [ $UID -ne 0 ]; then
		echo -n "$ "
	else
		echo -n "# "
	fi

	if [ $rc -ne 0 ]; then
		echo -n "\[\033[0m\]"
	fi
}

# reset __last_cmd_start_time so that multiple <Enter> won't keep accumulating
PROMPT_COMMAND="PS1=\$(stdprompt); __last_cmd_start_time="

function mark_prompt {
	PS1_MARKER="$1"
}

# https://github.com/rcaloras/bash-preexec
[[ -f ~/.bash-preexec.sh ]] && source ~/.bash-preexec.sh

# this is used by stdprompt
__last_cmd_start_time=
function register_cmd_start_time() {
    __last_cmd_start_time=$(date +%s)
}
preexec_functions+=(register_cmd_start_time)

# Same thing as prompt_callback, but print the root only.
# This is better than git rev-parse --show-toplevel because
# it keeps symlinks.
function git_root {

    if [ ! -x /bin/git ]; then
        echo "Error: git not installed!" >&2
        return
    fi

    # Get the real path to the repo's root
    local repo_realpath=$(git rev-parse --show-toplevel 2> /dev/null)

    # Are we even in a repo?
    if [[ -n "$repo_realpath" ]]; then
      local cur_realpath=$(realpath .)
      local diff=$((${#cur_realpath} - ${#repo_realpath}))
      local repo_name=$(basename ${PWD:0:$((${#PWD} - $diff))})
      local head=${PWD:0:$((${#PWD} - $diff - ${#repo_name}))}
      echo -n "$head$repo_name"
    fi
}
alias gitr='cd $(git_root)'

__codepath="$HOME/Code"

# we need this little wrapper so that we can change dir in the current shell
__previous_code=
__current_code=
function code() {
	local dir
	if dir=$(codedir "$@"); then
		__previous_code=$__current_code
		__current_code=$dir
		cd $__current_code
	else
		echo "$dir"
		return 1
	fi
}

function codedir() {
	if [ $# -eq 1 ] && [[ $1 == - ]]; then
		if [ -z "$__previous_code" ]; then
			echo "No previous codebase!" >&2
			return 1
		fi
		local dir=$__previous_code
	else
		local dir=$(codeswitch $__codepath "$@")
		if [ $? -ne 0 ] || [ ! -d "$dir" ]; then
			echo "$dir"
			return 1
		fi
	fi
	echo "$dir"
}

function fed() {
    local dir=$(fedpkgx "$@")
    if [ $? -eq 0 ]; then
        code $(basename "$dir") sfp --rebuild
    fi
}

export GOPATH=$__codepath/go

# little function to easily edit known_hosts when we try to connect to an IP
# whose key changed.
# $1 -- line number of offending RSA key
function delete_known_host() {
	sed -i ${1}d ~/.ssh/known_hosts
}

function sleep_until() {
	local msg=$1; shift
	local until=$(date -d "$*" +'%s')
	[ $? -eq 0 ] || return 1
	local diff=$((until - $(date +'%s')))
	if [ $diff -lt 1 ]; then
		echo "Already passed that point in time, sir"
	else
		echo -n "Sleeping until $* (${diff}s)... "
		sleep $diff
		echo -e "$(tput bold)" "$msg" "$(tput sgr0)"
		bell && sleep 0.2 && bell && sleep 0.2 && bell
	fi
}

function meetings() {
	echo
	while [ $# -ne 0 ]; do
		local msg=$1; shift
		local time=$1; shift
		sleep_until "$msg" $time
	done
}

function cdtemp() {
    local d=$(mktemp -d)
    if (cd $d && bash); then
        echo "Deleting $d"
        rm -rf $d
    else
        echo -e "\e[1;31mKeeping $d\e[0m"
    fi
}

function latest() {
    local d=${1:-$(pwd)}; shift
    d=$(realpath "${d}")
    echo $d/$(ls -tr $d | tail -1)
}

mkgit() {
    git init .
    git add -A
    git commit -m 'initial commit'
}

# source user-defined completions
# XXX: could switch to $HOME/.config/bash_completion, which is natively
# supported
if [ -f ~/.bash_completion ]; then
    source ~/.bash_completion
fi

# source any local mods
if [ -f ~/.bashrc.local ]; then
	source ~/.bashrc.local
fi

if [ -n "${TMUX:-}" ] && command -v shorten-code-path > /dev/null; then
    cd $(shorten-code-path $PWD)
fi

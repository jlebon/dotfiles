# https://github.com/jlebon/codeswitch

_code() {
	local cur opts
	COMPREPLY=()
	cur="${COMP_WORDS[COMP_CWORD]}"

	# name of the repo
	if [ $COMP_CWORD = 1 ]; then
		opts=$(code '_')
	else
		return 0
	fi

	COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
}
complete -F _code code

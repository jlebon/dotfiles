_xenter() {
	local cur
	COMPREPLY=()
	cur="${COMP_WORDS[COMP_CWORD]}"

	# Don't complete after -- (command args)
	local i
	for ((i=1; i < COMP_CWORD; i++)); do
		if [ "${COMP_WORDS[i]}" = "--" ]; then
			return 0
		fi
	done

	# Complete options
	if [[ "${cur}" == -* ]]; then
		COMPREPLY=( $(compgen -W "-h --" -- "${cur}") )
		return 0
	fi

	# Skip if a container name was already given
	for ((i=1; i < COMP_CWORD; i++)); do
		case "${COMP_WORDS[i]}" in
			-*) continue ;;
			*) return 0 ;;
		esac
	done

	# Scope to current tmux window if in tmux
	local filter_args=()
	if [ -n "${TMUX_PANE:-}" ]; then
		local window_id
		window_id=$(tmux display-message -p '#{window_id}' 2>/dev/null || true)
		if [ -n "${window_id}" ]; then
			filter_args=("${window_id}")
		fi
	fi

	local names
	names=$(_xenter_list_names "${filter_args[@]}")
	COMPREPLY=( $(compgen -W "${names}" -- "${cur}") )
}

_xenter_list_names() {
	local filter_window="${1:-}"
	local lines name labels

	lines=$(podman ps --format '{{.Names}}\t{{.Labels}}' --filter label=pi=1 2>/dev/null || true)
	local lines2
	lines2=$(podman ps --format '{{.Names}}\t{{.Labels}}' --filter label=opencode=1 2>/dev/null || true)
	if [ -n "${lines2}" ]; then
		lines="${lines:+${lines}$'\n'}${lines2}"
	fi

	[ -z "${lines}" ] && return

	while IFS=$'\t' read -r name labels; do
		if [ -n "${filter_window}" ]; then
			[[ "${labels}" == *"TMUX_WINDOW:${filter_window}"* ]] || continue
		fi
		echo "${name}"
	done <<< "${lines}"
}

complete -F _xenter xenter

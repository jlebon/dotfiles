# Create tmpdir and cd into it. Delete tmpdir on the way out, unless we exit
# non-zero (this allows one to use e.g. Ctrl-C, Ctrl-D to force a non-zero
# exit).
function cdtemp() {
    local d
    d=$(mktemp -d)
    if (cd "$d" && bash); then
        echo "Deleting $d"
        rm -rf "$d"
    else
        echo -e "\e[1;31mKeeping $d\e[0m"
    fi
}

# cd into the output of a command
function cdout() {
    local out
    out=$("$@")
    cd "$out"
}

# Convenience wrapper around `git worktree add`.
# - Uses the convention of placing worktrees in worktrees/...
# - The worktree IS DELETED ON EXIT, unless we exit non-zero (this allows one to
#   use e.g. Ctrl-C, Ctrl-D to force a non-zero exit).
# - By default, the current branch is checked out in detached mode. A different
#   existing branch can be passed in. A non-existent branch will be created from the
#   default branch (likely main).
# - Makes gitdir relative to be compatible with repos getting mounted into a
#   container image at a different location.
function cdw() {
    local detach branch worktree
    if [ -n "${TMP_WORKTREE:-}" ]; then
        echo "Already in a temporary worktree!" >&2
        return 1
    fi
    cd "$(realpath "$(git rev-parse --git-common-dir)/..")" || return 1
    if [ -n "${1:-}" ]; then
        branch=${1}
    else
        branch=$(git rev-parse --abbrev-ref HEAD)
    fi
    detach=
    if git worktree list | grep -q "\[${branch}\]"; then
        detach=--detach
    fi
    mkdir -p worktrees
    if [ ! -d "worktrees/${branch}" ]; then
        worktree=worktrees/${branch}
    else
        worktree=$(mktemp -d -p worktrees "${branch}.XXX")
    fi
    if ! git branch -l | grep -qE " ${branch}$"; then
        git branch "${branch}" "$(git default -l)"
    fi
    git worktree add "${worktree}" "${branch}" ${detach}
    if [ -e "${worktree}/.gitmodules" ]; then
        echo -e "\e[1;31m⚠️ Git submodules uninitialized; use 'git subu' ⚠️ \e[0m" >&2
    fi
    # make gitdir relative so it works even in a container
    echo "gitdir: $(git -C "${worktree}" rev-parse --path-format=relative --git-common-dir)/${worktree}" > "${worktree}/.git"
    if (cd "${worktree}" && env TMP_WORKTREE=1 bash); then
        echo "Deleting ${worktree}" >&2
        rm -rf "${worktree}"
        git worktree prune
    else
        echo -e "\e[1;31mKeeping $d\e[0m" >&2
    fi
}



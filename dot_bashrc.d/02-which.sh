# used to be shipped by the which package:
# https://src.fedoraproject.org/rpms/which/c/b5fc0eb6b1ab10d5564859347e64b84313cc57e0?branch=rawhide
# https://src.fedoraproject.org/rpms/which/blob/53706aeb4c9c437ccd0c9d1d62187e422cf3ac46/f/which2.sh
alias which='(alias; declare -f) | /usr/bin/which --tty-only --read-alias --read-functions --show-tilde --show-dot'

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
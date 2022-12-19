# modified from https://unix.stackexchange.com/a/27014
function milliseconds_to_human_short {
    local T=$1
    local D=$((T/1000/60/60/24))
    local H=$((T/1000/60/60%24))
    local M=$((T/1000/60%60))
    local S=$((T/1000%60))
    local MIL=$((T%1000))
    local out=''
    (( D == 0 )) || out+=$(printf '%dd' $D)
    (( H == 0 )) || out+=$(printf '%dh' $H)
    (( M == 0 )) || out+=$(printf '%dm' $M)
    if (( S != 0 )) || (( MIL != 0 )); then
        if [ -z "${out}" ]; then
            out+=$(printf '%d' $S)
        else
            out+=$(printf '%02d' $S)
        fi
        (( MIL == 0 )) || out+=$(printf '.%03d' $MIL)
        out+=s
    fi
    echo "${out}"
}

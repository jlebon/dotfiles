# calculate it once since it's not likely to change in one session
__in_containerenv=no
if [ -f /.dockerenv ] || [ -f /run/.containerenv ]; then
	__in_containerenv=yes
	if [ -s /run/.containerenv ]; then
		__containername=$(. /run/.containerenv && echo $name)
	fi
fi

